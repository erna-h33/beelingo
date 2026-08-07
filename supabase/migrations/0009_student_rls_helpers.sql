-- Student-side equivalents of M2's is_class_teacher(): every future
-- student-writable/readable table (hive_words, game_*, contributions...)
-- will reuse these instead of re-deriving the student_devices join.
create or replace function public.is_class_member(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.student_devices sd
    join public.class_students cs on cs.id = sd.class_student_id
    where sd.auth_user_id = auth.uid() and cs.class_id = p_class_id
  );
$$;

create or replace function public.current_class_student_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select cs.id
  from public.student_devices sd
  join public.class_students cs on cs.id = sd.class_student_id
  where sd.auth_user_id = auth.uid()
  limit 1;
$$;

-- Additive SELECT policies (existing teacher policies on these tables
-- are untouched -- Postgres OR's multiple policies for the same command
-- together, so this only adds a new way to qualify, for anonymous class
-- members specifically).
create policy "students can view their own class"
  on public.classes for select
  using (
    public.is_class_member(id)
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = true
  );

create policy "students can view their class roster"
  on public.class_students for select
  using (
    public.is_class_member(class_id)
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = true
  );
