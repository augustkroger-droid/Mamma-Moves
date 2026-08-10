alter table public.workout_template_archives
  add column if not exists deleted_at timestamptz;

create index if not exists workout_template_archives_visible_idx
  on public.workout_template_archives(user_id, archived_at desc)
  where deleted_at is null;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.workout_template_archives to anon, authenticated;

drop policy if exists "workout_template_archives_update_own" on public.workout_template_archives;
create policy "workout_template_archives_update_own"
  on public.workout_template_archives for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
