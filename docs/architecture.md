# BeeLingo — Architecture

## Product philosophy

BeeLingo has a single objective: **help students memorize vocabulary
through repetition, collaboration, and fun classroom games.** Every
feature must serve that directly — if it doesn't, it doesn't belong.

The center of the application is **the Hive** — the shared vocabulary
collection for a class, not a dashboard. Students contribute to it,
teachers enrich it, games are generated from it, statistics are computed
from it, and exports are generated from it. Everything revolves around
the Hive.

There is no AI/LLM anywhere in the product, no curriculum or lesson
planning, no attendance, homework, calendar, or messaging. Keep it
lightweight, fast, simple, and playful without being childish.

## Stack

React · TypeScript · Vite · Tailwind CSS · shadcn/ui · Supabase (Postgres,
Auth, Realtime, Storage, Edge Functions) · DeepL Free API (translation) ·
Wikidata Lexeme API (lexical enrichment) · Tesseract.js (client-side OCR) ·
TanStack Query · React Hook Form + Zod · Recharts · Framer Motion · Vercel

## Repo structure

```
src/
  components/   shared UI (shadcn primitives, layout shells, theme)
  routes/       route components, split by /t (teacher) and /s (student)
  features/
    classes/      class CRUD, roster, class code, QR
    hive/          the vocabulary Hive: bank, contributions, ocr-import, export
    games/         game-type selector, source-filter picker, host/play/leaderboard
    dashboard-teacher/
    dashboard-student/
  lib/          Supabase client, TanStack Query client, utilities
  hooks/        cross-feature hooks
supabase/
  migrations/   SQL schema + RLS policies
  functions/
    _shared/enrichment/   DeepL + Wikidata wrappers (server-only, keys never client-side)
    _shared/hive/         shared dedup-or-create logic (upsertHiveWord)
    hive-add-word/        teacher manual word entry
    hive-contribute/      student contribution
    hive-ocr-import/      OCR-imported batch
    hive-translate-retry/ manual re-translate when DeepL failed/unset
    game-start/           deterministic question generation
    game-submit-answer/   server-side scoring + learning-status update
```

Teacher routes (`/t/*`) are desktop-first and auth-gated via Supabase Auth
(email/password). Student routes (`/s/*`) are mobile-first and gated by a
device-bound Supabase Anonymous Auth session obtained via the class-code
join flow at `/join` — no email, password, or account creation.

**Navigation is deliberately shallow.** Teacher top-level nav is just
*Dashboard* and *Classes* — the Hive, Games, Statistics, and Export for a
given class live inside that class's own workspace (tabs: Hive / Students
/ Games / Statistics), since none of them make sense outside the context
of one class. Student bottom nav is 3 items — *Home*, *Hive*, *Game* — with
"My Contributions" as a view inside the Hive page and Export reachable as
an action from Home or the Hive, rather than every dashboard section
becoming its own nav destination.

`Class` is the top-level teacher-owned entity; there is no course or
curriculum layer above it.

## Database schema (Postgres/Supabase, RLS on every table)

**`languages`** — 15-row seed table (English, Portuguese (Brazil),
Portuguese (Portugal), Spanish, French, German, Italian, Dutch, Japanese,
Korean, Chinese Simplified, Chinese Traditional, Russian, Arabic, Hindi),
with `deepl_source_code` / `deepl_target_code` (DeepL's source vs. target
code sets aren't 1:1, e.g. plain `EN` as source but `EN-GB`/`EN-US` as
target).

**`teachers`** — `id` (= `auth.users.id`), `email`, `display_name`,
`created_at`.

**`classes`** — top-level, no course above it: `id`, `teacher_id`, `name`,
`class_code` unique, **`learning_language_id`** (the language being
learned), **`display_language_id`** (what translations show in, default
English), `created_at`, `archived_at` nullable.

**`class_students`** (roster) — `id`, `class_id`, `display_name`,
`joined_at`, `is_active`.

**`student_devices`** — links a Supabase Anonymous Auth session to a
roster entry (`auth_user_id` ↔ `class_student_id`).

**`hive_words`** (the Hive — heart of the app) — `id`, `class_id`, `word`,
`translation` nullable, `word_type` nullable, `gender` nullable, `plural`
nullable, `teacher_notes` nullable, `practice_sentence` nullable,
`teacher_audio_path` nullable, **`tags text[] default '{}'`**,
**`learning_status`** enum(`learning` default /`mastered`/`difficult`),
`added_by` enum(`teacher`/`student`), `added_by_class_student_id` nullable
FK, `verified_by_teacher` boolean default false, `created_at`,
`translation_source` enum(`deepl`/`manual`/`none`), `translated_at`
nullable, `lexical_source` enum(`wikidata`/`none`), `lexical_fetched_at`
nullable, `enrichment_status` enum(`pending`/`success`/`partial`/`failed`).
**Unique `(class_id, lower(word))`** — the merge-on-duplicate key.

