-- Games engine core tables. All question generation, scoring, and the
-- adaptive mastery update are pure DB logic (no external API calls), so
-- unlike enrich-word this entire backend is Postgres RPC functions --
-- see 0019_game_functions.sql -- unblocked by the lack of an Edge
-- Function deployment path in this environment, and arguably a better
-- fit anyway (lower latency for realtime-sensitive scoring).

create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  game_type text not null check (game_type in (
    'matching', 'flashcards', 'speed_translation', 'reverse_translation',
    'typing_challenge', 'memory_challenge', 'fill_in_blank', 'team_battle'
  )),
  word_set_filter text not null check (word_set_filter in ('today', 'random', 'entire_hive', 'by_topic')),
  status text not null default 'waiting' check (status in ('waiting', 'active', 'completed', 'cancelled')),
  settings jsonb not null default '{}'::jsonb,
  current_question_index int not null default 0,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists game_sessions_class_id_idx on public.game_sessions (class_id);

create table if not exists public.game_session_participants (
  id uuid primary key default gen_random_uuid(),
  game_session_id uuid not null references public.game_sessions (id) on delete cascade,
  class_student_id uuid not null references public.class_students (id) on delete cascade,
  team text,
  score int not null default 0,
  correct_count int not null default 0,
  incorrect_count int not null default 0,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (game_session_id, class_student_id)
);

create index if not exists game_session_participants_session_idx on public.game_session_participants (game_session_id);

create table if not exists public.game_questions (
  id uuid primary key default gen_random_uuid(),
  game_session_id uuid not null references public.game_sessions (id) on delete cascade,
  sequence_index int not null,
  hive_word_id uuid references public.hive_words (id) on delete set null,
  question_payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists game_questions_session_idx on public.game_questions (game_session_id);

-- Deliberately a SEPARATE table from game_questions, with no client-role
-- SELECT policy at all (see 0018) -- only the SECURITY DEFINER
-- game_submit_answer() function can read it. A column-level grant on
-- game_questions would work too, but a wholly separate table makes "no
-- client can ever see this" structurally obvious rather than relying on
-- remembering to exclude one column from every future query.
create table if not exists public.game_question_answers (
  game_question_id uuid primary key references public.game_questions (id) on delete cascade,
  correct_answer jsonb not null
);

create table if not exists public.game_answers (
  id uuid primary key default gen_random_uuid(),
  game_question_id uuid not null references public.game_questions (id) on delete cascade,
  game_session_participant_id uuid not null references public.game_session_participants (id) on delete cascade,
  submitted_answer jsonb,
  is_correct boolean not null,
  response_time_ms int,
  answered_at timestamptz not null default now()
);

create index if not exists game_answers_question_idx on public.game_answers (game_question_id);
create index if not exists game_answers_participant_idx on public.game_answers (game_session_participant_id);

comment on table public.game_answers is
  'One row per answer attempt. Most game types submit exactly one per question per participant; Matching/Memory Challenge (whose whole round is a single game_questions row) submit one per pair-match attempt -- so this table intentionally has no per-question-per-participant uniqueness constraint.';

-- Postgres Changes needs a table in the realtime publication to push
-- updates to subscribed clients; RLS still applies per-subscriber (see
-- 0018), so this alone doesn't broaden who can read what.
alter publication supabase_realtime add table public.game_session_participants;
