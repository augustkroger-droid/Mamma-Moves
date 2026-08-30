alter table public.workout_sessions
  add column if not exists timer_started_at timestamptz;

update public.workout_sessions
set timer_started_at = coalesce(timer_started_at, now())
where status = 'started'
  and timer_started_at is null;

create table if not exists public.workout_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_session_id uuid references public.workout_sessions(id) on delete cascade,
  comment_date date not null,
  body text not null check (char_length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workout_comments_user_date_idx
  on public.workout_comments (user_id, comment_date desc, created_at desc);

create index if not exists workout_comments_session_idx
  on public.workout_comments (workout_session_id);

alter table public.workout_comments enable row level security;

grant select, insert, update, delete on table public.workout_comments to authenticated;

drop policy if exists "workout_comments_select_own" on public.workout_comments;
create policy "workout_comments_select_own"
  on public.workout_comments for select
  using (user_id = auth.uid());

drop policy if exists "workout_comments_insert_own" on public.workout_comments;
create policy "workout_comments_insert_own"
  on public.workout_comments for insert
  with check (
    user_id = auth.uid()
    and (
      workout_session_id is null
      or exists (
        select 1
        from public.workout_sessions
        where workout_sessions.id = workout_comments.workout_session_id
          and workout_sessions.user_id = auth.uid()
      )
    )
  );

drop policy if exists "workout_comments_update_own" on public.workout_comments;
create policy "workout_comments_update_own"
  on public.workout_comments for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "workout_comments_delete_own" on public.workout_comments;
create policy "workout_comments_delete_own"
  on public.workout_comments for delete
  using (user_id = auth.uid());
