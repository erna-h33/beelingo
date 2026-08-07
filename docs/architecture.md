# Beelingo — AI Language Classroom Platform: Architecture & Build Plan

## Context

This is a greenfield project (empty directory, no git repo yet). The user provided a full MVP product spec for an AI-assisted language classroom platform with two very different user types — authenticated teachers and account-less students identified only by a class code + device — plus AI-assisted content generation, live realtime classroom games, and a collaborative vocabulary bank. The spec fixes the tech stack (React/TS/Vite/Tailwind/shadcn, Supabase, OpenAI, TanStack Query, RHF+Zod, Recharts, Vercel) but leaves several foundational technical decisions open (how student identity/RLS works, whether AI is required or optional, animation approach). This plan resolves those decisions and lays out a milestone-by-milestone build path so the first commit is architected correctly rather than reworked later. Neither Supabase nor OpenAI accounts exist yet, so Milestone 0 covers first-time setup.

## Key Decisions (confirmed with user)

1. **Student identity: Supabase Anonymous Auth.** The `student-join` Edge Function validates the class code + roster name, then the client obtains a real Supabase anonymous session (`supabase.auth.signInAnonymously()`), which is linked to a specific `class_students` row via a `student_devices.auth_user_id` column. This gives every student table a genuine `auth.uid()`-based RLS policy — the same mental model as teacher policies — plus a defense-in-depth `is_anonymous` JWT claim check so anonymous sessions can never touch teacher-only tables even under a policy mistake. Session persistence is just supabase-js's own localStorage handling — no custom token scheme needed.

2. **AI is a fully optional enhancement layer, not a dependency.** Every core workflow (course/class/lesson creation, activities, vocabulary bank, live games, leaderboards, dashboards) must work completely with **no OpenAI key configured at all** — teachers do everything manually via the same forms AI would otherwise pre-fill. This is a first-class architectural constraint, not just a rate-limit fallback:
   - Every Edge Function that calls AI checks whether `OPENAI_API_KEY` is configured; if not, it returns a typed `{ aiAvailable: false }` response instead of erroring.
   - The frontend has one shared `useAiAvailability()` hook (backed by a cheap `ai-status` Edge Function / config flag) that every AI-touching feature reads. When AI is unavailable, "Generate with AI" buttons are replaced by (or sit disabled next to) plain manual-entry forms that are otherwise identical in shape.
   - Concretely: manual curriculum/lesson/unit creation form (Milestone 5), manual activity builder per activity type (Milestone 6), manual vocab-field entry (translation/pronunciation/example/part of speech typed by the teacher, or left blank) at contribution time (Milestone 8). AI, when available, pre-fills these same forms rather than being a separate code path — this also means there's no throwaway UI once AI is later enabled.
   - When AI *is* configured, apply conservative per-class/per-teacher daily call caps with graceful degradation (store raw/unenriched data + let the teacher fill in manually) if a cap is hit — same behavior as "AI unavailable," so there's exactly one fallback path to build and test, not two.

3. **Framer Motion added to the stack** for orchestrated animations (leaderboard rank-swaps, game feedback, transitions). Everything else stays exactly as specified.

4. **Minor defaults chosen (low-stakes, revisit anytime):** teacher auth via Supabase Auth email/password (simplest, no OAuth app registration dependency); QR codes generated client-side on the fly from `class_code` (no storage needed, always in sync); curriculum-photo storage in a private Supabase Storage bucket scoped by `{teacher_id}/...` path with signed upload/read URLs; single-teacher-per-course (no co-teaching/school-admin layer) for MVP; OpenAI model names kept as env-configurable rather than hardcoded, since exact current model availability should be checked at implementation time.

## Repo Structure

Single Vite React TS app, Supabase CLI-managed `supabase/` directory alongside `src/`. Feature-first organization.

```
beelingo/
├── .env.local / .env.example
├── supabase/
│   ├── migrations/            # numbered SQL: extensions, languages seed, core tables, RLS (teacher), RLS (student), realtime publication
│   ├── seed.sql                # 15 languages + dev demo teacher
│   └── functions/
│       ├── _shared/
│       │   ├── supabaseAdmin.ts, cors.ts
│       │   ├── ai/             # AI SERVICE ABSTRACTION LAYER (server-only)
│       │   │   ├── types.ts    # AIProvider interface
│       │   │   ├── openaiProvider.ts
│       │   │   ├── promptTemplates/   # parameterized by languages.ai_locale_hints, not per-language branches
│       │   │   └── index.ts    # getAIProvider() factory + isAiConfigured()
│       │   ├── rateLimiter.ts
│       │   └── validation.ts
│       ├── student-join/, student-session-verify/
│       ├── ai-curriculum-from-image/, ai-generate-activity/, ai-regenerate-activity/, ai-enrich-vocab/, ai-status/
│       ├── game-start/, game-submit-answer/
│       └── vocab-contribute/
├── src/
│   ├── lib/{supabase,ai,deviceIdentity.ts,queryClient.ts,utils.ts}
│   ├── features/{auth,courses,classes,roster,curriculum-builder,lessons,activities,vocabulary,games/{teacher,student},attendance,dashboard-teacher,dashboard-student}
│   ├── components/{ui,charts,layout}   # TeacherShell (desktop-first), StudentShell (mobile-first)
│   ├── routes/{teacher,student}        # RequireAuth vs RequireDevice guards
│   ├── hooks/  (incl. useRealtimeChannel, useAiAvailability, useTheme)
│   └── styles/globals.css
```

