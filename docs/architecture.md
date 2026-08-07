# BeeLingo — Architecture

## Product philosophy

BeeLingo has a single objective: **help students memorize vocabulary
through repetition, collaboration, and fun classroom games.** Every
feature must serve that directly — if it doesn't, it doesn't belong.

A second, standing principle guides every design decision below:
**every automation should reduce teacher workload.** DeepL reduces
translation work. Wikidata reduces grammatical lookup. Tesseract.js
reduces typing. The adaptive review engine (see below) reduces lesson
prep by quietly deciding which words need more practice — the teacher
never manages difficulty by hand. If a feature would create more work
than it saves, it's the wrong design.

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
    _shared/mastery/      adaptive review engine's EMA update (pure function)
    hive-add-word/        teacher manual word entry
    hive-contribute/      student contribution
    hive-ocr-import/      OCR-imported batch
    hive-translate-retry/ manual re-translate when DeepL failed/unset
    game-start/           deterministic, mastery-weighted question generation
    game-submit-answer/   server-side scoring
    game-end/             session completion + adaptive mastery update
```

Teacher routes (`/t/*`) are desktop-first and auth-gated via Supabase Auth
(email/password). Student routes (`/s/*`) are mobile-first and gated by a
device-bound Supabase Anonymous Auth session obtained via the class-code
join flow at `/join` — no email, password, or account creation.

**Navigation is deliberately shallow.** Teacher top-level nav is just
*Dashboard* and *Classes* — the Hive, Games, Statistics, and Export for a
given class live inside that class's own workspace, since none of them
make sense outside the context of one class. Student bottom nav is 3
items — *Home*, *Hive*, *Game* — with "My Contributions" as a view inside
the Hive page and Export reachable as an action from Home or the Hive.

`Class` is the top-level teacher-owned entity; there is no course or
curriculum layer above it.

## Database schema (Postgres/Supabase, RLS on every table)

**`languages`** — 15-row seed table, with `deepl_source_code` /
`deepl_target_code` (DeepL's source vs. target code sets aren't 1:1).

**`teachers`** — `id` (= `auth.users.id`), `email`, `display_name`,
`created_at`.

**`classes`** — top-level, no course above it: `id`, `teacher_id`, `name`,
`class_code` unique, `learning_language_id` (the language being learned),
`display_language_id` (what translations show in, default English),
`created_at`, `archived_at` nullable.

**`class_students`** (roster) — `id`, `class_id`, `display_name`,
`joined_at`, `is_active`.

**`student_devices`** — links a Supabase Anonymous Auth session to a
roster entry (`auth_user_id` ↔ `class_student_id`).

**`hive_words`** (the Hive — heart of the app):

| field | notes |
|---|---|
| `word` | in the class's learning language |
| `translation` | nullable until enrichment/manual entry completes |
| `word_type` | nullable |
| `gender` | nullable, only when applicable |
| `plural` | nullable |
| `practice_sentence` | nullable, teacher-authored, powers Fill in the Blank |
| `teacher_notes` | nullable |
| `teacher_audio_path` | nullable, Storage object path |
| `topic` | nullable, one optional topic per word (e.g. "Food," "Unit 1") |
| `source` | enum `student` / `teacher` / `ocr` — **how** the word entered the Hive |
| `added_by_class_student_id` | nullable FK, populated only when `source = 'student'` — **who** added it. "Added By" in the UI shows that student's name, or simply "Teacher" when `source` is `teacher`/`ocr` |
| `created_at` | "Date Added" |
| `verified` | boolean default false |
| `verified_at` | timestamptz nullable, set/cleared together with `verified` |
| `mastery_score` | real, default **0.5**, **internal only — see Adaptive Review Engine, never rendered in any UI** |
| `translation_source`, `translated_at`, `lexical_source`, `lexical_fetched_at`, `enrichment_status` | internal bookkeeping for the enrichment pipeline, not user-facing fields |

**Unique `(class_id, lower(word))`** — the merge-on-duplicate key. Topic
is a plain nullable column rather than a tags array/table — at classroom
scale, `SELECT DISTINCT topic FROM hive_words WHERE class_id = $1 AND
topic IS NOT NULL` cheaply answers "what topics exist in this class" for
filter UIs.

**`word_contributions`** (activity log, *not* part of the Hive itself —
hence the name, distinct from `hive_words`) — `id`, `hive_word_id`,
`class_student_id`, `contributed_at`, `is_first_contribution` boolean.
Contribution counts are derived (`count(*) group by hive_word_id`), not
cached.

**`game_sessions`** — `id`, `class_id`, `teacher_id`, `game_type`
enum(matching/flashcards/speed_translation/reverse_translation/
typing_challenge/memory_challenge/fill_in_blank/team_battle),
`word_set_filter` enum(**`today`/`random`/`entire_hive`/`by_topic`**),
`status` enum(waiting/active/completed/cancelled), `settings` jsonb
(holds the chosen topic when `word_set_filter = 'by_topic'`, plus
question_count, seconds_per_question, team_count, etc.), `started_at`,
`ended_at`.

**`game_session_participants`** — `id`, `game_session_id`,
`class_student_id`, `team` nullable (Team Battle only), `score`,
`correct_count`, `incorrect_count`, `joined_at`, `last_seen_at`.

**`game_questions`** — `id`, `game_session_id`, `sequence_index`,
`hive_word_id`, `question_payload` jsonb (never includes the correct
answer).

**`game_answers`** — `id`, `game_question_id`,
`game_session_participant_id`, `submitted_answer`, `is_correct`
(server-computed only), `response_time_ms`, `answered_at`.

**`student_activity_days`** — `(class_student_id, activity_date)` PK
pair, upserted from `game-submit-answer` and `hive-contribute`; backs the
learning-streak stat.

**Confirmed to not exist, by design**: `courses`, `lessons`,
`lesson_vocab_suggestions`, `lesson_activities`, `attendance`, `homework`,
any calendar/events table, any messaging table, any AI/prompt/provider
table.

### RLS

Two `security definer` helpers, reused across table and Storage policies:
`is_class_teacher(class_id)` and `is_class_member(class_id)`. Students
never get direct insert rights on score-bearing tables (`game_answers`) —
those routes go through Edge Functions using the service role after
server-side validation.

### Storage — `teacher-audio` bucket (private)

Path: `{class_id}/{hive_word_id}/audio.webm` (fixed name, re-record =
upsert). Teacher: insert/update/delete where `is_class_teacher`. Student:
select-only where `is_class_member`, via short-lived signed URLs.

## Enrichment service (not AI)

`supabase/functions/_shared/enrichment/`:
- `translateWord.ts` — DeepL wrapper. Translates a brand-new word exactly
  once; result is stored permanently on the `hive_words` row and never
  re-fetched. If DeepL fails or the free-tier quota (500,000 chars/month)
  is exhausted, the row is still created with `translation = null` and
  the teacher can enter it manually or retry later.
- `lookupLexicalInfo.ts` — Wikidata Lexeme API wrapper
  (`wbsearchentities` → `wbgetentities`). Missing fields stay blank and
  teacher-editable.
- `enrichNewWord.ts` — orchestrator, `Promise.allSettled` over both,
  derives `enrichment_status`.

Deliberately **not** a swappable-provider abstraction — DeepL and
Wikidata are fixed, non-interchangeable APIs.

`supabase/functions/_shared/hive/upsertHiveWord.ts` is the single shared
dedup-or-create implementation, called by every word-creation Edge
Function (`hive-contribute`, `hive-add-word`, `hive-ocr-import`), setting
`source` appropriately (`student`/`teacher`/`ocr`) in each case. A
duplicate submission only inserts a `word_contributions` row.

## OCR import

Client-side only, via `tesseract.js`'s Web Worker. Language pack
lazy-loaded per the class's learning language, browser-cached after first
use. Flow: teacher uploads a photo of a vocabulary list → OCR extracts
text → tokenize into candidate words → review UI → confirmed set posts to
`hive-ocr-import` (`source = 'ocr'`), running through the same
`upsertHiveWord` + `enrichNewWord` pipeline as any other word source.

## Teacher audio

Browser `MediaRecorder` API → `audio/webm;codecs=opus` (Safari fallback
`audio/mp4`) → direct authenticated upload to `teacher-audio`. No
AI-generated or synthesized pronunciation anywhere — only real teacher
recordings. Students see a play button only when a recording exists.

## Adaptive Review Engine

Vocabulary difficulty is **fully backend-driven and never surfaced** —
no "Learning," "Review," or "Mastered" label ever appears to a teacher or
student. The teacher never manages word difficulty manually; the system
quietly adapts from classroom performance.

**`mastery_score`** (`hive_words.mastery_score`, real, `[0, 1]`, default
`0.5`) is the only state it needs — no history table.

**Update — once per completed game, not per answer.** When a teacher
ends a session, `game-end`:
1. Sets `game_sessions.status = 'completed'` / `ended_at`.
2. Aggregates that session's `game_answers`, grouped by `hive_word_id`,
   into `session_accuracy = correct / total` per word (across the whole
   class's answers in that session).
3. For each word touched, applies an exponential moving average via
   `supabase/functions/_shared/mastery/updateMastery.ts`:

   ```
   new_mastery = old_mastery + LEARNING_RATE × (session_accuracy − old_mastery)
   ```

   clamped to `[0, 1]`. `LEARNING_RATE` (recommended **0.35**, a tunable
   constant, not locked in) determines how strongly one session's result
   moves the score. An EMA inherently weights recent sessions more than
   older ones — each update is a step toward the latest evidence — which
   is exactly "recent results should have more influence," with no
   history table required.

**Selection — weighted, not uniform, in `game-start`.** For the eligible
word pool (after the chosen word-source filter), compute
`weight = 1.15 − mastery_score` (low mastery ⇒ higher weight; a ~0.15
floor keeps even fully-mastered words in occasional rotation) and draw
the session's questions via roulette-wheel weighted sampling **without
replacement**, in the Edge Function's own code — classroom-scale pools
(tens to low hundreds of words) make this simple and fast without
needing SQL-side weighting tricks.

## Games engine

Live, synchronized, Kahoot-style:

| Concern | Primitive |
|---|---|
| Waiting room / connected roster | **Presence** |
| Synchronized start, question push, timer sync | **Broadcast** |
| Live leaderboard | **Postgres Changes** on `game_session_participants` |

**Word-source filter** (teacher picks one, no difficulty concept
exposed):
- **Today's Words** — created today, weighted selection applied.
- **Entire Hive** — the whole class Hive, weighted selection applied.
- **By Topic** — scoped to one topic, weighted selection applied.
- **Random** — deliberately uniform sampling, weighting *not* applied —
  an explicit "just mix it up" option, distinct from the other three now
  that they're all mastery-weighted by default.

**Game-type eligibility filter** on top (e.g. Fill in the Blank requires
a non-null `practice_sentence`). If the eligible count after both filters
is below a configurable minimum (default 4–5), `game-start` rejects
before creating the session.

**Per-question payload**: multiple-choice types sample 3 distractors from
the same class's Hive; Typing Challenge grades free text server-side;
Fill in the Blank masks the target word in its `practice_sentence`;
Matching/Memory Challenge batch N pairs per round; Flashcards are
ungraded self-paced review.

**Team Battle**: `game_session_participants.team` populated only for this
mode; teacher assigns or auto-balances at start; leaderboard aggregates
by team when present.

**Scoring**: `game-submit-answer` resolves the real answer server-side,
never trusts client-claimed correctness, writes `game_answers`, updates
`game_session_participants.score` — driving the live leaderboard via
Postgres Changes. `game-end` (see Adaptive Review Engine) runs once the
teacher ends the session.

## Statistics

**Teacher**: Total Hive Words, New Words This Week, Top Contributors,
Most Missed Words, Game History, Average Accuracy.

**Student**: Games Played, Accuracy, Contributions, Words Learned,
Learning Streak.

`mastery_score` is never exposed here either — "Most Missed Words"
derives from `game_answers` miss-rate directly, keeping the internal
score truly internal.

- **Small views/RPCs**: `class_top_contributors(class_id)`,
  `hive_word_miss_stats(hive_word_id, class_id, times_asked,
  times_missed, miss_rate)`.
- **Learning Streak**: backed by `student_activity_days`.
- **Words Learned** (student stat): distinct `hive_words` the student has
  contributed **or** answered correctly at least once.

## Export

**CSV and PDF only for the MVP** — XLSX is off the roadmap. CSV
(hand-rolled, no dependency) already covers spreadsheet and flashcard-tool
(e.g. Anki) import use cases; PDF via `jspdf` + `jspdf-autotable`,
dynamically imported so it only loads when the export panel opens.
Filters: Entire Hive, Today's Words, This Week, By Topic, My
Contributions (student only) — all reuse each role's existing RLS-scoped
reads.

## Milestone plan

- **M0/M1** — Bootstrap / scaffold. **Done.**
- **M2** — Core schema + teacher auth.
- **M3** — Class CRUD + roster + class code + QR + per-class workspace
  shell (Hive / Students / Games / Statistics tabs).
- **M4** — Student join flow.
- **M5** — Hive core: manual word entry + enrichment pipeline, Topic,
  edit/verify UI, mastery score initialized at creation (no UI for it).
- **M6** — OCR import.
- **M7** — Student contributions ("My Contributions" view inside the Hive).
- **M8** — Teacher audio recording.
- **M9** — Games engine: all 8 types, the 4 word-source filters, weighted
  selection, live leaderboard, Team Battle, `game-end` + adaptive
  mastery update.
- **M10** — Statistics dashboards.
- **M11** — Export (CSV + PDF only).
- **M12** — Polish & deploy.

Each milestone is independently demoable.
