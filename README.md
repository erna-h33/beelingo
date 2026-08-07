# Beelingo

An AI-assisted language classroom platform. Teachers build courses, run live
classroom games, and grow a collaborative vocabulary bank with their
students — no student accounts required.

> The teacher teaches. The AI prepares.

## Stack

React · TypeScript · Vite · Tailwind CSS · shadcn/ui · Supabase (Postgres,
Auth, Realtime, Edge Functions) · OpenAI (optional) · TanStack Query ·
React Hook Form + Zod · Recharts · Framer Motion · Vercel

AI is an optional enhancement layer, not a dependency — every core workflow
(courses, classes, lessons, vocabulary, live games, dashboards) works fully
without an OpenAI key configured. See `docs/architecture.md` for the full
design.

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
  functions/    Edge Functions (all OpenAI calls live here — never client-side)
```

Teacher routes (`/t/*`) are desktop-first and auth-gated via Supabase Auth.
Student routes (`/s/*`) are mobile-first and gated by a device-bound
Supabase Anonymous Auth session obtained via the class-code join flow at
`/join` — no email, password, or account creation.
