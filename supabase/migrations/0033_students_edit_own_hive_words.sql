-- Students could only ever view the Hive, never fix a typo or remove a
-- word they added -- even alone, with nobody else having touched it
-- yet. Lets a student edit/delete a hive_words row only when both:
--   1. they're the one who added it (added_by_class_student_id), and
--   2. no *other* student has since contributed/reinforced that same
--      word (word_contributions has no row for it from anyone else).
-- (2) matters because once another student has engaged with a word, it
-- stops being purely "theirs" -- it's already a shared class resource
-- someone else has learned from, and silently renaming or deleting it
-- out from under that history is exactly the kind of thing this check
-- exists to prevent. Teachers already have unrestricted edit/delete
-- (0013) and remain the fallback for any word that's grown past this.
--
-- SECURITY DEFINER STABLE, same as every other cross-table RLS helper
-- in this schema (is_class_member, is_class_teacher, ...) -- avoids the
-- policy-recursion class of bug already hit once before (0031) when a
-- policy's own subquery reads a table whose policy reads back the
-- original table.
create or replace function public.can_student_edit_hive_word(p_hive_word_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.hive_words hw
    where hw.id = p_hive_word_id
      and hw.added_by_class_student_id = public.current_class_student_id()
      and not exists (
        select 1 from public.word_contributions wc
        where wc.hive_word_id = hw.id
          and wc.class_student_id <> public.current_class_student_id()
      )
  );
$$;

create policy "students can edit their own unshared contributions"
  on public.hive_words for update
  using (public.can_student_edit_hive_word(id))
  with check (public.can_student_edit_hive_word(id));

create policy "students can delete their own unshared contributions"
  on public.hive_words for delete
  using (public.can_student_edit_hive_word(id));
