-- Seed table of supported languages. Adding a 16th+ language later is a
-- data insert here, not a code change -- nothing downstream branches on
-- a specific language.
create table if not exists public.languages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,           -- internal code, e.g. 'pt-BR'
  name text not null,                  -- display name, e.g. 'Portuguese (Brazil)'
  native_name text not null,           -- e.g. 'Português (Brasil)'
  flag_emoji text,
  -- DeepL's source vs. target language codes aren't 1:1 (e.g. plain 'EN'
  -- as source but 'EN-GB'/'EN-US' as target). Both are best-effort here --
  -- verify against GET /v2/languages before relying on them, since
  -- translateWord() already treats any DeepL error (incl. an unsupported
  -- or stale code) as a soft failure that falls back to manual entry, so
  -- a wrong mapping here never blocks vocabulary creation.
  deepl_source_code text,
  deepl_target_code text,
  created_at timestamptz not null default now()
);

comment on table public.languages is
  'Seed data for supported learning/display languages. Language-agnostic by design -- new rows only, never new code.';

insert into public.languages (code, name, native_name, flag_emoji, deepl_source_code, deepl_target_code)
values
  ('en',      'English',                  'English',           '🇬🇧', 'EN', 'EN-GB'),
  ('pt-BR',   'Portuguese (Brazil)',      'Português (Brasil)', '🇧🇷', 'PT', 'PT-BR'),
  ('pt-PT',   'Portuguese (Portugal)',    'Português (Portugal)', '🇵🇹', 'PT', 'PT-PT'),
  ('es',      'Spanish',                  'Español',           '🇪🇸', 'ES', 'ES'),
  ('fr',      'French',                   'Français',          '🇫🇷', 'FR', 'FR'),
  ('de',      'German',                   'Deutsch',           '🇩🇪', 'DE', 'DE'),
  ('it',      'Italian',                  'Italiano',          '🇮🇹', 'IT', 'IT'),
  ('nl',      'Dutch',                    'Nederlands',        '🇳🇱', 'NL', 'NL'),
  ('ja',      'Japanese',                 '日本語',             '🇯🇵', 'JA', 'JA'),
  ('ko',      'Korean',                   '한국어',             '🇰🇷', 'KO', 'KO'),
  ('zh-Hans', 'Chinese (Simplified)',     '简体中文',           '🇨🇳', 'ZH', 'ZH'),
  ('zh-Hant', 'Chinese (Traditional)',    '繁體中文',           '🇹🇼', 'ZH', 'ZH-HANT'),
  ('ru',      'Russian',                  'Русский',           '🇷🇺', 'RU', 'RU'),
  ('ar',      'Arabic',                   'العربية',           '🇸🇦', 'AR', 'AR'),
  ('hi',      'Hindi',                    'हिन्दी',             '🇮🇳', 'HI', 'HI')
on conflict (code) do nothing;