**Hard rule:** all OpenAI calls live only in `supabase/functions/**`. The frontend's `lib/ai/aiClient.ts` only calls Edge Functions by name (`supabase.functions.invoke(...)`) — the API key is never bundled client-side.

## Database Schema (Postgres/Supabase, RLS enabled on every table)

- **`teachers`** (1:1 with `auth.users`), **`languages`** (seed table: 15 languages + `ai_locale_hints jsonb` driving prompt parameterization, code/name/native_name/flag/script direction)
- **`courses`** (teacher_id, language_id, title, level), **`classes`** (course_id, teacher_id denormalized, name, class_code unique, generated server-side)
- **`class_students`** (roster: class_id, display_name, is_active — no auth of its own)
- **`student_devices`** (class_student_id, `auth_user_id` unique → links a Supabase anonymous session to a roster entry, last_seen_at)
- **`lessons`** (course_id — shared across classes, title, unit/order, objectives, grammar_topic, ai_source_image_url nullable, ai_generated bool, is_published default true — no approval gate)
- **`lesson_vocab_suggestions`** (AI/manual suggested vocab at curriculum-build time — distinct from the class-level bank)
- **`lesson_activities`** (lesson_id, type enum of the 8 activity kinds, order_index, `config jsonb`, ai_generated bool)
- **`vocabulary_bank`** (per-class canonical entries: class_id, word normalized + word_display, translation, pronunciation, example_sentence, part_of_speech, contribution_count, unique `(class_id, word)` → merge-on-duplicate via `ON CONFLICT ... DO UPDATE contribution_count = contribution_count + 1`)
- **`vocabulary_contributions`** (append-only ledger: vocabulary_bank_id, class_id, class_student_id, lesson_id, raw_word_submitted, created_at — feeds the separate contribution dashboard/leaderboard)
- **`game_sessions`** (class_id, lesson_id nullable, status enum pending/waiting_room/in_progress/completed/cancelled, current_question_index)
- **`game_session_participants`** (game_session_id, class_student_id, score, correct_count, avg_response_time_ms)
- **`game_questions`** (game_session_id, order_index, activity_type, vocabulary_bank_id nullable, `prompt jsonb`, `correct_answer jsonb` — never sent to client until answered)
- **`game_answers`** (game_question_id, participant_id, submitted_answer, is_correct, response_time_ms — scored server-side only, in `game-submit-answer`, never trusting client-reported correctness)
- **`attendance`** (class_id, class_student_id, session_date, status, auto-marked present on live-session join)

### RLS policy shape
- Teachers: `USING (teacher_id = auth.uid())`, gated additionally by `(auth.jwt() ->> 'is_anonymous') IS NOT TRUE`.
- Students: a `SECURITY DEFINER` helper `current_class_student_id()` resolves `auth.uid()` → `student_devices.auth_user_id` → `class_students.id`. Write-your-own-row tables (`game_answers`, `vocabulary_contributions`) use `class_student_id = current_class_student_id()`; read-mostly tables (`vocabulary_bank`, `lessons`, `game_sessions`) scope by `class_id = current_class_student_class_id()`. All gated by `(auth.jwt() ->> 'is_anonymous')::boolean = true`.
- The pre-session roster list (needed on the join screen itself, before any session exists) is served by the `student-join` Edge Function using the service-role key — never a client-side RLS-gated select, since there's no session yet to scope to.

## Realtime Design (Live Games)

One channel per session: `game:{game_session_id}`.

| Concern | Primitive | Why |
|---|---|---|
| "Waiting for teacher…" / connected roster | **Presence** | Purpose-built for live who's-here tracking, handles disconnects automatically |
| Synchronized start, question push, timer sync | **Broadcast** | Ephemeral, low-latency, no DB round trip; payload includes a server `question_start_at` timestamp so all clients' timers share one epoch |
| Live leaderboard | **Postgres Changes** on `game_session_participants` | Score is server-computed truth (via `game-submit-answer` Edge Function validating against `game_questions.correct_answer`); DB update is the single source both teacher and students subscribe to — avoids a second, divergent broadcast-based leaderboard |

Question pacing for MVP is **teacher-triggered** ("next question" button), not a blind auto-timer — keeps the teacher in control of pace per the "teacher teaches" philosophy. Leaderboard is torn down at game end; historical results persist in `game_session_participants`/`game_answers` for past-game-history views, which is a separate query path from the live channel.

