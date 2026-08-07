-- Teachers: 1:1 with auth.users, created automatically on signup (see
-- 0004_teacher_signup_trigger.sql).
create table if not exists public.teachers (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

-- Small helper so `display_language_id` can default to English without a
-- subquery in the column DEFAULT clause (Postgres doesn't allow those --
-- a stable function call is the clean way to reference another table's
-- row from a DEFAULT).
create function public.default_display_language_id()
returns uuid
language sql
stable
as $$
  select id from public.languages where code = 'en' limit 1;
$$;

-- Classes: top-level, teacher-owned entity. No course/curriculum layer
-- above it -- lessons, curriculum builders, etc. are explicitly not part
-- of this product (see docs/architecture.md).
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  name text not null,
  class_code text not null unique,
  learning_language_id uuid not null references public.languages (id),
  display_language_id uuid not null default public.default_display_language_id()
    references public.languages (id),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists classes_teacher_id_idx on public.classes (teacher_id);

comment on table public.classes is
  'Top-level teacher-owned entity. Each class has its own Hive, roster, and games.';
comment on column public.classes.class_code is
  'Short human-friendly join code, generated server-side with collision retry.';
