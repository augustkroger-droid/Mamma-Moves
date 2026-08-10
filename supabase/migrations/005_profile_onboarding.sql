alter table public.profiles
  add column if not exists has_seen_intro boolean not null default false,
  add column if not exists intro_seen_at timestamptz;
