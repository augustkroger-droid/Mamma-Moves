alter table public.workout_sessions
  drop constraint if exists workout_sessions_status_check;

alter table public.workout_sessions
  add constraint workout_sessions_status_check
  check (status in ('started', 'paused', 'completed', 'abandoned'));
