-- Fix: 0030's game_questions RLS policy read directly from
-- game_answers to count the calling student's own answered questions --
-- but game_answers' own SELECT policy reads back from game_questions
-- to check class membership, so evaluating one policy triggered the
-- other in a loop ("infinite recursion detected in policy for relation
-- game_questions"). Confirmed live: both a fresh join and a real
-- question fetch failed immediately after 0030 shipped.
--
-- Same fix this codebase already uses for exactly this class of
-- problem (is_class_member, is_class_teacher, current_class_student_id
-- are all SECURITY DEFINER helpers for the same reason): wrap the
-- cross-table read in a SECURITY DEFINER function, which evaluates as
-- the function owner rather than the querying role, so it doesn't
-- re-trigger RLS on the tables it reads internally. Narrowly scoped on
-- purpose -- it only ever counts current_class_student_id()'s own
-- answers, never accepts a student id as input, so it can't be used to
-- probe anyone else's progress.
create or replace function public.my_answered_question_count(p_game_session_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(count(distinct ga.game_question_id), 0)::int
  from public.game_answers ga
  join public.game_session_participants gsp on gsp.id = ga.game_session_participant_id
  where gsp.game_session_id = p_game_session_id
    and gsp.class_student_id = public.current_class_student_id();
$$;

drop policy if exists "students can view revealed questions in their class games" on public.game_questions;

create policy "students can view revealed questions in their class games"
  on public.game_questions for select
  using (
    exists (
      select 1 from public.game_sessions gs
      where gs.id = game_questions.game_session_id
        and public.is_class_member(gs.class_id)
        and game_questions.sequence_index <= greatest(
          gs.current_question_index,
          public.my_answered_question_count(gs.id)
        )
    )
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = true
  );
