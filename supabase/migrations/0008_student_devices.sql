-- Links a Supabase Anonymous Auth session (one per device/browser) to a
-- specific roster entry. One auth user = exactly one device = exactly
-- one class_student at a time; a student re-joining from a new device
-- gets a new auth_user_id and a second row pointing at the same
-- class_student_id (see docs/architecture.md: student identity).
create table if not exists public.student_devices (
  id uuid primary key default gen_random_uuid(),
  class_student_id uuid not null references public.class_students (id) on delete cascade,
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists student_devices_class_student_id_idx
  on public.student_devices (class_student_id);

alter table public.student_devices enable row level security;

-- No insert/update/delete policy for any client role: the only way to
-- write this table is through the `join_class` SECURITY DEFINER function
-- below, which bypasses RLS by design -- keeps device linking a single,
-- controlled path rather than something a client can do directly.
create policy "students can view their own device link"
  on public.student_devices for select
  using (auth_user_id = auth.uid());
