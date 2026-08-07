-- Bug fix: get_my_student_session() (0010) selected both `cs.display_name`
-- (the student's own name) and `dl.name as display_name` (the display
-- language's name) into the same record -- an alias collision that made
-- `v_row.display_name` ambiguous. In practice the student's name won,
-- so the response's `displayLanguage.name` field incorrectly echoed the
-- student's own name (e.g. "Ana") instead of the language name (e.g.
-- "English"). Confirmed in testing. Renamed the language-name aliases to
-- be unambiguous.
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
         ll.code as learning_code, ll.name as learning_lang_name, ll.flag_emoji as learning_flag,
         dl.code as display_code, dl.name as display_lang_name, dl.flag_emoji as display_flag
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
      'code', v_row.learning_code, 'name', v_row.learning_lang_name, 'flagEmoji', v_row.learning_flag
    ),
    'displayLanguage', jsonb_build_object(
      'code', v_row.display_code, 'name', v_row.display_lang_name, 'flagEmoji', v_row.display_flag
    )
  )
  into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_my_student_session() to authenticated;
