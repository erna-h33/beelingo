# Beelingo

A collaborative classroom vocabulary platform, built around **the Hive** —
the shared vocabulary collection for a class. Students contribute to it,
teachers enrich it, and it automatically powers live classroom games — no
student accounts required.

> Grow your class's Hive, together.

## Stack

React · TypeScript · Vite · Tailwind CSS · shadcn/ui · Supabase (Postgres,
Auth, Realtime, Storage, Edge Functions) · DeepL Free API (translation) ·
Wikidata Lexeme API (lexical enrichment) · Tesseract.js (client-side OCR) ·
TanStack Query · React Hook Form + Zod · Recharts · Framer Motion · Vercel

No AI/LLM anywhere in the product — translations come from DeepL, word
type/gender/plural come from Wikidata, and every field stays teacher-editable.
See `docs/architecture.md` for the full design.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Supabase credentials once you have a project
npm run dev
```

- `npm run dev` — start the Vite dev server
- `npm run build` — type-check and build for production
- `npm run lint` — run oxlint
- `npm run preview` — preview the production build locally

## Project structure

```
src/
  components/   shared UI (shadcn primitives, layout shells, theme)
  routes/       route components, split by /t (teacher) and /s (student)
  features/
    classes/          class CRUD, roster, class code, QR
    hive/              the vocabulary Hive: bank, contributions, ocr-import, export
    games/             game-type selector, source-filter picker, host/play/leaderboard
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
```

Teacher routes (`/t/*`) are desktop-first and auth-gated via Supabase Auth.
Student routes (`/s/*`) are mobile-first and gated by a device-bound
Supabase Anonymous Auth session obtained via the class-code join flow at
`/join` — no email, password, or account creation. `Class` is the top-level
teacher-owned entity — there's no course/curriculum layer above it.

Navigation is deliberately shallow: a class's Hive, Games, and Statistics
live inside that class's own workspace, not as separate top-level nav
items. Student bottom nav is just Home / Hive / Game.
