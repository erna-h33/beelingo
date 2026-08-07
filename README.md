# Beelingo

A collaborative classroom vocabulary platform. Teachers and students build a
shared vocabulary bank together, and that bank automatically powers live
classroom games — no student accounts required.

> Build your class's vocabulary, together.

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
  features/     feature-first modules added as milestones land
  lib/          Supabase client, TanStack Query client, utilities
  hooks/        cross-feature hooks
supabase/
  migrations/   SQL schema + RLS policies
  functions/    Edge Functions
    _shared/enrichment/   DeepL + Wikidata wrappers (server-only, keys never client-side)
    _shared/vocab/        shared dedup-or-create logic
```

Teacher routes (`/t/*`) are desktop-first and auth-gated via Supabase Auth.
Student routes (`/s/*`) are mobile-first and gated by a device-bound
Supabase Anonymous Auth session obtained via the class-code join flow at
`/join` — no email, password, or account creation. `Class` is the top-level
teacher-owned entity — there's no course/curriculum layer above it.
