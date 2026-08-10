grant insert, update on public.workout_templates to authenticated;
grant insert, update, delete on public.workout_template_exercises to authenticated;

drop policy if exists "workout_templates_select_active" on public.workout_templates;
create policy "workout_templates_select_visible"
  on public.workout_templates for select
  using (
    active = true
    and (
      created_by is null
      or created_by = auth.uid()
    )
  );

create policy "workout_templates_insert_own"
  on public.workout_templates for insert
  with check (created_by = auth.uid());

create policy "workout_templates_update_own"
  on public.workout_templates for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "workout_template_exercises_select_active_templates" on public.workout_template_exercises;
create policy "workout_template_exercises_select_visible_templates"
  on public.workout_template_exercises for select
  using (
    exists (
      select 1
      from public.workout_templates
      where workout_templates.id = workout_template_exercises.workout_template_id
        and workout_templates.active = true
        and (
          workout_templates.created_by is null
          or workout_templates.created_by = auth.uid()
        )
    )
  );

create policy "workout_template_exercises_insert_own_templates"
  on public.workout_template_exercises for insert
  with check (
    exists (
      select 1
      from public.workout_templates
      where workout_templates.id = workout_template_exercises.workout_template_id
        and workout_templates.created_by = auth.uid()
    )
  );

create policy "workout_template_exercises_update_own_templates"
  on public.workout_template_exercises for update
  using (
    exists (
      select 1
      from public.workout_templates
      where workout_templates.id = workout_template_exercises.workout_template_id
        and workout_templates.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.workout_templates
      where workout_templates.id = workout_template_exercises.workout_template_id
        and workout_templates.created_by = auth.uid()
    )
  );

create policy "workout_template_exercises_delete_own_templates"
  on public.workout_template_exercises for delete
  using (
    exists (
      select 1
      from public.workout_templates
      where workout_templates.id = workout_template_exercises.workout_template_id
        and workout_templates.created_by = auth.uid()
    )
  );
