delete from public.workout_template_exercises
where exercise_id in (
  select id
  from public.exercises
  where lower(name) in ('plankan', 'knaboj')
);

delete from public.exercises as exercise
where lower(exercise.name) in ('plankan', 'knaboj')
  and not exists (
    select 1
    from public.workout_session_exercises as session_exercise
    where session_exercise.exercise_id = exercise.id
  );

update public.exercises
set active = false,
    updated_at = now()
where lower(name) in ('plankan', 'knaboj');
