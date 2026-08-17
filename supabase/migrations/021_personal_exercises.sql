grant select, insert, update on table public.exercises to authenticated;

drop policy if exists "exercises_select_active" on public.exercises;
create policy "exercises_select_visible"
  on public.exercises for select
  using (
    active = true
    and (
      created_by is null
      or created_by = auth.uid()
    )
  );

drop policy if exists "exercises_insert_own" on public.exercises;
create policy "exercises_insert_own"
  on public.exercises for insert
  with check (
    created_by = auth.uid()
    and active = true
  );

drop policy if exists "exercises_update_own" on public.exercises;
create policy "exercises_update_own"
  on public.exercises for update
  using (created_by = auth.uid())
  with check (
    created_by = auth.uid()
    and active = true
  );
