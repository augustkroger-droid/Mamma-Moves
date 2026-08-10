grant usage on schema public to anon, authenticated;

grant select on public.exercises to anon, authenticated;
grant select on public.workout_templates to anon, authenticated;
grant select on public.workout_template_exercises to anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.workout_sessions to authenticated;
grant select, insert, update on public.workout_session_exercises to authenticated;
grant select, insert, update on public.streak_pauses to authenticated;
