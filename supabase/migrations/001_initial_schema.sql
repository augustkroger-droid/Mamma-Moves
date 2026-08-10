create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  youtube_video_id text not null,
  thumbnail_url text,
  category text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  thumbnail_url text,
  category text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workout_template_exercises (
  workout_template_id uuid not null references public.workout_templates(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  position integer not null check (position > 0),
  primary key (workout_template_id, exercise_id),
  unique (workout_template_id, position)
);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_template_id uuid references public.workout_templates(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  status text not null default 'started' check (status in ('started', 'completed', 'abandoned')),
  created_at timestamptz not null default now()
);

create table if not exists public.workout_session_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  position integer not null check (position > 0),
  completed boolean not null default false,
  started_at timestamptz,
  completed_at timestamptz,
  unique (workout_session_id, position)
);

create table if not exists public.streak_pauses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index if not exists workout_sessions_user_started_idx
  on public.workout_sessions (user_id, started_at desc);

create index if not exists workout_session_exercises_session_idx
  on public.workout_session_exercises (workout_session_id, position);

create index if not exists streak_pauses_user_dates_idx
  on public.streak_pauses (user_id, start_date, end_date);

alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_templates enable row level security;
alter table public.workout_template_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_session_exercises enable row level security;
alter table public.streak_pauses enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "exercises_select_active"
  on public.exercises for select
  using (active = true);

create policy "workout_templates_select_active"
  on public.workout_templates for select
  using (active = true);

create policy "workout_template_exercises_select_active_templates"
  on public.workout_template_exercises for select
  using (
    exists (
      select 1
      from public.workout_templates
      where workout_templates.id = workout_template_exercises.workout_template_id
        and workout_templates.active = true
    )
  );

create policy "workout_sessions_select_own"
  on public.workout_sessions for select
  using (auth.uid() = user_id);

create policy "workout_sessions_insert_own"
  on public.workout_sessions for insert
  with check (auth.uid() = user_id);

create policy "workout_sessions_update_own"
  on public.workout_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "workout_session_exercises_select_own"
  on public.workout_session_exercises for select
  using (
    exists (
      select 1
      from public.workout_sessions
      where workout_sessions.id = workout_session_exercises.workout_session_id
        and workout_sessions.user_id = auth.uid()
    )
  );

create policy "workout_session_exercises_insert_own"
  on public.workout_session_exercises for insert
  with check (
    exists (
      select 1
      from public.workout_sessions
      where workout_sessions.id = workout_session_exercises.workout_session_id
        and workout_sessions.user_id = auth.uid()
    )
  );

create policy "workout_session_exercises_update_own"
  on public.workout_session_exercises for update
  using (
    exists (
      select 1
      from public.workout_sessions
      where workout_sessions.id = workout_session_exercises.workout_session_id
        and workout_sessions.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.workout_sessions
      where workout_sessions.id = workout_session_exercises.workout_session_id
        and workout_sessions.user_id = auth.uid()
    )
  );

create policy "streak_pauses_select_own"
  on public.streak_pauses for select
  using (auth.uid() = user_id);

create policy "streak_pauses_insert_own"
  on public.streak_pauses for insert
  with check (auth.uid() = user_id);

create policy "streak_pauses_update_own"
  on public.streak_pauses for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
