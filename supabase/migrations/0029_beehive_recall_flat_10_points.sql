-- BeeHive Recall now scores 10 points per correct word instead of 1,
-- matching every other game's flat 10 (set in 0028, after removing the
-- old speed-bonus formula). Rather than just changing the number,
-- this drops the 'pointsPerCorrect' key from BeeHive Recall's payload
-- entirely -- game_submit_answer's pairs branch already defaults to 10
-- via coalesce(..., 10) when the key is absent, which is exactly what
-- Matching/Memory Challenge rely on. So this fully collapses BeeHive
-- Recall onto the identical scoring path those already use, with zero
-- special-casing left anywhere for points -- one less thing to keep in
-- sync if the shared default ever changes again.
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
    -- board, then submit one guess per word) -- and now the exact same
    -- 10-points-per-correct scoring too, via game_submit_answer's
    -- pairs-branch default (no pointsPerCorrect override anymore).
    -- `pairs` here carries just {wordId, word}; no translation is ever
    -- shown or graded.
    select jsonb_agg(jsonb_build_object('wordId', id, 'word', word)) into v_pairs from tmp_selected;
    select jsonb_object_agg(id::text, word) into v_answer_map from tmp_selected;

    insert into public.game_questions (game_session_id, sequence_index, hive_word_id, question_payload)
    values (
      v_session_id, 0, null,
      jsonb_build_object(
        'type', 'beehive_recall',
        'pairs', v_pairs,
        'displaySeconds', coalesce((p_settings->>'displaySeconds')::int, 8),
        'answerSeconds', coalesce((p_settings->>'answerSeconds')::int, 30)
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
