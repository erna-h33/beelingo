-- Games engine functions. All SECURITY DEFINER, all pure SQL/plpgsql --
-- no external API calls are needed anywhere in this engine, so unlike
-- enrich-word this entire backend deploys through the same db push
-- pipeline as everything else.

-- Small reusable helper: N random distractor words/translations from
-- the same class, excluding the target. Runs under whatever role called
-- it (SECURITY DEFINER callers pass their elevated context down to
-- plain functions they invoke), so it works fine called from inside the
-- functions below despite hive_words having RLS.
create or replace function public.game_pick_distractors(
  p_class_id uuid, p_exclude_id uuid, p_use_word boolean, p_limit int default 3
)
returns text[]
language sql
stable
as $$
  select coalesce(array_agg(val), array[]::text[]) from (
    select case when p_use_word then word else translation end as val
    from public.hive_words
    where class_id = p_class_id
      and id <> p_exclude_id
      and (case when p_use_word then word else translation end) is not null
    order by random()
    limit p_limit
  ) t;
$$;

-- The heart of the adaptive review engine's "selection" half: builds an
-- entire game session's question set in one call, using weighted
-- sampling (see docs/architecture.md's Adaptive Review Engine section).
-- Weighted-without-replacement via the Efraimidis-Spirakis method
-- (key = random()^(1/weight), take the top N by key) -- mathematically
-- equivalent to roulette-wheel sampling but expressible as a single
-- ORDER BY rather than a manual loop, which is the more natural fit now
-- that this whole engine lives in SQL rather than an Edge Function.
create or replace function public.game_create_session(
  p_class_id uuid,
  p_game_type text,
  p_word_set_filter text,
  p_settings jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_question_count int := coalesce((p_settings->>'questionCount')::int, 8);
  v_topic text := p_settings->>'topic';
  v_session_id uuid;
  v_eligible_count int;
  v_selected_count int;
  v_seq int := 0;
  v_word record;
  v_distractors text[];
  v_masked_sentence text;
  v_pairs jsonb;
  v_answer_map jsonb;
  v_question_id uuid;
begin
  if not public.is_class_teacher(p_class_id) then
    raise exception 'Not authorized for this class';
  end if;

  if p_game_type not in (
    'matching', 'flashcards', 'speed_translation', 'reverse_translation',
    'typing_challenge', 'memory_challenge', 'fill_in_blank', 'team_battle'
  ) then
    raise exception 'Unknown game type: %', p_game_type;
  end if;

  if p_word_set_filter not in ('today', 'random', 'entire_hive', 'by_topic') then
    raise exception 'Unknown word-set filter: %', p_word_set_filter;
  end if;

  create temporary table tmp_pool (
    id uuid,
    word text,
    translation text,
    practice_sentence text,
    weight double precision
  ) on commit drop;

  insert into tmp_pool (id, word, translation, practice_sentence, weight)
  select
    hw.id, hw.word, hw.translation, hw.practice_sentence,
    case when p_word_set_filter = 'random'
      then 1.0
      else 0.15 + (1 - 0.15) * (1 - hw.mastery_score)
    end
  from public.hive_words hw
  where hw.class_id = p_class_id
    and (p_word_set_filter <> 'today' or hw.created_at >= date_trunc('day', now()))
    and (p_word_set_filter <> 'by_topic' or hw.topic = v_topic)
    and (p_game_type <> 'fill_in_blank' or hw.practice_sentence is not null)
    and (
      p_game_type not in (
        'speed_translation', 'reverse_translation', 'typing_challenge',
        'team_battle', 'matching', 'memory_challenge'
      )
      or hw.translation is not null
    );

  select count(*) into v_eligible_count from tmp_pool;

  if v_eligible_count < 2 then
    raise exception 'Not enough words for this game yet -- add a few more to the Hive first.';
  end if;

  v_selected_count := least(v_question_count, v_eligible_count);

  create temporary table tmp_selected on commit drop as
  select * from tmp_pool
  order by power(random(), 1.0 / greatest(weight, 0.0001)) desc
  limit v_selected_count;

  insert into public.game_sessions (class_id, teacher_id, game_type, word_set_filter, settings, status)
  values (p_class_id, v_teacher_id, p_game_type, p_word_set_filter, p_settings, 'waiting')
  returning id into v_session_id;

  if p_game_type in ('matching', 'memory_challenge') then
    select jsonb_agg(jsonb_build_object('wordId', id, 'word', word, 'translation', translation))
      into v_pairs
      from tmp_selected;
    select jsonb_object_agg(id::text, translation) into v_answer_map from tmp_selected;

    insert into public.game_questions (game_session_id, sequence_index, hive_word_id, question_payload)
    values (v_session_id, 0, null, jsonb_build_object('type', p_game_type, 'pairs', v_pairs))
    returning id into v_question_id;

    insert into public.game_question_answers (game_question_id, correct_answer)
    values (v_question_id, jsonb_build_object('pairs', v_answer_map));

    v_seq := 1;

  elsif p_game_type = 'flashcards' then
    for v_word in select * from tmp_selected loop
      insert into public.game_questions (game_session_id, sequence_index, hive_word_id, question_payload)
      values (
        v_session_id, v_seq, v_word.id,
        jsonb_build_object('type', 'flashcards', 'word', v_word.word, 'translation', v_word.translation)
      );
      v_seq := v_seq + 1;
    end loop;
    -- Self-paced review: reveal every card immediately, no host pacing.
    update public.game_sessions set current_question_index = v_seq - 1 where id = v_session_id;

  elsif p_game_type = 'typing_challenge' then
    for v_word in select * from tmp_selected loop
      insert into public.game_questions (game_session_id, sequence_index, hive_word_id, question_payload)
      values (v_session_id, v_seq, v_word.id, jsonb_build_object('type', 'typing_challenge', 'prompt', v_word.word))
      returning id into v_question_id;
      insert into public.game_question_answers (game_question_id, correct_answer)
      values (v_question_id, jsonb_build_object('answer', v_word.translation));
      v_seq := v_seq + 1;
    end loop;

  elsif p_game_type = 'fill_in_blank' then
    for v_word in select * from tmp_selected loop
      v_masked_sentence := regexp_replace(v_word.practice_sentence, '\m' || v_word.word || '\M', '_____', 'gi');
      insert into public.game_questions (game_session_id, sequence_index, hive_word_id, question_payload)
      values (v_session_id, v_seq, v_word.id, jsonb_build_object('type', 'fill_in_blank', 'sentence', v_masked_sentence))
      returning id into v_question_id;
      insert into public.game_question_answers (game_question_id, correct_answer)
      values (v_question_id, jsonb_build_object('answer', v_word.word));
      v_seq := v_seq + 1;
    end loop;

  else
    -- speed_translation / reverse_translation / team_battle: multiple choice.
    for v_word in select * from tmp_selected loop
      v_distractors := public.game_pick_distractors(
        p_class_id, v_word.id, p_game_type = 'reverse_translation', 3
      );

      if p_game_type = 'reverse_translation' then
        insert into public.game_questions (game_session_id, sequence_index, hive_word_id, question_payload)
        values (
          v_session_id, v_seq, v_word.id,
          jsonb_build_object(
            'type', p_game_type, 'prompt', v_word.translation,
            'choices', (select jsonb_agg(c order by random()) from unnest(array_append(v_distractors, v_word.word)) as c)
          )
        )
        returning id into v_question_id;
        insert into public.game_question_answers (game_question_id, correct_answer)
        values (v_question_id, jsonb_build_object('answer', v_word.word));
      else
        insert into public.game_questions (game_session_id, sequence_index, hive_word_id, question_payload)
        values (
          v_session_id, v_seq, v_word.id,
          jsonb_build_object(
            'type', p_game_type, 'prompt', v_word.word,
            'choices', (select jsonb_agg(c order by random()) from unnest(array_append(v_distractors, v_word.translation)) as c)
          )
        )
        returning id into v_question_id;
        insert into public.game_question_answers (game_question_id, correct_answer)
        values (v_question_id, jsonb_build_object('answer', v_word.translation));
      end if;
      v_seq := v_seq + 1;
    end loop;
  end if;

  return jsonb_build_object('sessionId', v_session_id, 'questionCount', v_seq);
end;
$$;

grant execute on function public.game_create_session(uuid, text, text, jsonb) to authenticated;

-- Waiting -> active. Team Battle auto-balances currently-joined
-- participants into round-robin teams here (teacher never manually
-- assigns for MVP -- see docs/architecture.md).
create or replace function public.game_start_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_id uuid;
  v_game_type text;
  v_team_count int;
  v_participant record;
  v_team_idx int := 0;
begin
  select class_id, game_type, coalesce((settings->>'teamCount')::int, 2)
    into v_class_id, v_game_type, v_team_count
    from public.game_sessions where id = p_session_id;

  if v_class_id is null then
    raise exception 'Game session not found';
  end if;
  if not public.is_class_teacher(v_class_id) then
    raise exception 'Not authorized for this class';
  end if;

  if v_game_type = 'team_battle' then
    for v_participant in
      select id from public.game_session_participants
      where game_session_id = p_session_id
      order by random()
    loop
      update public.game_session_participants
        set team = 'Team ' || chr(65 + (v_team_idx % greatest(v_team_count, 1)))
        where id = v_participant.id;
      v_team_idx := v_team_idx + 1;
    end loop;
  end if;

  update public.game_sessions set status = 'active', started_at = now() where id = p_session_id;

  return jsonb_build_object('sessionId', p_session_id, 'status', 'active');
end;
$$;

grant execute on function public.game_start_session(uuid) to authenticated;

-- Host-paced advance (not used by self-paced Flashcards, which reveal
-- everything at creation time). Bumps current_question_index, which is
-- also what gates student SELECT on game_questions -- so this call
-- alone is what "reveals" the next question to RLS-scoped re-fetches,
-- independent of whatever ephemeral Broadcast message the host's client
-- also sends for low-latency delivery.
create or replace function public.game_advance_question(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_id uuid;
  v_max_index int;
  v_new_index int;
begin
  select class_id into v_class_id from public.game_sessions where id = p_session_id;
  if v_class_id is null or not public.is_class_teacher(v_class_id) then
    raise exception 'Not authorized for this class';
  end if;

  select max(sequence_index) into v_max_index from public.game_questions where game_session_id = p_session_id;

  update public.game_sessions
    set current_question_index = least(current_question_index + 1, coalesce(v_max_index, 0))
    where id = p_session_id
    returning current_question_index into v_new_index;

  return jsonb_build_object('currentQuestionIndex', v_new_index, 'isLast', v_new_index >= coalesce(v_max_index, 0));
end;
$$;

grant execute on function public.game_advance_question(uuid) to authenticated;

-- The anti-cheat core: resolves the real answer server-side from
-- game_question_answers (never sent to any client), never trusts a
-- client-reported "I got it right". Grading shape depends on whether
-- the question is a single-target question or a Matching/Memory
-- pair-attempt (question_payload ? 'pairs'), not on game_type directly,
-- since that's what actually determines the payload/answer shape.
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

  if v_question_payload ? 'pairs' then
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

-- Adaptive Review Engine's "update" half: once per completed game, not
-- per answer (see docs/architecture.md). EMA per word touched, using
-- the whole class's session accuracy for that word -- naturally weights
-- recent sessions more than older ones with no history table needed.
create or replace function public.game_end_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_id uuid;
  v_learning_rate constant double precision := 0.35;
  v_word record;
begin
  select class_id into v_class_id from public.game_sessions where id = p_session_id;
  if v_class_id is null or not public.is_class_teacher(v_class_id) then
    raise exception 'Not authorized for this class';
  end if;

  update public.game_sessions set status = 'completed', ended_at = now() where id = p_session_id;

  for v_word in
    select hive_word_id, avg((is_correct)::int)::double precision as accuracy
    from (
      select gq.hive_word_id, ga.is_correct
      from public.game_answers ga
      join public.game_questions gq on gq.id = ga.game_question_id
      where gq.game_session_id = p_session_id and gq.hive_word_id is not null
      union all
      select (ga.submitted_answer ->> 'wordId')::uuid as hive_word_id, ga.is_correct
      from public.game_answers ga
      join public.game_questions gq on gq.id = ga.game_question_id
      where gq.game_session_id = p_session_id and gq.question_payload ? 'pairs'
    ) all_answers
    where hive_word_id is not null
    group by hive_word_id
  loop
    update public.hive_words
      set mastery_score = greatest(0, least(1, mastery_score + v_learning_rate * (v_word.accuracy - mastery_score)))
      where id = v_word.hive_word_id;
  end loop;

  return jsonb_build_object('sessionId', p_session_id, 'status', 'completed');
end;
$$;

grant execute on function public.game_end_session(uuid) to authenticated;
