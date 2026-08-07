-- Extensions used across the schema.
-- pgcrypto: gen_random_uuid() for all primary keys.
create extension if not exists pgcrypto;