Tags are a plain `text[]` column rather than a separate tags table — at
classroom scale, `SELECT DISTINCT unnest(tags) FROM hive_words WHERE
class_id = $1` cheaply answers "what tags exist in this class" for filter
UIs, without the extra join a dedicated tags table would need.

**`hive_contributions`** (ledger) — `id`, `hive_word_id`,
`class_student_id`, `contributed_at`, `is_first_contribution` boolean.
Contribution counts are derived (`count(*) group by hive_word_id`), not
cached — one source of truth at classroom scale.

**`game_sessions`** — `id`, `class_id`, `teacher_id`, `game_type`
enum(matching/flashcards/speed_translation/reverse_translation/
typing_challenge/memory_challenge/fill_in_blank/team_battle),
**`word_set_filter`** enum(`today`/`random`/`entire_hive`/`by_tag`/
`difficult`/`unmastered`), `status`
enum(waiting/active/completed/cancelled), `settings` jsonb (holds the
chosen tag(s) when `word_set_filter = 'by_tag'`, plus question_count,
seconds_per_question, team_count, etc.), `started_at`, `ended_at`.

**`game_session_participants`** — `id`, `game_session_id`,
`class_student_id`, `team` nullable (Team Battle only), `score`,
`correct_count`, `incorrect_count`, `joined_at`, `last_seen_at`.

**`game_questions`** — `id`, `game_session_id`, `sequence_index`,
`hive_word_id`, `question_payload` jsonb (never includes the correct
answer).

**`game_answers`** — `id`, `game_question_id`,
`game_session_participant_id`, `submitted_answer`, `is_correct`
(server-computed only), `response_time_ms`, `answered_at`.

**`student_activity_days`** — `(class_student_id, activity_date)` PK pair,
upserted (`ON CONFLICT DO NOTHING`) from `game-submit-answer` and
`hive-contribute`; backs the learning-streak stat cheaply without
scanning large event tables.

**Confirmed to not exist, by design**: `courses`, `lessons`,
`lesson_vocab_suggestions`, `lesson_activities`, `attendance`, `homework`,
any calendar/events table, any messaging table, any AI/prompt/provider
table. None of these were ever built; they are not part of this product.

### RLS

Two `security definer` helpers, reused across table and Storage policies:
`is_class_teacher(class_id)` and `is_class_member(class_id)`. Students
never get direct insert rights on score-bearing tables (`game_answers`) —
those routes go through Edge Functions using the service role after
server-side validation.

### Storage — `teacher-audio` bucket (private)

Path: `{class_id}/{hive_word_id}/audio.webm` (fixed name, re-record =
upsert, no orphaned files). Teacher: insert/update/delete where
`is_class_teacher`. Student: select-only where `is_class_member`, via
short-lived signed URLs.

## Enrichment service (not AI)

`supabase/functions/_shared/enrichment/`:
- `translateWord.ts` — DeepL wrapper. Translates a brand-new word exactly
  once; result is stored permanently on the `hive_words` row and never
  re-fetched. If DeepL fails or the free-tier quota (500,000 chars/month)
  is exhausted, the row is still created with `translation = null` and the
  teacher can enter it manually or retry later — creation is never
  blocked.
- `lookupLexicalInfo.ts` — Wikidata Lexeme API wrapper
  (`wbsearchentities` → `wbgetentities`), fetching word type, gender, and
  plural where available. Missing fields stay blank and teacher-editable.
- `enrichNewWord.ts` — orchestrator, runs both via `Promise.allSettled`,
  derives `enrichment_status`.

Deliberately **not** a swappable-provider abstraction — DeepL and Wikidata
are fixed, non-interchangeable APIs, so that indirection would be pure
overhead.

`supabase/functions/_shared/hive/upsertHiveWord.ts` is the single shared
dedup-or-create implementation, called by every word-creation Edge
Function (`hive-contribute`, `hive-add-word`, `hive-ocr-import`) so
merge-on-duplicate logic exists in exactly one place. Enrichment only
fires on the "brand-new row" branch; a duplicate submission only inserts a
`hive_contributions` row.

## OCR import

Client-side only, via `tesseract.js`'s Web Worker — off the main thread.
Language pack lazy-loaded per the class's learning language from
Tesseract's default CDN, browser-cached after first use; never bundled.
Flow: teacher uploads a photo of a vocabulary list → OCR extracts text →
tokenize into candidate words → review UI (checklist + editable text per
candidate) → confirmed set posts to `hive-ocr-import`, which runs through
the same `upsertHiveWord` + `enrichNewWord` pipeline as any other word
source. OCR only ever imports a flat word list — never curriculum.

