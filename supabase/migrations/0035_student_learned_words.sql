-- Personal "I've learned this word" checklist on the student's Whole
-- Hive tab -- one row per (class_student_id, hive_word_id) means
-- learned, deleting the row means not learned. Same presence-based
-- pattern already used for word_contributions/is_first_contribution:
-- no boolean column needed, the row's existence is the fact.
--
-- Deliberately private and self-contained:
--   - Not readable by the teacher side (no teacher SELECT policy) --
--     this is a personal checklist, not a new class-wide report.
--   - Not read by anything in the game engine (word selection,
--     scoring, mastery). A student marking a word "learned" here has
--     zero effect on quiz behavior -- purely a self-reported checkbox.
create table if not exists public.student_learned_words (
  id uuid primary key default gen_random_uuid(),
  class_student_id uuid not null references public.class_students (id) on delete cascade,
  hive_word_id uuid not null references public.hive_words (id) on delete cascade,
  learned_at timestamptz not null default now(),
  unique (class_student_id, hive_word_id)
);

create index if not exists student_learned_words_class_student_id_idx
  on public.student_learned_words (class_student_id);
create index if not exists student_learned_words_hive_word_id_idx
  on public.student_learned_words (hive_word_id);

alter table public.student_learned_words enable row level security;

-- Plain RLS (not a SECURITY DEFINER RPC like contribute_word) is enough
-- here -- there's no merge-on-duplicate logic to protect, just a
-- straightforward "this row belongs to me" check, same discipline as
-- migration 0033's student hive_words UPDATE/DELETE policies.
create policy "students can view their own learned words"
  on public.student_learned_words for select
  using (class_student_id = public.current_class_student_id());

create policy "students can mark their own learned words"
  on public.student_learned_words for insert
  with check (class_student_id = public.current_class_student_id());

create policy "students can unmark their own learned words"
  on public.student_learned_words for delete
  using (class_student_id = public.current_class_student_id());
