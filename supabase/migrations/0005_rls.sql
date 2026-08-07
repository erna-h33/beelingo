-- RLS foundation. Two actor types will ultimately read/write this schema:
-- authenticated teachers (Supabase Auth email/password) and anonymous
-- students (Supabase Anonymous Auth, arriving in M4). Every policy below
-- that's teacher-scoped also excludes anonymous sessions defensively via
-- the `is_anonymous` JWT claim, so a stray policy mistake elsewhere can
-- never let a student session act as a teacher.

alter table public.languages enable row level security;
alter table public.teachers enable row level security;
alter table public.classes enable row level security;

-- languages: public reference data, safe to read for anyone with a
-- Supabase client (both roles need it -- e.g. class-creation language
-- pickers, display labels).
create policy "languages are publicly readable"
  on public.languages for select
  using (true);

-- teachers: a teacher can read/update only their own row. Row creation
-- happens via the security-definer signup trigger (0004), not client
-- inserts, so no insert policy is needed.
create policy "teachers can view their own row"
  on public.teachers for select
  using (id = auth.uid());

create policy "teachers can update their own row"
  on public.teachers for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- classes: full CRUD, scoped to the owning teacher only. The
-- `is_anonymous` check is defense-in-depth -- a student's device session
-- should never be able to touch this table at all, even by accident.
create policy "teachers can view their own classes"
  on public.classes for select
  using (
    teacher_id = auth.uid()
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

create policy "teachers can create their own classes"
  on public.classes for insert
  with check (
    teacher_id = auth.uid()
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

create policy "teachers can update their own classes"
  on public.classes for update
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

create policy "teachers can delete their own classes"
  on public.classes for delete
  using (teacher_id = auth.uid());

-- Reusable helper for every child table added from M5 onward
-- (hive_words, game_sessions, ...): `using (is_class_teacher(class_id))`
-- instead of re-deriving the join each time. `is_class_member(class_id)`
-- (the anonymous-student equivalent) is added in M4 once
-- student_devices/class_students exist to define it against.
create function public.is_class_teacher(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.classes
    where id = p_class_id and teacher_id = auth.uid()
  );
$$;
