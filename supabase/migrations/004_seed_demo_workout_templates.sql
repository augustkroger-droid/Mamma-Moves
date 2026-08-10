do $$
declare
  template_id uuid;
begin
  select id into template_id
  from public.workout_templates
  where name = 'Morgonpasset'
  limit 1;

  if template_id is null then
    insert into public.workout_templates (name, description, category)
    values ('Morgonpasset', 'Ett kort och snällt startpass.', 'Helkropp')
    returning id into template_id;
  end if;

  insert into public.workout_template_exercises (workout_template_id, exercise_id, position)
  select template_id, exercises.id, row_number() over (order by exercises.name)::integer
  from public.exercises
  where exercises.name in ('Knäböj', 'Höftlyft', 'Plankan', 'Knaboj', 'Hoftlyft')
  on conflict do nothing;
end $$;
