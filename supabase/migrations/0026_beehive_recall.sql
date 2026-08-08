-- BeeHive Recall: a new game *mode* inside the existing games engine,
-- not a separate system. It reuses everything the engine already has --
-- game_sessions lifecycle, game_session_participants scoring/leaderboard,
-- the RLS-gated game_answers/game_question_answers pair, and the
-- Adaptive Review Engine's mastery update in game_end_session -- with
-- zero changes required to any of those. The trick: BeeHive Recall's
-- grading ("did the student reproduce this word's exact spelling") is
-- structurally identical to Matching's pairs-grading ("did the student
-- match this word to its correct translation"), so it reuses
-- game_submit_answer's existing `question_payload ? 'pairs'` branch
-- outright -- same resubmission guard (which is what makes a duplicate
-- recalled word score 0 automatically), same case-insensitive/
-- accent-sensitive/no-fuzzy-matching comparison
-- (lower(trim(both from ...))) that already applies to every game.
-- The only genuinely new pieces are: the question-building branch below
-- (every game type needs one), and a one-line generalization to
-- game_submit_answer so this mode can award 1 point per word instead of
-- Matching's flat 10 -- each game type already has its own point
-- formula (multiple-choice scales with response time, Matching is
-- flat), so this isn't a new scoring model, just this mode's formula.

do $$
declare
  r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_attribute att on att.attrelid = rel.oid and att.attnum = any(con.conkey)
    where rel.relname = 'game_sessions'
      and att.attname = 'game_type'
      and con.contype = 'c'
  loop
    execute format('alter table public.game_sessions drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.game_sessions
  add constraint game_sessions_game_type_check
  check (game_type in (
    'matching', 'flashcards', 'speed_translation', 'reverse_translation',
    'typing_challenge', 'memory_challenge', 'fill_in_blank', 'team_battle',
    'beehive_recall'
  ));

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
    'typing_challenge', 'memory_challenge', 'fill_in_blank', 'team_battle',
    'beehive_recall'
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
      -- BeeHive Recall only ever needs the word itself (never shown or
      -- graded against a translation), so it's deliberately left out of
      -- this list -- more of the Hive stays eligible for it.
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

  elsif p_game_type = 'beehive_recall' then
    -- Same single-question/pairs shape as Matching (study the whole
    -- board, then submit one guess per word) -- reuses
    -- game_submit_answer's pairs branch untouched apart from the
    -- pointsPerCorrect override below. `pairs` here carries just
    -- {wordId, word}; no translation is ever shown or graded.
    select jsonb_agg(jsonb_build_object('wordId', id, 'word', word)) into v_pairs from tmp_selected;
    select jsonb_object_agg(id::text, word) into v_answer_map from tmp_selected;

    insert into public.game_questions (game_session_id, sequence_index, hive_word_id, question_payload)
    values (
      v_session_id, 0, null,
      jsonb_build_object(
        'type', 'beehive_recall',
        'pairs', v_pairs,
        'displaySeconds', coalesce((p_settings->>'displaySeconds')::int, 8),
        'answerSeconds', coalesce((p_settings->>'answerSeconds')::int, 30),
        'pointsPerCorrect', 1
      )
    )
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
      values (v_session_id, v_seq, v_word.id, jsonb_build_object('type', 'typing_challenge', 'prompt', v_word.translation))
      returning id into v_question_id;
      insert into public.game_question_answers (game_question_id, correct_answer)
      values (v_question_id, jsonb_build_object('answer', v_word.word));
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

-- One-line generalization: the pairs branch's point value was a
-- hardcoded 10 (Matching/Memory Challenge's constant). BeeHive Recall
-- wants 1 point per word, read from the question payload it sets;
-- everything else -- the resubmission guard, the exact
-- lower(trim(both from ...)) comparison (case-insensitive, accent-
-- sensitive, no fuzzy matching -- the spelling policy that already
-- applies to every game), scoring into game_session_participants -- is
-- completely unchanged.
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
    v_points := case when v_is_correct then coalesce((v_question_payload->>'pointsPerCorrect')::int, 10) else 0 end;
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

-- game_end_session (mastery update), class_word_stats, and
-- teacher_dashboard_stats all already union in any question_payload
-- with a 'pairs' key (added for Matching/Memory Challenge) -- BeeHive
-- Recall's questions carry the same key, so every one of those keeps
-- working unmodified: the Adaptive Review Engine updates mastery_score
-- for recalled/forgotten words exactly like any other game, and "most
-- missed words" on the Statistics dashboards picks up BeeHive Recall
-- answers automatically. Nothing to change in any of them.
