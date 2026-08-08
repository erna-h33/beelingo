-- Broaden class_student_stats (0023) from teacher-only to also allow
-- students in that class -- needed for the new cross-game Scoreboard
-- shown on the student dashboard, not just the teacher's Statistics
-- tab. Nothing in the query changes, and nothing new is exposed:
-- per-student score/games-played/accuracy is already visible to every
-- class member during any live game's Leaderboard (0018's "students
-- can view participants in their class games" policy already grants
-- this same class-wide visibility), so this is just letting the same
-- audience reach the same kind of data through the already-existing
-- aggregate RPC instead of a new one.
create or replace function public.class_student_stats(p_class_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
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
