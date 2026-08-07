alter table public.game_sessions enable row level security;
alter table public.game_session_participants enable row level security;
alter table public.game_questions enable row level security;
alter table public.game_question_answers enable row level security;
alter table public.game_answers enable row level security;

-- game_sessions --------------------------------------------------------
create policy "teachers can manage their class game sessions"
  on public.game_sessions for all
  using (public.is_class_teacher(class_id))
  with check (public.is_class_teacher(class_id));

create policy "students can view their class game sessions"
  on public.game_sessions for select
  using (
    public.is_class_member(class_id)
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = true
  );

-- game_session_participants --------------------------------------------
-- Everyone in the class can see the whole roster's scores (it's a
-- shared leaderboard, not private data) -- teacher via is_class_teacher
-- through the session, students via is_class_member the same way.
create policy "teachers can view participants in their games"
  on public.game_session_participants for select
  using (
    exists (
      select 1 from public.game_sessions gs
      where gs.id = game_session_participants.game_session_id
        and public.is_class_teacher(gs.class_id)
    )
  );

create policy "teachers can manage participants in their games"
  on public.game_session_participants for update
  using (
    exists (
      select 1 from public.game_sessions gs
      where gs.id = game_session_participants.game_session_id
        and public.is_class_teacher(gs.class_id)
    )
  );

create policy "students can view participants in their class games"
  on public.game_session_participants for select
  using (
    exists (
      select 1 from public.game_sessions gs
      where gs.id = game_session_participants.game_session_id
        and public.is_class_member(gs.class_id)
    )
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = true
  );

-- Students self-insert their own participant row (joining the waiting
-- room) -- low-risk: they can only ever create a row for their own
-- class_student_id, starting at score 0. All *score* mutations after
-- that go through game_submit_answer() only (no student update policy).
create policy "students can join games in their class"
  on public.game_session_participants for insert
  with check (
    class_student_id = public.current_class_student_id()
    and exists (
      select 1 from public.game_sessions gs
      where gs.id = game_session_participants.game_session_id
        and public.is_class_member(gs.class_id)
    )
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = true
  );

-- game_questions ---------------------------------------------------------
create policy "teachers can view all questions in their games"
  on public.game_questions for select
  using (
    exists (
      select 1 from public.game_sessions gs
      where gs.id = game_questions.game_session_id
        and public.is_class_teacher(gs.class_id)
    )
  );

-- Students only ever see questions the session has already "revealed"
-- (sequence_index <= current_question_index) -- keeps a technically
-- savvy student from reading ahead by querying the table directly
-- instead of waiting for the host's Broadcast. Self-paced types
-- (Flashcards) set current_question_index high at creation time so
-- everything is visible immediately, matching "self-paced review".
create policy "students can view revealed questions in their class games"
  on public.game_questions for select
  using (
    exists (
      select 1 from public.game_sessions gs
      where gs.id = game_questions.game_session_id
        and public.is_class_member(gs.class_id)
        and game_questions.sequence_index <= gs.current_question_index
    )
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = true
  );

-- game_question_answers --------------------------------------------------
-- No policies at all for any client role: RLS is enabled with zero
-- grants, so every ordinary client query is denied by default. Only
-- game_submit_answer() (SECURITY DEFINER) can ever read this table.

-- game_answers -------------------------------------------------------
create policy "teachers can view answers in their games"
  on public.game_answers for select
  using (
    exists (
      select 1 from public.game_questions gq
      join public.game_sessions gs on gs.id = gq.game_session_id
      where gq.id = game_answers.game_question_id
        and public.is_class_teacher(gs.class_id)
    )
  );

create policy "students can view answers in their class games"
  on public.game_answers for select
  using (
    exists (
      select 1 from public.game_questions gq
      join public.game_sessions gs on gs.id = gq.game_session_id
      where gq.id = game_answers.game_question_id
        and public.is_class_member(gs.class_id)
    )
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = true
  );

-- No insert policy for any client role: only game_submit_answer()
-- (SECURITY DEFINER) writes this table -- server-side grading only,
-- never trusting a client-reported "I got it right".