## AI Service Abstraction Layer

`AIProvider` interface (`_shared/ai/types.ts`): `generateCurriculumFromImage`, `generateActivity`, `enrichVocabWord`, `translateWord`, `regenerateActivity` — every method takes a `languageCode` and prompt templates interpolate `languages.ai_locale_hints` (romanization, pronunciation notation, script direction) so adding language #16 is a seed-data insert, not new code. `getAIProvider()` factory reads `AI_PROVIDER` env var; swapping to another provider later means adding one file + flipping the env var. `isAiConfigured()` (checks `OPENAI_API_KEY` presence) backs the `ai-status` Edge Function and every other AI Edge Function's early-return path per Decision #2 above.

Curriculum photo upload: signed upload URL to a private Storage bucket (`{teacher_id}/...` path), Edge Function passes a signed read URL (not base64) to the vision-capable model to avoid Edge Function payload limits.

## Phased MVP Build Plan

Each milestone is independently demoable; ordering respects dependencies.

- **M0 — Accounts & environment bootstrap.** Create Supabase project, OpenAI account/key (optional — app must run without it per Decision #2), Vercel project; `.env.local` populated; Supabase CLI linked; `supabase db push` verified against a blank remote DB.
- **M1 — Scaffold + design system.** Vite/React/TS/Tailwind/shadcn installed; dark/light mode; `TeacherShell`/`StudentShell` static mockups; TanStack Query + Router skeleton (`/t`, `/s`, `/join`); empty-shell Vercel deploy proves the pipeline.
- **M2 — Supabase schema + teacher auth.** All core tables + teacher RLS migrated; email/password auth wired (`features/auth`); `teachers` row created on signup; `/t/*` route guard. Demo: sign up, log in, empty authenticated dashboard, log out.
- **M3 — Course/Class/Roster CRUD.** Full CRUD incl. class-code generation + client-side QR rendering, bulk roster paste, RHF+Zod forms, optimistic TanStack mutations.
- **M4 — Student join flow + device identity.** `student-join` Edge Function (class code + name validation, Anonymous Auth session issuance, `student_devices` link), `/s/join` UI, auto-recognition on repeat visits, student RLS goes live. Demo: join on a phone, refresh, auto-recognized.
- **M5 — Curriculum builder (manual-first, AI-enhanced).** Manual unit/lesson creation form is the baseline; when AI is configured, ToC-photo upload → `ai-curriculum-from-image` pre-fills the same editable form instead of a separate flow. Demo both with and without an AI key configured.
- **M6 — Lesson & Activity CRUD (manual-first, AI-enhanced).** Manual activity builder per type is the baseline; `ai-generate-activity`/`ai-regenerate-activity` pre-fill it when available. Reorder/edit/delete.
- **M7 — Live Game Engine (Realtime).** Presence + Broadcast + Postgres Changes per Section above; teacher host console; student play screen; server-side scoring. Test with two browser tabs before a full classroom playtest — highest-complexity milestone.
- **M8 — Vocabulary contributions + bank.** End-of-lesson prompt UI; `vocab-contribute` Edge Function (manual field entry baseline, AI enrichment pre-fill when available, merge-on-duplicate upsert, ledger insert); Vocabulary Bank table view; game question generator (M7) wired to pull from the bank, mixing new + previously-learned words.
- **M9 — Analytics dashboards.** Teacher Dashboard (overview, hardest vocab/grammar, vocab dashboard) via Recharts; separate Contribution Dashboard/leaderboard (total/today/weekly/lifetime); Student Dashboard (streak, quiz history, accuracy, contributions, game history).
- **M10 — Polish & deploy hardening.** Framer Motion animation pass (leaderboard rank-swap, game feedback, transitions); attendance auto-marking wiring; AI cap/graceful-degradation wiring where a key is configured; production Vercel env vars; Supabase production settings (pooling, auth email templates, storage CORS); error boundaries/loading skeletons; full end-to-end demo in both themes, desktop (teacher) and phone (student).

## Verification Approach

- Each milestone ends with a manual demo script (noted above) run against the actual deployed/dev environment — not just unit tests, since this is a UX-critical classroom tool.
- M2 onward: verify RLS by testing as both a teacher session and a second browser profile as a student session, confirming cross-class/cross-role access is denied (e.g., Student A cannot read Student B's `game_answers`, a teacher cannot see another teacher's courses).
- M5, M6, M8 each explicitly verified twice: once with `OPENAI_API_KEY` unset (manual path fully functional) and once with it set (AI pre-fill works and remains editable) — this is the core "AI is optional" architectural constraint and needs to be demonstrated, not just asserted.
- M7 verified with a real multi-client test (two+ simultaneous browser sessions) confirming synchronized start and live leaderboard update ordering.
