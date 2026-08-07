-- Bug fix: generate_class_code() (0006) computed each character's index
-- as `(random() * length(chars))::int + 1`. Postgres's `::int` cast on a
-- float ROUNDS to nearest rather than truncating, so this occasionally
-- produced index `length(chars) + 1` (one past the end), and
-- `substr()` silently returns '' for an out-of-range position rather
-- than erroring -- so the generated code was occasionally 5 characters
-- (or fewer) instead of 6, with no error surfaced anywhere. Confirmed
-- in the wild: a class created during M3 testing got code "QAFFX" (5
-- chars). `floor()` before the `+1` guarantees the index always lands
-- in [1, length(chars)].
create or replace function public.generate_class_code()
returns text
language sql
volatile
as $$
  select string_agg(substr(chars, floor(random() * length(chars))::int + 1, 1), '')
  from (select '23456789ABCDEFGHJKMNPQRSTUVWXYZ' as chars) s,
       generate_series(1, 6);
$$;
