-- M10: statistics functions. Both are teacher-only, read-only
-- aggregates -- neither ever surfaces mastery_score (per the standing
-- "mastery score is never shown in any UI" rule): "most missed words"
-- is derived straight from game_answers miss-rate, a different signal
-- computed independently of the adaptive engine's internal score.

-- Cumulative per-word miss-rate across every game this class has ever
-- played. Mirrors game_end_session's (0019) single-target/pairs union,
-- but aggregated over the whole class's history rather than one
-- session, and joined back to hive_words for display text. Words with
-- fewer than 2 attempts are excluded -- a single lucky/unlucky guess
-- isn't a meaningful "most missed" signal.
create or replace function public.class_word_stats(p_class_id uuid, p_limit int default 10)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_class_teacher(p_class_id) then
    raise exception 'Not authorized for this class';
  end if;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_result
  from (
    select
      hw.id as "hiveWordId",
      hw.word,
      hw.translation,
      hw.topic,
      counts.attempts,
      counts.correct,
      round((1 - (counts.correct::numeric / counts.attempts))::numeric, 3)::float as "missRate"
    from (
      select hive_word_id, count(*) as attempts, sum((is_correct)::int) as correct
      from (
        select gq.hive_word_id, ga.is_correct
        from public.game_answers ga
        join public.game_questions gq on gq.id = ga.game_question_id
        join public.game_sessions gs on gs.id = gq.game_session_id
        where gs.class_id = p_class_id and gq.hive_word_id is not null
        union all
        select (ga.submitted_answer ->> 'wordId')::uuid as hive_word_id, ga.is_correct
        from public.game_answers ga
        join public.game_questions gq on gq.id = ga.game_question_id
        join public.game_sessions gs on gs.id = gq.game_session_id
        where gs.class_id = p_class_id and gq.question_payload ? 'pairs'
      ) all_answers
      where hive_word_id is not null
      group by hive_word_id
      having count(*) >= 2
    ) counts
    join public.hive_words hw on hw.id = counts.hive_word_id
    order by "missRate" desc, counts.attempts desc
    limit p_limit
  ) t;

  return v_result;
end;
$$;

grant execute on function public.class_word_stats(uuid, int) to authenticated;

-- Per-student rollup. Unlike word stats, this doesn't need game_answers
-- at all -- game_session_participants already carries running
-- score/correct_count/incorrect_count per game, so this is a plain
-- aggregate across a student's participant rows.
create or replace function public.class_student_stats(p_class_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_class_teacher(p_class_id) then
    raise exception 'Not authorized for this class';
  end if;

  -- The completed-session filter has to happen before the join to
  -- class_students, not as an ON-clause condition alongside it -- a
  -- plain left join with `and gs.status = 'completed'` in the ON
  -- clause still counts a not-yet-completed session's participant row
  -- (only gs.* would come back null), which would inflate gamesPlayed
  -- for anyone mid-game. Aggregating in a subquery first and then left
  -- joining that keeps students who haven't played at all (agg is
  -- null -> coalesced to 0) while cleanly excluding in-progress games.
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_result
  from (
    select
      cs.id as "classStudentId",
      cs.display_name as "displayName",
      coalesce(agg.games_played, 0) as "gamesPlayed",
      coalesce(agg.total_score, 0) as "totalScore",
      coalesce(agg.correct_count, 0) as "correctCount",
      coalesce(agg.incorrect_count, 0) as "incorrectCount"
    from public.class_students cs
    left join (
      select
        gsp.class_student_id,
        count(*) as games_played,
        sum(gsp.score) as total_score,
        sum(gsp.correct_count) as correct_count,
        sum(gsp.incorrect_count) as incorrect_count
      from public.game_session_participants gsp
      join public.game_sessions gs on gs.id = gsp.game_session_id and gs.status = 'completed'
      group by gsp.class_student_id
    ) agg on agg.class_student_id = cs.id
    where cs.class_id = p_class_id and cs.is_active = true
    order by cs.display_name
  ) t;

  return v_result;
end;
$$;

grant execute on function public.class_student_stats(uuid) to authenticated;
