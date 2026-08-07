-- The Hive: the shared vocabulary collection for a class, and the
-- product's actual center (see docs/architecture.md). Enum-like fields
-- use plain text + check constraints rather than Postgres enums,
-- consistent with the rest of this schema -- easier to extend later
-- without an ALTER TYPE.
create table if not exists public.hive_words (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,

  word text not null,
  translation text,
  word_type text,
  gender text,
  plural text,
  practice_sentence text,
  teacher_notes text,
  teacher_audio_path text, -- Storage object path, populated in M8
  topic text,

  source text not null check (source in ('student', 'teacher', 'ocr')),
  added_by_class_student_id uuid references public.class_students (id) on delete set null,

  verified boolean not null default false,
  verified_at timestamptz,

  -- Adaptive Review Engine state. Internal only -- never rendered in any
  -- UI, label, filter, or export (see docs/architecture.md). Games (M9)
  -- read and update this; nothing else should.
  mastery_score real not null default 0.5,

  -- Enrichment bookkeeping ("translate once, cache forever").
  translation_source text not null default 'none' check (translation_source in ('deepl', 'manual', 'none')),
  translated_at timestamptz,
  lexical_source text not null default 'none' check (lexical_source in ('wikidata', 'none')),
  lexical_fetched_at timestamptz,
  enrichment_status text not null default 'pending' check (enrichment_status in ('pending', 'success', 'partial', 'failed')),

  created_at timestamptz not null default now()
);

-- Merge-on-duplicate key: case-insensitive uniqueness per class. An
-- expression index, since (class_id, word) alone wouldn't catch
-- "Casa" vs "casa".
create unique index if not exists hive_words_class_word_unique
  on public.hive_words (class_id, lower(word));

create index if not exists hive_words_class_id_idx on public.hive_words (class_id);
create index if not exists hive_words_topic_idx on public.hive_words (class_id, topic);

alter table public.hive_words enable row level security;

-- Teacher: full CRUD on their own classes' Hive.
create policy "teachers can view their class hive"
  on public.hive_words for select
  using (public.is_class_teacher(class_id));

create policy "teachers can add hive words"
  on public.hive_words for insert
  with check (public.is_class_teacher(class_id));

create policy "teachers can edit hive words"
  on public.hive_words for update
  using (public.is_class_teacher(class_id))
  with check (public.is_class_teacher(class_id));

create policy "teachers can delete hive words"
  on public.hive_words for delete
  using (public.is_class_teacher(class_id));

-- Students: read-only for now. Student-authored contributions go
-- through a controlled merge-on-duplicate path in M7, not a direct
-- insert -- so no student insert policy yet.
create policy "students can view their class hive"
  on public.hive_words for select
  using (
    public.is_class_member(class_id)
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = true
  );
