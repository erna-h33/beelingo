-- Server-side class-code generation. Teachers never type or choose a
-- code -- it's assigned automatically on insert if not supplied.
create or replace function public.generate_class_code()
returns text
language sql
volatile
as $$
  -- 32-character alphabet, excluding 0/O/1/I/L to avoid ambiguity when a
  -- code is read aloud or hand-typed by a student.
  select string_agg(substr(chars, (random() * length(chars))::int + 1, 1), '')
  from (select '23456789ABCDEFGHJKMNPQRSTUVWXYZ' as chars) s,
       generate_series(1, 6);
$$;

create or replace function public.assign_class_code()
returns trigger
language plpgsql
as $$
declare
  candidate text;
  attempts int := 0;
begin
  if new.class_code is not null and length(trim(new.class_code)) > 0 then
    return new;
  end if;

  loop
    candidate := public.generate_class_code();
    exit when not exists (select 1 from public.classes where class_code = candidate);
    attempts := attempts + 1;
    if attempts > 20 then
      raise exception 'Could not generate a unique class code after % attempts', attempts;
    end if;
  end loop;

  new.class_code := candidate;
  return new;
end;
$$;

create trigger classes_assign_code
  before insert on public.classes
  for each row execute function public.assign_class_code();
