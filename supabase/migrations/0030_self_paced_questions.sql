-- Self-paced question reveal: previously every multi-question game
-- (speed_translation, reverse_translation, typing_challenge,
-- fill_in_blank, team_battle) was host-paced -- the whole class only
-- ever saw up to game_sessions.current_question_index, which only
-- moved when the teacher clicked "Next question". Students now reveal
-- their own next question the moment THEY answer the current one,
-- independent of classmates -- a race, not a synchronized quiz.
--
-- The reveal check becomes "sequence_index <= greatest(the session's
-- shared index, how many DISTINCT questions this student has already
-- answered in this session)". That greatest() keeps every other game
-- type working unchanged:
--   - Matching/Memory Challenge/BeeHive Recall: one question row,
--     answering pairs doesn't raise the count past what's already
--     revealed (sequence_index 0 <= 0 the whole time) -- session index
--     alone continues to gate them exactly as before.
--   - Flashcards: current_question_index is already set to the max at
--     creation (reveal-everything), so the self-paced term never needs
--     to contribute anything there either.
--   - The 5 self-paced types: current_question_index just stays 0
--     forever now (nothing calls game_advance_question for them
--     anymore), and the student's own answered-count does all the
--     revealing -- exactly the mechanism this migration adds.
--
-- The "how many has this student answered" count only ever reflects
-- game_answers rows created through the real, server-graded
-- game_submit_answer RPC -- there's no client-controllable state here
-- to spoof; a student can't reveal question N+1 without having
-- actually gotten graded on question N first.
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
          coalesce((
            select count(distinct ga.game_question_id)
            from public.game_answers ga
            join public.game_session_participants gsp on gsp.id = ga.game_session_participant_id
            where gsp.game_session_id = gs.id
              and gsp.class_student_id = public.current_class_student_id()
          ), 0)
        )
    )
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = true
  );

-- game_create_session now also persists the *actual* question count
-- (v_seq -- can be less than the requested questionCount if the Hive
-- pool was smaller) into settings, so a student's client can know
-- "how many questions total" without that requiring exposing the
-- questions themselves ahead of being revealed -- needed so a
-- self-paced student's UI can tell "I've finished all of them" apart
-- from "waiting for the next one to unlock". Every other line is
-- byte-for-byte the same as 0029.
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

  update public.game_sessions
    set settings = settings || jsonb_build_object('totalQuestions', v_seq)
    where id = v_session_id;

  return jsonb_build_object('sessionId', v_session_id, 'questionCount', v_seq);
end;
$$;

grant execute on function public.game_create_session(uuid, text, text, jsonb) to authenticated;
