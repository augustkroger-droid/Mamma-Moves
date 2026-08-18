create or replace function public.delete_own_exercise(exercise_id_to_delete uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.exercises
    where id = exercise_id_to_delete
      and created_by = auth.uid()
  ) then
    return false;
  end if;

  delete from public.workout_template_exercises
  using public.workout_templates
  where workout_template_exercises.workout_template_id = workout_templates.id
    and workout_template_exercises.exercise_id = exercise_id_to_delete
    and workout_templates.created_by = auth.uid();

  begin
    delete from public.exercises
    where id = exercise_id_to_delete
      and created_by = auth.uid();

    get diagnostics changed_count = row_count;

    if changed_count > 0 then
      return true;
    end if;
  exception
    when foreign_key_violation then
      update public.exercises
      set
        active = false,
        updated_at = now()
      where id = exercise_id_to_delete
        and created_by = auth.uid();

      get diagnostics changed_count = row_count;
      return changed_count > 0;
  end;

  update public.exercises
  set
    active = false,
    updated_at = now()
  where id = exercise_id_to_delete
    and created_by = auth.uid();

  get diagnostics changed_count = row_count;
  return changed_count > 0;
end;
$$;

grant execute on function public.delete_own_exercise(uuid) to authenticated;
