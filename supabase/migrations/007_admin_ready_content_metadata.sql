alter table public.exercises
  add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table public.workout_templates
  add column if not exists created_by uuid references auth.users(id) on delete set null;

create index if not exists exercises_created_by_idx
  on public.exercises (created_by);

create index if not exists workout_templates_created_by_idx
  on public.workout_templates (created_by);
