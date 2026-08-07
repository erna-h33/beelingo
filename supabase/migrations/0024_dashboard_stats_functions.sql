-- Fills in the two top-level Dashboard routes (/t and /s) that were
-- left as placeholders through M1-M12 -- M10 only ever built the
-- per-class Statistics tab (class_word_stats/class_student_stats,
-- 0023), not these cross-class/personal summaries. Same
-- teacher-only-RPC and never-expose-mastery-score patterns as 0023.

-- Aggregates across every (non-archived) class the signed-in teacher
-- owns. Mirrors class_word_stats' single-target/pairs union (0023) but
-- scoped by teacher_id via a join through classes instead of one
-- class_id, plus a className label since results now span classes.
create or replace function public.teacher_dashboard_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_total_classes int;
  v_total_hive_words int;
  v_new_words_week int;
  v_active_students int;
  v_games_played int;
  v_avg_accuracy numeric;
  v_top_contributors jsonb;
  v_most_missed jsonb;
begin
  if v_teacher_id is null then
    raise exception 'Not authenticated';
  end if;

  select count(*) into v_total_classes
    from public.classes where teacher_id = v_teacher_id and archived_at is null;

  select count(*) into v_total_hive_words
    from public.hive_words hw
    join public.classes c on c.id = hw.class_id
    where c.teacher_id = v_teacher_id and c.archived_at is null;

  select count(*) into v_new_words_week
    from public.hive_words hw
    join public.classes c on c.id = hw.class_id
    where c.teacher_id = v_teacher_id and c.archived_at is null
      and hw.created_at >= date_trunc('day', now()) - interval '6 days';

  select count(*) into v_active_students
    from public.class_students cs
    join public.classes c on c.id = cs.class_id
    where c.teacher_id = v_teacher_id and c.archived_at is null and cs.is_active = true;

  select count(*) into v_games_played
    from public.game_sessions gs
    join public.classes c on c.id = gs.class_id
    where c.teacher_id = v_teacher_id and gs.status = 'completed';

  select case when sum(gsp.correct_count + gsp.incorrect_count) > 0
    then round((sum(gsp.correct_count)::numeric / sum(gsp.correct_count + gsp.incorrect_count)) * 100, 1)
    else null end
    into v_avg_accuracy
    from public.game_session_participants gsp
    join public.game_sessions gs on gs.id = gsp.game_session_id and gs.status = 'completed'
    join public.classes c on c.id = gs.class_id
    where c.teacher_id = v_teacher_id;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_top_contributors
  from (
    select
      cs.id as "classStudentId", cs.display_name as "displayName", c.name as "className",
      count(wc.id) as "contributionCount"
    from public.word_contributions wc
    join public.class_students cs on cs.id = wc.class_student_id
    join public.classes c on c.id = wc.class_id
    where c.teacher_id = v_teacher_id
    group by cs.id, cs.display_name, c.name
    order by "contributionCount" desc
    limit 5
  ) t;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_most_missed
  from (
    select
      hw.id as "hiveWordId", hw.word, hw.translation, c.name as "className",
      counts.attempts, counts.correct,
      round((1 - (counts.correct::numeric / counts.attempts))::numeric, 3)::float as "missRate"
    from (
      select hive_word_id, count(*) as attempts, sum((is_correct)::int) as correct
      from (
        select gq.hive_word_id, ga.is_correct
        from public.game_answers ga
        join public.game_questions gq on gq.id = ga.game_question_id
        join public.game_sessions gs on gs.id = gq.game_session_id
        join public.classes c on c.id = gs.class_id
        where c.teacher_id = v_teacher_id and gq.hive_word_id is not null
        union all
        select (ga.submitted_answer ->> 'wordId')::uuid as hive_word_id, ga.is_correct
        from public.game_answers ga
        join public.game_questions gq on gq.id = ga.game_question_id
        join public.game_sessions gs on gs.id = gq.game_session_id
        join public.classes c on c.id = gs.class_id
        where c.teacher_id = v_teacher_id and gq.question_payload ? 'pairs'
      ) all_answers
      where hive_word_id is not null
      group by hive_word_id
      having count(*) >= 2
    ) counts
    join public.hive_words hw on hw.id = counts.hive_word_id
    join public.classes c on c.id = hw.class_id
    order by "missRate" desc, counts.attempts desc
    limit 5
  ) t;

  return jsonb_build_object(
    'totalClasses', v_total_classes,
    'totalHiveWords', v_total_hive_words,
    'newWordsThisWeek', v_new_words_week,
    'totalActiveStudents', v_active_students,
    'totalGamesPlayed', v_games_played,
    'averageAccuracy', v_avg_accuracy,
    'topContributors', v_top_contributors,
    'mostMissedWords', v_most_missed
  );
end;
$$;

grant execute on function public.teacher_dashboard_stats() to authenticated;

-- Personal summary for the signed-in student. "Words learned" is a
-- proxy metric (distinct words answered correctly at least once) --
-- deliberately not mastery_score, which stays fully internal even
-- here. "Streak" walks backward day-by-day from today through a
-- once-built set of activity dates (game participation or word
-- contributions) until the first gap -- bounded by the streak length
-- itself, so it's cheap even though it's a loop rather than a set
-- operation.
create or replace function public.student_dashboard_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student_id uuid := public.current_class_student_id();
  v_games_played int;
  v_correct int;
  v_incorrect int;
  v_contributions int;
  v_words_learned int;
  v_streak int := 0;
  v_check_date date := current_date;
begin
  if v_student_id is null then
    raise exception 'Not recognized as a student';
  end if;

  select count(*), coalesce(sum(gsp.correct_count), 0), coalesce(sum(gsp.incorrect_count), 0)
    into v_games_played, v_correct, v_incorrect
    from public.game_session_participants gsp
    join public.game_sessions gs on gs.id = gsp.game_session_id and gs.status = 'completed'
    where gsp.class_student_id = v_student_id;

  select count(*) into v_contributions
    from public.word_contributions where class_student_id = v_student_id;

  select count(distinct hive_word_id) into v_words_learned
  from (
    select gq.hive_word_id
    from public.game_answers ga
    join public.game_questions gq on gq.id = ga.game_question_id
    join public.game_session_participants gsp on gsp.id = ga.game_session_participant_id
    where gsp.class_student_id = v_student_id and gq.hive_word_id is not null and ga.is_correct = true
    union
    select (ga.submitted_answer ->> 'wordId')::uuid
    from public.game_answers ga
    join public.game_questions gq on gq.id = ga.game_question_id
    join public.game_session_participants gsp on gsp.id = ga.game_session_participant_id
    where gsp.class_student_id = v_student_id and gq.question_payload ? 'pairs' and ga.is_correct = true
  ) learned;

  create temporary table tmp_activity_dates on commit drop as
  select distinct d::date as activity_date from (
    select gsp.joined_at as d
      from public.game_session_participants gsp where gsp.class_student_id = v_student_id
    union all
    select wc.contributed_at as d
      from public.word_contributions wc where wc.class_student_id = v_student_id
  ) all_dates;

  loop
    exit when not exists (select 1 from tmp_activity_dates where activity_date = v_check_date);
    v_streak := v_streak + 1;
    v_check_date := v_check_date - 1;
  end loop;

  return jsonb_build_object(
    'gamesPlayed', v_games_played,
    'correctCount', v_correct,
    'incorrectCount', v_incorrect,
    'contributionsCount', v_contributions,
    'wordsLearned', v_words_learned,
    'streakDays', v_streak
  );
end;
$$;

grant execute on function public.student_dashboard_stats() to authenticated;
