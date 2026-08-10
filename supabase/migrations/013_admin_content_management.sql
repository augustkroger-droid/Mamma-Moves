alter table public.profiles
  add column if not exists email text;

alter table public.workout_templates
  add column if not exists visibility text not null default 'private'
    check (visibility in ('all', 'selected', 'private'));

create table if not exists public.workout_template_access (
  workout_template_id uuid not null references public.workout_templates(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workout_template_id, user_id)
);

create index if not exists workout_template_access_user_idx
  on public.workout_template_access(user_id, workout_template_id);

alter table public.workout_template_access enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'mammaworkoutapp@gmail.com';
$$;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.exercises to authenticated;
grant select, insert, update, delete on table public.workout_templates to authenticated;
grant select, insert, update, delete on table public.workout_template_exercises to authenticated;
grant select, insert, update, delete on table public.workout_template_access to authenticated;
grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
  on public.profiles for select
  using (public.is_admin());

drop policy if exists "exercises_select_admin" on public.exercises;
create policy "exercises_select_admin"
  on public.exercises for select
  using (public.is_admin());

drop policy if exists "exercises_insert_admin" on public.exercises;
create policy "exercises_insert_admin"
  on public.exercises for insert
  with check (public.is_admin());

drop policy if exists "exercises_update_admin" on public.exercises;
create policy "exercises_update_admin"
  on public.exercises for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "exercises_delete_admin" on public.exercises;
create policy "exercises_delete_admin"
  on public.exercises for delete
  using (public.is_admin());

drop policy if exists "workout_templates_select_visible" on public.workout_templates;
create policy "workout_templates_select_visible"
  on public.workout_templates for select
  using (
    active = true
    and (
      public.is_admin()
      or created_by is null
      or created_by = auth.uid()
      or visibility = 'all'
      or exists (
        select 1
        from public.workout_template_access
        where workout_template_access.workout_template_id = workout_templates.id
          and workout_template_access.user_id = auth.uid()
      )
    )
  );

drop policy if exists "workout_templates_insert_own" on public.workout_templates;
create policy "workout_templates_insert_own"
  on public.workout_templates for insert
  with check (
    public.is_admin()
    or (
      created_by = auth.uid()
      and visibility = 'private'
    )
  );

drop policy if exists "workout_templates_update_own" on public.workout_templates;
create policy "workout_templates_update_own"
  on public.workout_templates for update
  using (
    public.is_admin()
    or (
      created_by = auth.uid()
      and visibility = 'private'
    )
  )
  with check (
    public.is_admin()
    or (
      created_by = auth.uid()
      and visibility = 'private'
    )
  );

drop policy if exists "workout_templates_delete_own" on public.workout_templates;
create policy "workout_templates_delete_own"
  on public.workout_templates for delete
  using (
    public.is_admin()
    or (
      created_by = auth.uid()
      and visibility = 'private'
    )
  );

drop policy if exists "workout_template_exercises_select_visible_templates" on public.workout_template_exercises;
create policy "workout_template_exercises_select_visible_templates"
  on public.workout_template_exercises for select
  using (
    exists (
      select 1
      from public.workout_templates
      where workout_templates.id = workout_template_exercises.workout_template_id
        and workout_templates.active = true
        and (
          public.is_admin()
          or workout_templates.created_by is null
          or workout_templates.created_by = auth.uid()
          or workout_templates.visibility = 'all'
          or exists (
            select 1
            from public.workout_template_access
            where workout_template_access.workout_template_id = workout_templates.id
              and workout_template_access.user_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "workout_template_exercises_insert_own_templates" on public.workout_template_exercises;
create policy "workout_template_exercises_insert_own_templates"
  on public.workout_template_exercises for insert
  with check (
    public.is_admin()
    or exists (
      select 1
      from public.workout_templates
      where workout_templates.id = workout_template_exercises.workout_template_id
        and workout_templates.created_by = auth.uid()
        and workout_templates.visibility = 'private'
    )
  );

drop policy if exists "workout_template_exercises_update_own_templates" on public.workout_template_exercises;
create policy "workout_template_exercises_update_own_templates"
  on public.workout_template_exercises for update
  using (
    public.is_admin()
    or exists (
      select 1
      from public.workout_templates
      where workout_templates.id = workout_template_exercises.workout_template_id
        and workout_templates.created_by = auth.uid()
        and workout_templates.visibility = 'private'
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1
      from public.workout_templates
      where workout_templates.id = workout_template_exercises.workout_template_id
        and workout_templates.created_by = auth.uid()
        and workout_templates.visibility = 'private'
    )
  );

drop policy if exists "workout_template_exercises_delete_own_templates" on public.workout_template_exercises;
create policy "workout_template_exercises_delete_own_templates"
  on public.workout_template_exercises for delete
  using (
    public.is_admin()
    or exists (
      select 1
      from public.workout_templates
      where workout_templates.id = workout_template_exercises.workout_template_id
        and workout_templates.created_by = auth.uid()
        and workout_templates.visibility = 'private'
    )
  );

drop policy if exists "workout_template_access_select_admin_or_own" on public.workout_template_access;
create policy "workout_template_access_select_admin_or_own"
  on public.workout_template_access for select
  using (public.is_admin() or user_id = auth.uid());

drop policy if exists "workout_template_access_insert_admin" on public.workout_template_access;
create policy "workout_template_access_insert_admin"
  on public.workout_template_access for insert
  with check (public.is_admin());

drop policy if exists "workout_template_access_update_admin" on public.workout_template_access;
create policy "workout_template_access_update_admin"
  on public.workout_template_access for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "workout_template_access_delete_admin" on public.workout_template_access;
create policy "workout_template_access_delete_admin"
  on public.workout_template_access for delete
  using (public.is_admin());
