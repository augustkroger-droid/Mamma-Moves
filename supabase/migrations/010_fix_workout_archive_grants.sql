create table if not exists public.workout_template_archives (
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_template_id uuid not null references public.workout_templates(id) on delete cascade,
  archived_at timestamptz not null default now(),
  primary key (user_id, workout_template_id)
);

create index if not exists workout_template_archives_user_idx
  on public.workout_template_archives(user_id, archived_at desc);

alter table public.workout_template_archives enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, delete on table public.workout_template_archives to anon, authenticated;
grant delete on table public.workout_templates to authenticated;

drop policy if exists "workout_template_archives_select_own" on public.workout_template_archives;
create policy "workout_template_archives_select_own"
  on public.workout_template_archives for select
  using (user_id = auth.uid());

drop policy if exists "workout_template_archives_insert_own" on public.workout_template_archives;
create policy "workout_template_archives_insert_own"
  on public.workout_template_archives for insert
  with check (user_id = auth.uid());

drop policy if exists "workout_template_archives_delete_own" on public.workout_template_archives;
create policy "workout_template_archives_delete_own"
  on public.workout_template_archives for delete
  using (user_id = auth.uid());

drop policy if exists "workout_templates_delete_own" on public.workout_templates;
create policy "workout_templates_delete_own"
  on public.workout_templates for delete
  using (created_by = auth.uid());
