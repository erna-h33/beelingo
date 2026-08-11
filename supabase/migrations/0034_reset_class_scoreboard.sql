-- "Reset the scoreboard" (a teacher wanting a fresh competition/term
-- without losing anything else) can't just zero a stored score column
-- -- there isn't one. totalScore has always been a live SUM over every
-- game_session_participants row a student has ever had, computed fresh
-- on every class_student_stats call (0023/0027). So "reset" here means
-- a per-class cutoff timestamp: totalScore only counts games that
-- started *after* it, while gamesPlayed/correctCount/incorrectCount
-- (Student Progress, accuracy, Most Missed Words -- everything else
-- this class's stats surface) keep counting the full history,
-- unaffected. Nothing is deleted; a reset is fully non-destructive to
-- every other stat.
alter table public.classes add column if not exists scoreboard_reset_at timestamptz;

create or replace function public.class_student_stats(p_class_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_reset_at timestamptz;
begin
  if not (
    public.is_class_teacher(p_class_id)
    or (
      public.is_class_member(p_class_id)
      and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = true
    )
  ) then
    raise exception 'Not authorized for this class';
  end if;

  select scoreboard_reset_at into v_reset_at from public.classes where id = p_class_id;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_result
  from (
    select
      cs.id as "classStudentId",
      cs.display_name as "displayName",
      coalesce(agg_all.games_played, 0) as "gamesPlayed",
      coalesce(agg_score.total_score, 0) as "totalScore",
      coalesce(agg_all.correct_count, 0) as "correctCount",
      coalesce(agg_all.incorrect_count, 0) as "incorrectCount"
    from public.class_students cs
    -- Full history, never affected by a scoreboard reset.
    left join (
      select
        gsp.class_student_id,
        count(*) as games_played,
        sum(gsp.correct_count) as correct_count,
        sum(gsp.incorrect_count) as incorrect_count
      from public.game_session_participants gsp
      join public.game_sessions gs on gs.id = gsp.game_session_id and gs.status = 'completed'
      group by gsp.class_student_id
    ) agg_all on agg_all.class_student_id = cs.id
    -- Score only, scoped to games started after the reset cutoff (or
    -- the whole history, if this class has never been reset).
    left join (
      select
        gsp.class_student_id,
        sum(gsp.score) as total_score
      from public.game_session_participants gsp
      join public.game_sessions gs on gs.id = gsp.game_session_id and gs.status = 'completed'
      where v_reset_at is null or gs.started_at > v_reset_at
      group by gsp.class_student_id
    ) agg_score on agg_score.class_student_id = cs.id
    where cs.class_id = p_class_id and cs.is_active = true
    order by cs.display_name
  ) t;

  return v_result;
end;
$$;

grant execute on function public.class_student_stats(uuid) to authenticated;

-- Teacher-only: moves the cutoff to now(). Deliberately narrow --
-- takes no other input, touches no other table, so it can't be used
-- for anything but "start counting scores from this moment on."
create or replace function public.reset_class_scoreboard(p_class_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_class_teacher(p_class_id) then
    raise exception 'Not authorized for this class';
  end if;

  update public.classes set scoreboard_reset_at = now() where id = p_class_id;
end;
$$;

grant execute on function public.reset_class_scoreboard(uuid) to authenticated;
