# BeeLingo — Architecture

## Product philosophy

BeeLingo is **not** an AI teaching assistant. It's a collaborative classroom
vocabulary platform: teachers and students build a shared vocabulary bank
together, and that bank deterministically powers classroom games. No LLM,
no AI-generated content, anywhere in the product. Keep it lightweight,
fast, and simple — avoid over-engineering.

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
  features/     feature-first modules (classes, vocabulary, games, dashboards)
  lib/          Supabase client, TanStack Query client, utilities
  hooks/        cross-feature hooks
supabase/
  migrations/   SQL schema + RLS policies
  functions/    Edge Functions
    _shared/enrichment/   DeepL + Wikidata wrappers (server-only, key never client-side)
    _shared/vocab/        shared dedup-or-create logic (upsertVocabWord)
```

Teacher routes (`/t/*`) are desktop-first and auth-gated via Supabase Auth
(email/password). Student routes (`/s/*`) are mobile-first and gated by a
device-bound Supabase Anonymous Auth session obtained via the class-code
join flow at `/join` — no email, password, or account creation. `Class` is
the top-level teacher-owned entity; there is no course/curriculum layer
above it.

## Database schema (Postgres/Supabase, RLS on every table)

**`languages`** — 15-row seed table (English, Portuguese (Brazil),
Portuguese (Portugal), Spanish, French, German, Italian, Dutch, Japanese,
Korean, Chinese Simplified, Chinese Traditional, Russian, Arabic, Hindi).
Columns include `deepl_source_code` / `deepl_target_code`, since DeepL's
source vs. target code sets aren't 1:1 (e.g. plain `EN` as source but
`EN-GB`/`EN-US` as target).

**`teachers`** — `id` (= `auth.users.id`), `email`, `display_name`,
`created_at`.

**`classes`** — top-level, no course above it: `id`, `teacher_id`, `name`,
`class_code` unique, `target_language_id`, `native_language_id` (default
English), `created_at`, `archived_at` nullable (soft-delete, preserves
stats history).

**`class_students`** (roster) — `id`, `class_id`, `display_name`,
`joined_at`, `is_active`.

**`student_devices`** — links a Supabase Anonymous Auth session to a
roster entry (`auth_user_id` ↔ `class_student_id`).

**`vocabulary_bank`** (heart of the app) — `id`, `class_id`, `word`,
`translation` nullable, `word_type` nullable, `gender` nullable, `plural`
nullable, `teacher_notes` nullable, `practice_sentence` nullable,
`teacher_audio_path` nullable, `added_by` enum(`teacher`/`student`),
`added_by_class_student_id` nullable FK, `verified_by_teacher` boolean
default false, `created_at`, `translation_source`
enum(`deepl`/`manual`/`none`), `translated_at` nullable, `lexical_source`
enum(`wikidata`/`none`), `lexical_fetched_at` nullable, `enrichment_status`
enum(`pending`/`success`/`partial`/`failed`). **Unique `(class_id,
lower(word))`** — the merge-on-duplicate key.

**`vocabulary_contributions`** (ledger) — `id`, `vocabulary_bank_id`,
`class_student_id`, `contributed_at`, `is_first_contribution` boolean.
Contribution counts are derived (`count(*) group by vocabulary_bank_id`),
not cached — one source of truth at classroom scale.

**`game_sessions`** — `id`, `class_id`, `teacher_id`, `game_type`
enum(matching/flashcards/speed_translation/reverse_translation/
typing_challenge/memory_challenge/fill_in_blank/team_battle),
`word_set_filter` enum(today/last_week/random/entire_bank), `status`
enum(waiting/active/completed/cancelled), `settings` jsonb, `started_at`,
`ended_at`.

**`game_session_participants`** — `id`, `game_session_id`,
`class_student_id`, `team` nullable (Team Battle only), `score`,
`correct_count`, `incorrect_count`, `joined_at`, `last_seen_at`.

**`game_questions`** — `id`, `game_session_id`, `sequence_index`,
`vocabulary_bank_id`, `question_payload` jsonb (never includes the correct
answer).

**`game_answers`** — `id`, `game_question_id`,
`game_session_participant_id`, `submitted_answer`, `is_correct`
(server-computed only), `response_time_ms`, `answered_at`.

**`student_activity_days`** — `(class_student_id, activity_date)` PK pair,
upserted (`ON CONFLICT DO NOTHING`) from `game-submit-answer` and
`vocab-contribute`; backs the learning-streak stat cheaply without
scanning large event tables.

No `courses`, `lessons`, `lesson_vocab_suggestions`, `lesson_activities`,
`attendance`, or any AI/prompt/provider tables exist in this design.

### RLS

Two `security definer` helpers, reused across table and Storage policies:
`is_class_teacher(class_id)` and `is_class_member(class_id)`. Students
never get direct insert rights on score-bearing tables (`game_answers`) —
those routes go through Edge Functions using the service role after
server-side validation.

### Storage — `teacher-audio` bucket (private)

Path: `{class_id}/{vocabulary_bank_id}/audio.webm` (fixed name, re-record
= upsert, no orphaned files). Teacher: insert/update/delete where
`is_class_teacher`. Student: select-only where `is_class_member`, via
short-lived signed URLs.

## Enrichment service (not AI)

`supabase/functions/_shared/enrichment/`:
- `translateWord.ts` — DeepL wrapper. Translates a brand-new word exactly
  once; result is stored permanently on the `vocabulary_bank` row and
  never re-fetched. If DeepL fails or the free-tier quota (500,000
  chars/month) is exhausted, the row is still created with
  `translation = null` and the teacher can enter it manually or retry
  later — creation is never blocked.
- `lookupLexicalInfo.ts` — Wikidata Lexeme API wrapper
  (`wbsearchentities` → `wbgetentities`), fetching word type, gender, and
  plural where available. Missing fields stay blank and teacher-editable.
- `enrichNewWord.ts` — orchestrator, runs both via `Promise.allSettled`
  (independent failures don't block each other), derives
  `enrichment_status`.

Deliberately **not** a swappable-provider abstraction (unlike a typical AI
layer) — DeepL and Wikidata are fixed, non-interchangeable APIs, so that
indirection would be pure overhead.

`supabase/functions/_shared/vocab/upsertVocabWord.ts` is the single shared
dedup-or-create implementation, called by every word-creation Edge
Function (`vocab-contribute`, `vocab-create-manual`, `vocab-ocr-import`)
so merge-on-duplicate logic exists in exactly one place. Enrichment only
fires on the "brand-new row" branch; a duplicate submission only inserts a
`vocabulary_contributions` row and increments the derived count.

## OCR import

Client-side only, via `tesseract.js`'s Web Worker (`createWorker`) — off
the main thread. Language pack lazy-loaded per the class's target
language from Tesseract's default CDN, browser-cached after first use;
never bundled into the app build. Flow: photo → OCR → tokenize into
candidate words → review UI (checklist + editable text per candidate,
since OCR misreads are common) → confirmed set posts to
`vocab-ocr-import`, which runs through the same `upsertVocabWord` +
`enrichNewWord` pipeline as any other word source. OCR is only ever used
to import a flat word list — never for curriculum or lesson extraction.

## Teacher audio

Browser `MediaRecorder` API (native, no dependency) → `audio/webm;
codecs=opus` with an `audio/mp4` fallback for Safari → direct
authenticated upload to `teacher-audio` at the fixed path (RLS-enforced,
`upsert: true`). No AI-generated or synthesized pronunciation anywhere —
only real teacher recordings. Students see a play button only when a
recording exists; otherwise it's simply absent.

## Games engine

Live, synchronized, Kahoot-style — reuses Supabase Realtime the same way
regardless of game type:

| Concern | Primitive |
|---|---|
| Waiting room / connected roster | **Presence** |
| Synchronized start, question push, timer sync | **Broadcast** |
| Live leaderboard | **Postgres Changes** on `game_session_participants` |

Question generation is 100% deterministic, computed in `game-start` from
`vocabulary_bank` — never AI:

1. **Word-set filter**: Today's Words / Last Week / Random / Entire Bank.
2. **Game-type eligibility filter** on top (e.g. Fill in the Blank
   requires a non-null `practice_sentence`).
3. **Per-question payload**: multiple-choice types (Speed Translation,
   Reverse Translation) sample 3 distractors via `ORDER BY random()` from
   the same class's bank; Typing Challenge grades free text server-side,
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
`game_session_participants.score` — which is what drives the Postgres
Changes leaderboard for everyone.

## Statistics

- **Cheap live queries**: Vocabulary Collected, Recent Games, Average
  Accuracy, Games Played, Accuracy, Contributions.
- **Small views/RPCs**: `class_top_contributors(class_id)`,
  `vocabulary_miss_stats(vocabulary_bank_id, class_id, times_asked,
  times_missed, miss_rate)`.
- **Learning Streak**: backed by `student_activity_days` — a trivial RPC
  walking a tiny per-student table backward from today.
- **Vocabulary Learned** (student stat): distinct `vocabulary_bank` rows
  the student has contributed **or** answered correctly at least once.

## Export

Fully client-side, no new Edge Functions. CSV is hand-rolled (no
dependency); Excel via `xlsx` (SheetJS); PDF via `jspdf` +
`jspdf-autotable` — both dynamically imported so they only load when a
role's export panel opens. Filters (entire vocabulary / today / last week
/ my contributions) reuse each role's existing RLS-scoped reads. "My
contributions" (student-only) = any `vocabulary_bank` row the student has
a ledger row against, first or reinforcing.

## Milestone plan

- **M0/M1** — Bootstrap / scaffold. **Done.**
- **M2** — Core schema + teacher auth.
- **M3** — Class CRUD + roster + class code + QR.
- **M4** — Student join flow (Anonymous Auth + device recognition).
- **M5** — Vocabulary bank core: manual entry + enrichment pipeline.
- **M6** — OCR import.
- **M7** — Student vocabulary contributions.
- **M8** — Teacher audio recording.
- **M9** — Games engine (all 8 types, live leaderboard, Team Battle).
- **M10** — Statistics dashboards.
- **M11** — Export (CSV/XLSX/PDF).
- **M12** — Polish & deploy.

Each milestone is independently demoable.
