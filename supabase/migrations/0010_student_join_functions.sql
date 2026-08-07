-- The three functions that make up the student join flow. All three are
-- SECURITY DEFINER so they can safely read/write across RLS boundaries
-- (a not-yet-joined visitor has no session at all, so no ordinary RLS
-- policy could let them read class/roster data) while only ever
-- exposing the minimal fields a join screen needs -- never teacher_id,
-- never other classes, never inactive-student noise beyond what's
-- needed.

-- Public (anon-callable): look up a class + its active roster by code,
-- for the join screen's "enter code" step. No session required yet --
-- deliberately, so a curious QR scan that never completes joining never
-- creates a throwaway anonymous auth user.
create or replace function public.lookup_class_by_code(p_class_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_class record;
  v_result jsonb;
begin
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

-- Requires a session (an anonymous one is fine -- see is_anonymous
-- check). Links the caller's own auth.uid() to the chosen roster entry.
-- Re-callable: picking a different name (or re-joining after clearing
-- storage) simply repoints the same auth_user_id's link.
create or replace function public.join_class(p_class_student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_student record;
  v_result jsonb;
begin
  if v_auth_uid is null then
    raise exception 'Not authenticated';
  end if;

  select cs.id, cs.display_name, cs.class_id
    into v_student
    from public.class_students cs
    where cs.id = p_class_student_id and cs.is_active = true;

  if not found then
    raise exception 'That student is no longer on this class roster';
  end if;

  insert into public.student_devices (class_student_id, auth_user_id, last_seen_at)
  values (v_student.id, v_auth_uid, now())
  on conflict (auth_user_id)
  do update set class_student_id = excluded.class_student_id, last_seen_at = now();

  select jsonb_build_object(
    'classStudentId', v_student.id,
    'displayName', v_student.display_name,
    'classId', v_student.class_id
  )
  into v_result;

  return v_result;
end;
$$;

grant execute on function public.join_class(uuid) to authenticated;

-- Resolves "who am I" for an already-recognized device -- powers
-- RequireDevice and the auto-recognition-on-repeat-visit flow.
create or replace function public.get_my_student_session()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_row record;
  v_result jsonb;
begin
  if v_auth_uid is null then
    return null;
  end if;

  select cs.id as class_student_id, cs.display_name,
         c.id as class_id, c.name as class_name,
         ll.code as learning_code, ll.name as learning_name, ll.flag_emoji as learning_flag,
         dl.code as display_code, dl.name as display_name, dl.flag_emoji as display_flag
    into v_row
    from public.student_devices sd
    join public.class_students cs on cs.id = sd.class_student_id
    join public.classes c on c.id = cs.class_id
    join public.languages ll on ll.id = c.learning_language_id
    join public.languages dl on dl.id = c.display_language_id
    where sd.auth_user_id = v_auth_uid
      and cs.is_active = true
      and c.archived_at is null;

  if not found then
    return null;
  end if;

  select jsonb_build_object(
    'classStudentId', v_row.class_student_id,
    'displayName', v_row.display_name,
    'classId', v_row.class_id,
    'className', v_row.class_name,
    'learningLanguage', jsonb_build_object(
      'code', v_row.learning_code, 'name', v_row.learning_name, 'flagEmoji', v_row.learning_flag
    ),
    'displayLanguage', jsonb_build_object(
      'code', v_row.display_code, 'name', v_row.display_name, 'flagEmoji', v_row.display_flag
    )
  )
  into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_my_student_session() to authenticated;
