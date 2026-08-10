-- lookup_class_by_code is anon-callable with no session at all (by
-- design -- a curious QR scan shouldn't create an account) and returns
-- a class's name + full roster of real student names on a hit. With no
-- rate limiting, it's an open, unauthenticated, unlimited endpoint for
-- guessing 6-character class codes. The keyspace (31^6 ≈ 887M, see
-- generate_class_code) makes blind guessing slow in absolute terms, but
-- "slow" isn't "protected" against a dedicated scripted attacker with
-- no per-attempt cost. Turnstile (see the frontend Turnstile
-- integration) doesn't cover this at all -- guessing a code never
-- touches signInAnonymously, which only fires *after* a code is
-- already known to be valid.
--
-- Only *failed* lookups count against the limit, not successful ones --
-- a real classroom often sits behind one shared school-network IP, and
-- 20-30 students all typing the *same correct* code within the same
-- couple of minutes must never trip this. Wrong-code guesses (typos,
-- or an attacker) are what actually need throttling.
create table if not exists public.class_code_lookup_attempts (
  id bigint generated always as identity primary key,
  ip inet not null,
  attempted_at timestamptz not null default now()
);

create index if not exists class_code_lookup_attempts_ip_time_idx
  on public.class_code_lookup_attempts (ip, attempted_at);

alter table public.class_code_lookup_attempts enable row level security;
-- No policies at all: this table only exists for lookup_class_by_code's
-- own bookkeeping (SECURITY DEFINER bypasses RLS) -- no client role,
-- anon or authenticated, should ever read or write it directly.

create or replace function public.lookup_class_by_code(p_class_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_class record;
  v_result jsonb;
  v_ip inet;
  v_recent_failures int;
begin
  -- Supabase's edge proxy sets x-forwarded-for; PostgREST exposes
  -- request headers via this GUC. Deliberately fails open (v_ip stays
  -- null, rate limiting is skipped) rather than erroring the whole
  -- lookup if the header is ever missing or unparsable -- this is a
  -- hardening measure on top of the real access control, not the only
  -- thing standing between a guess and the database.
  begin
    v_ip := nullif(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1), '')::inet;
  exception when others then
    v_ip := null;
  end;

  if v_ip is not null then
    -- Bound table growth without a scheduled job: a small per-call
    -- chance to sweep rows well outside any window this function reads.
    -- (A per-IP-only cleanup would never fire for an IP that stops
    -- calling, letting one-off visitors' rows linger forever.)
    if random() < 0.01 then
      delete from public.class_code_lookup_attempts where attempted_at < now() - interval '1 day';
    end if;

    select count(*) into v_recent_failures
      from public.class_code_lookup_attempts
      where ip = v_ip and attempted_at >= now() - interval '10 minutes';

    if v_recent_failures >= 20 then
      raise exception 'Too many attempts -- please wait a few minutes and try again.';
    end if;
  end if;

  select c.id, c.name,
         ll.code as learning_code, ll.name as learning_name, ll.flag_emoji as learning_flag,
         dl.code as display_code, dl.name as display_name, dl.flag_emoji as display_flag
    into v_class
    from public.classes c
    join public.languages ll on ll.id = c.learning_language_id
    join public.languages dl on dl.id = c.display_language_id
    where upper(c.class_code) = upper(trim(p_class_code))
      and c.archived_at is null;

  if not found then
    if v_ip is not null then
      insert into public.class_code_lookup_attempts (ip) values (v_ip);
    end if;
    return null;
  end if;

  select jsonb_build_object(
    'class', jsonb_build_object(
      'id', v_class.id,
      'name', v_class.name,
      'learningLanguage', jsonb_build_object(
        'code', v_class.learning_code, 'name', v_class.learning_name, 'flagEmoji', v_class.learning_flag
      ),
      'displayLanguage', jsonb_build_object(
        'code', v_class.display_code, 'name', v_class.display_name, 'flagEmoji', v_class.display_flag
      )
    ),
    'roster', coalesce((
      select jsonb_agg(jsonb_build_object('id', cs.id, 'displayName', cs.display_name) order by cs.display_name)
      from public.class_students cs
      where cs.class_id = v_class.id and cs.is_active = true
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

grant execute on function public.lookup_class_by_code(text) to anon, authenticated;
