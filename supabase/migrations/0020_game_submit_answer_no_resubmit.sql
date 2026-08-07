-- Bug fix: game_submit_answer() (0019) let a participant call it
-- repeatedly on the same question -- nothing stopped spamming guesses
-- (e.g. trying every multiple-choice option) until one landed correct.
-- Confirmed via testing: resubmitting after a wrong answer was silently
-- accepted and re-scored. Single-target questions now allow exactly one
-- answer per participant; Matching/Memory Challenge (one game_questions
-- row covers many pairs, so distinct wordIds legitimately need separate
-- submissions) only blocks re-submitting a pair that's already been
-- correctly matched, not the whole question.
create or replace function public.game_submit_answer(
  p_game_question_id uuid,
  p_participant_id uuid,
  p_submitted_answer jsonb,
  p_response_time_ms int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_student_id uuid := public.current_class_student_id();
  v_owner_check uuid;
  v_correct_answer jsonb;
  v_question_payload jsonb;
  v_is_correct boolean := false;
  v_points int := 0;
  v_answer_id uuid;
  v_is_pairs boolean;
begin
  if v_class_student_id is null then
    raise exception 'Not recognized as a student';
  end if;

  select class_student_id into v_owner_check
    from public.game_session_participants where id = p_participant_id;
  if v_owner_check is null or v_owner_check <> v_class_student_id then
    raise exception 'Not your participant row';
  end if;

  select gqa.correct_answer, gq.question_payload
    into v_correct_answer, v_question_payload
    from public.game_questions gq
    left join public.game_question_answers gqa on gqa.game_question_id = gq.id
    where gq.id = p_game_question_id;

  if v_question_payload is null then
    raise exception 'Question not found';
  end if;

  v_is_pairs := v_question_payload ? 'pairs';

  if not v_is_pairs then
    if exists (
      select 1 from public.game_answers
      where game_question_id = p_game_question_id and game_session_participant_id = p_participant_id
    ) then
      raise exception 'Already answered this question';
    end if;
  else
    if exists (
      select 1 from public.game_answers
      where game_question_id = p_game_question_id
        and game_session_participant_id = p_participant_id
        and submitted_answer ->> 'wordId' = p_submitted_answer ->> 'wordId'
        and is_correct = true
    ) then
      raise exception 'Already matched that pair';
    end if;
  end if;

  if v_is_pairs then
    v_is_correct := lower(trim(both from (v_correct_answer -> 'pairs' ->> (p_submitted_answer ->> 'wordId'))))
                     = lower(trim(both from (p_submitted_answer ->> 'guess')));
    v_points := case when v_is_correct then 10 else 0 end;
  else
    v_is_correct := lower(trim(both from (v_correct_answer ->> 'answer')))
                     = lower(trim(both from (p_submitted_answer ->> 'answer')));
    v_points := case
      when v_is_correct and p_response_time_ms is not null
        then greatest(5, 20 - (p_response_time_ms / 1000))
      when v_is_correct then 10
      else 0
    end;
  end if;

  insert into public.game_answers (game_question_id, game_session_participant_id, submitted_answer, is_correct, response_time_ms)
  values (p_game_question_id, p_participant_id, p_submitted_answer, v_is_correct, p_response_time_ms)
  returning id into v_answer_id;

  update public.game_session_participants
    set score = score + v_points,
        correct_count = correct_count + (case when v_is_correct then 1 else 0 end),
        incorrect_count = incorrect_count + (case when v_is_correct then 0 else 1 end),
        last_seen_at = now()
    where id = p_participant_id;

  return jsonb_build_object('isCorrect', v_is_correct, 'pointsAwarded', v_points);
end;
$$;

grant execute on function public.game_submit_answer(uuid, uuid, jsonb, int) to authenticated;
