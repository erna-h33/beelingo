-- Roster: name-only, no auth of its own. Anonymous-student RLS
-- (is_class_member) arrives in M4 once student_devices exists to define
-- it against -- for now this table is teacher-only, which matches M3's
-- scope (no student join flow yet).
create table if not exists public.class_students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  display_name text not null,
  is_active boolean not null default true,
  joined_at timestamptz not null default now()
);

create index if not exists class_students_class_id_idx on public.class_students (class_id);

comment on column public.class_students.is_active is
  'Soft-remove flag -- "Remove Students" deactivates rather than deletes, preserving any history (contributions, game answers) tied to this roster entry.';

alter table public.class_students enable row level security;

create policy "teachers can view their class roster"
  on public.class_students for select
  using (public.is_class_teacher(class_id));

create policy "teachers can add roster students"
  on public.class_students for insert
  with check (public.is_class_teacher(class_id));

create policy "teachers can update roster students"
  on public.class_students for update
  using (public.is_class_teacher(class_id))
  with check (public.is_class_teacher(class_id));

create policy "teachers can remove roster students"
  on public.class_students for delete
  using (public.is_class_teacher(class_id));
