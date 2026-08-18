insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'exercise-images',
  'exercise-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

grant select, insert, update, delete on table storage.objects to authenticated;

drop policy if exists "exercise_images_select_public" on storage.objects;
create policy "exercise_images_select_public"
  on storage.objects for select
  using (bucket_id = 'exercise-images');

drop policy if exists "exercise_images_insert_own_folder" on storage.objects;
create policy "exercise_images_insert_own_folder"
  on storage.objects for insert
  with check (
    bucket_id = 'exercise-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "exercise_images_update_own_folder" on storage.objects;
create policy "exercise_images_update_own_folder"
  on storage.objects for update
  using (
    bucket_id = 'exercise-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'exercise-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "exercise_images_delete_own_folder" on storage.objects;
create policy "exercise_images_delete_own_folder"
  on storage.objects for delete
  using (
    bucket_id = 'exercise-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

grant delete on table public.exercises to authenticated;

drop policy if exists "exercises_update_own" on public.exercises;
create policy "exercises_update_own"
  on public.exercises for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "exercises_delete_own" on public.exercises;
create policy "exercises_delete_own"
  on public.exercises for delete
  using (created_by = auth.uid());