## Teacher audio

Browser `MediaRecorder` API (native, no dependency) → `audio/webm;
codecs=opus` with an `audio/mp4` fallback for Safari → direct
authenticated upload to `teacher-audio` at the fixed path. No
AI-generated or synthesized pronunciation anywhere — only real teacher
recordings, for pronunciation or a practice sentence. Students see a play
button only when a recording exists; otherwise it's simply absent.

## Games engine

Live, synchronized, Kahoot-style:

| Concern | Primitive |
|---|---|
| Waiting room / connected roster | **Presence** |
| Synchronized start, question push, timer sync | **Broadcast** |
| Live leaderboard | **Postgres Changes** on `game_session_participants` |

Question generation is 100% deterministic, computed in `game-start` from
`hive_words` — never AI:

1. **Word-source filter** — the teacher picks one: **Today's Words**,
   **Random**, **Entire Hive**, **Specific Tags**, **Difficult Words**, or
   **Unmastered Words** (`learning_status != 'mastered'`).
2. **Game-type eligibility filter** on top (e.g. Fill in the Blank
   requires a non-null `practice_sentence`).
3. **Per-question payload**: multiple-choice types (Speed Translation,
   Reverse Translation) sample 3 distractors via `ORDER BY random()` from
   the same class's Hive; Typing Challenge grades free text server-side,
   case-insensitively; Fill in the Blank masks the target word in its
   `practice_sentence`; Matching/Memory Challenge batch N pairs per round;
   Flashcards are ungraded self-paced review.

If the eligible word count after both filters falls below a configurable
minimum (default 4–5), `game-start` rejects before creating the session,
and the teacher UI surfaces the shortfall up front.

**Team Battle**: `game_session_participants.team` is populated only for
this mode; the teacher manually assigns teams or triggers a shuffle-based
auto-balance at start; the leaderboard aggregates by team when present.

**Scoring**: `game-submit-answer` resolves the real answer server-side
from `game_questions`, never trusts a client-claimed correctness, computes
`is_correct` and a score delta, writes `game_answers`, and updates
`game_session_participants.score` — driving the live leaderboard for
everyone via Postgres Changes.

**Learning status auto-update** (tunable MVP heuristic, always
teacher-overridable): after each answer is recorded, look at that word's
most recent answers across the whole class — 3 most recent all correct →
`mastered`; 2 most recent both incorrect → `difficult`; otherwise
`learning`.

## Statistics

**Teacher**: Total Hive Words, New Words This Week, Top Contributors,
Most Missed Words, Game History, Average Accuracy.

**Student**: Games Played, Accuracy, Contributions, Words Learned,
Learning Streak.

- **Cheap live queries**: most of the above are direct aggregates.
- **Small views/RPCs**: `class_top_contributors(class_id)`,
  `hive_word_miss_stats(hive_word_id, class_id, times_asked,
  times_missed, miss_rate)`.
- **Learning Streak**: backed by `student_activity_days` — a trivial RPC
  walking a tiny per-student table backward from today.
- **Words Learned** (student stat): distinct `hive_words` the student has
  contributed **or** answered correctly at least once.

## Export

Fully client-side, no new Edge Functions. CSV is hand-rolled; Excel via
`xlsx` (SheetJS); PDF via `jspdf` + `jspdf-autotable` — both dynamically
imported so they only load when a role's export panel opens. Filters:
Entire Hive, Today's Words, This Week, By Tag, My Contributions (student
only) — all reuse each role's existing RLS-scoped reads.

## Milestone plan

- **M0/M1** — Bootstrap / scaffold. **Done.**
- **M2** — Core schema + teacher auth.
- **M3** — Class CRUD + roster + class code + QR + per-class workspace
  shell (Hive / Students / Games / Statistics tabs).
- **M4** — Student join flow (Anonymous Auth + device recognition).
- **M5** — Hive core: manual word entry + enrichment pipeline, tags,
  learning status (manual), edit/verify UI.
- **M6** — OCR import.
- **M7** — Student contributions ("My Contributions" view inside the Hive).
- **M8** — Teacher audio recording.
- **M9** — Games engine: all 8 types, all 6 word-source filters, live
  leaderboard, Team Battle, automatic learning-status updates.
- **M10** — Statistics dashboards.
- **M11** — Export (CSV/XLSX/PDF).
- **M12** — Polish & deploy.

Each milestone is independently demoable.
