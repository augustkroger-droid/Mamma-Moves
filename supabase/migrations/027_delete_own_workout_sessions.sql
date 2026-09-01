grant delete on public.workout_sessions to authenticated;

create policy "workout_sessions_delete_own"
  on public.workout_sessions for delete
  using (auth.uid() = user_id);
