-- Teacher audio: real recordings only (pronunciation or a practice-
-- sentence reading) -- never AI/synthesized speech. Storage buckets are
-- just rows in storage.buckets, and storage.objects is a normal
-- RLS-able table, so this all deploys the same way every other
-- migration has (no dashboard step needed, unlike the enrich-word Edge
-- Function).
insert into storage.buckets (id, name, public)
values ('teacher-audio', 'teacher-audio', false)
on conflict (id) do nothing;

-- Path convention: {class_id}/{hive_word_id}/audio.webm -- fixed name,
-- so re-recording is a plain upsert with no orphaned old file.
-- storage.foldername(name) splits the object path into folder segments;
-- [1] is the class_id segment.

create policy "teachers can upload their class audio"
  on storage.objects for insert
  with check (
    bucket_id = 'teacher-audio'
    and public.is_class_teacher((storage.foldername(name))[1]::uuid)
  );

create policy "teachers can update their class audio"
  on storage.objects for update
  using (
    bucket_id = 'teacher-audio'
    and public.is_class_teacher((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'teacher-audio'
    and public.is_class_teacher((storage.foldername(name))[1]::uuid)
  );

create policy "teachers can delete their class audio"
  on storage.objects for delete
  using (
    bucket_id = 'teacher-audio'
    and public.is_class_teacher((storage.foldername(name))[1]::uuid)
  );

create policy "teachers can read their class audio"
  on storage.objects for select
  using (
    bucket_id = 'teacher-audio'
    and public.is_class_teacher((storage.foldername(name))[1]::uuid)
  );

create policy "students can read their class audio"
  on storage.objects for select
  using (
    bucket_id = 'teacher-audio'
    and public.is_class_member((storage.foldername(name))[1]::uuid)
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = true
  );
