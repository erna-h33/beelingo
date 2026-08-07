-- Auto-create a `public.teachers` row whenever a real (non-anonymous)
-- auth.users row is created via email/password signup.
--
-- IMPORTANT: this trigger fires for every auth.users insert, and starting
-- in M4 students also get an auth.users row via Supabase Anonymous Auth
-- (see docs/architecture.md). The `is_anonymous` guard below is what
-- keeps a student's device session from ever being turned into a
-- "teacher" row -- do not remove it when M4 lands.
create function public.handle_new_teacher()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.is_anonymous, false) = false then
    insert into public.teachers (id, email, display_name)
    values (new.id, new.email, new.raw_user_meta_data ->> 'display_name')
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_teacher();
