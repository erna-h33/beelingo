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
  components/   shared UI (shadcn primitives, layout shells, theme, ErrorBoundary)
  routes/       route components, split by /t (teacher) and /s (student)
  features/
    auth/               teacher email/password session (Supabase Auth)
    studentSession/     student device identity + join flow (Supabase Anonymous Auth)
    classes/             class CRUD, roster, class code, QR
    hive/                 the vocabulary Hive: bank, contributions, ocr-import, teacher audio
    games/                realtime hooks, teacher host console, student play screens
    statistics/           class overview + most-missed-words + student progress
    export/               client-side CSV + PDF (jsPDF, dynamically imported) generation
  lib/          Supabase client, TanStack Query client, utilities
supabase/
  migrations/   SQL schema + RLS policies + SECURITY DEFINER RPC functions
                (games engine, adaptive review engine, statistics all live here —
                 no Edge Function needed unless external HTTP is involved)
  functions/
    enrich-word/   the one Edge Function: DeepL translation + Wikidata lexical
                    lookup (external HTTP, so it can't be a plain SQL function)
```

Teacher routes (`/t/*`) are desktop-first and auth-gated via Supabase Auth.
Student routes (`/s/*`) are mobile-first and gated by a device-bound
Supabase Anonymous Auth session obtained via the class-code join flow at
`/join` — no email, password, or account creation. `Class` is the top-level
teacher-owned entity — there's no course/curriculum layer above it.

Navigation is deliberately shallow: a class's Hive, Games, and Statistics
live inside that class's own workspace, not as separate top-level nav
items. Student bottom nav is just Home / Hive / Game.

## Deploying

The app is a static SPA (no server component beyond Supabase itself), so
any static host works; `vercel.json` is included for Vercel specifically —
it rewrites every path to `/index.html` so client-side routes like
`/t/classes/:id/games` don't 404 on a hard refresh.

1. **Database**: push every migration in `supabase/migrations/` in order
   against your Supabase project (`supabase db push --db-url <connection
   string>` — the session pooler connection string, not the direct one, if
   your deploy environment lacks IPv6 routing).
2. **Edge Function**: deploy `supabase/functions/enrich-word` (Supabase
   dashboard's "Via Editor" flow works with zero CLI/Docker access) and set
   the `DEEPL_API_KEY` secret. Word creation still works without it — a
   teacher just enters the translation manually instead of it being
   auto-filled.
3. **Auth**: in Authentication → Providers, enable **Anonymous Sign-Ins**
   (required for the student join flow) and confirm **Confirm email** is
   set the way you want for teacher signups (disabled is fine for a closed
   pilot; enable it for a public deploy).
4. **Frontend env vars**: set `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` (the *publishable*/anon key, never the
   `service_role` key) in your host's environment variables — see
   `.env.example`.
5. `npm run build` then deploy the `dist/` folder (or connect the repo to
   Vercel directly and let it run the build).
