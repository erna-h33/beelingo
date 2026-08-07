-- Activity log of student word contributions -- deliberately named and
-- modeled apart from hive_words itself: this is "who contributed what,
-- when," not part of the Hive's own content. class_id is denormalized
-- (derivable via class_student_id -> class_students.class_id) purely to
-- keep RLS and future stats queries (M10) simple, matching the same
-- denormalization already used elsewhere in this schema (e.g.
-- classes.teacher_id).
create table if not exists public.word_contributions (
  id uuid primary key default gen_random_uuid(),
  hive_word_id uuid not null references public.hive_words (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  class_student_id uuid not null references public.class_students (id) on delete cascade,
  contributed_at timestamptz not null default now(),
  is_first_contribution boolean not null
);

create index if not exists word_contributions_hive_word_id_idx on public.word_contributions (hive_word_id);
create index if not exists word_contributions_class_student_id_idx on public.word_contributions (class_student_id);
create index if not exists word_contributions_class_id_idx on public.word_contributions (class_id);

comment on column public.word_contributions.is_first_contribution is
  'True on the row that actually created the hive_words entry; false on every subsequent student who contributes the same (already-existing) word. Contribution counts are derived (count(*) group by hive_word_id), never cached.';

alter table public.word_contributions enable row level security;

-- No insert policy for any client role: the only write path is
-- contribute_word() below (SECURITY DEFINER, bypasses RLS) -- keeps the
-- merge-on-duplicate logic in exactly one place, same discipline as
-- student_devices/join_class in M4.
create policy "students can view their class contributions"
  on public.word_contributions for select
  using (
    public.is_class_member(class_id)
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = true
  );

create policy "teachers can view their class contributions"
  on public.word_contributions for select
  using (public.is_class_teacher(class_id));

-- The student contribution flow: "student enters a word" -> find-or-
-- create in one atomic call. Race-safe via ON CONFLICT DO NOTHING against
-- the same (class_id, lower(word)) unique index hive_words already has
-- (0013) -- if two students submit the same brand-new word at once, only
-- one insert wins; the other transparently falls back to the row the
-- winner created and still gets a (non-first) contribution logged.
--
-- Enrichment (DeepL/Wikidata) happens client-side *before* calling this
-- (see supabase/functions/enrich-word), passed in as plain parameters --
-- only used on the create branch; an already-existing word is never
-- re-enriched ("translate once, cache forever").
create or replace function public.contribute_word(
  p_word text,
  p_translation text default null,
  p_word_type text default null,
  p_gender text default null,
  p_plural text default null,
  p_translation_source text default 'none',
  p_lexical_source text default 'none',
  p_enrichment_status text default 'pending'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_student_id uuid := public.current_class_student_id();
  v_class_id uuid;
  v_word text := trim(p_word);
  v_hive_word_id uuid;
  v_is_new boolean;
  v_result jsonb;
begin
  if v_class_student_id is null then
    raise exception 'Not recognized as a student in any class';
  end if;
  if v_word is null or length(v_word) = 0 then
    raise exception 'Word is required';
  end if;

  select class_id into v_class_id from public.class_students where id = v_class_student_id;

  insert into public.hive_words (
    class_id, word, translation, word_type, gender, plural,
    source, added_by_class_student_id,
    translation_source, translated_at, lexical_source, lexical_fetched_at, enrichment_status
  )
  values (
    v_class_id, v_word, p_translation, p_word_type, p_gender, p_plural,
    'student', v_class_student_id,
    p_translation_source, case when p_translation is not null then now() else null end,
    p_lexical_source, case when p_lexical_source = 'wikidata' then now() else null end,
    p_enrichment_status
  )
  on conflict (class_id, lower(word)) do nothing
  returning id into v_hive_word_id;

  if v_hive_word_id is not null then
    v_is_new := true;
  else
    v_is_new := false;
    select id into v_hive_word_id
      from public.hive_words
      where class_id = v_class_id and lower(word) = lower(v_word);
  end if;

  insert into public.word_contributions (hive_word_id, class_id, class_student_id, is_first_contribution)
  values (v_hive_word_id, v_class_id, v_class_student_id, v_is_new);

  select jsonb_build_object(
    'hiveWordId', hw.id,
    'word', hw.word,
    'translation', hw.translation,
    'isNew', v_is_new
  )
  into v_result
  from public.hive_words hw
  where hw.id = v_hive_word_id;

  return v_result;
end;
$$;

grant execute on function public.contribute_word(text, text, text, text, text, text, text, text) to authenticated;
