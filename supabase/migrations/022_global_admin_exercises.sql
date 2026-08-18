create or replace function public.is_admin_user(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = auth, public
as $$
  select exists (
    select 1
    from auth.users as users
    where users.id = target_user_id
      and lower(users.email) = 'mammaworkoutapp@gmail.com'
  );
$$;

grant execute on function public.is_admin_user(uuid) to anon, authenticated;

drop policy if exists "exercises_select_visible" on public.exercises;
create policy "exercises_select_visible"
  on public.exercises for select
  using (
    active = true
    and (
      created_by is null
      or created_by = auth.uid()
      or public.is_admin_user(created_by)
    )
  );

update public.exercises
set created_by = null
where created_by in (
  select id
  from auth.users
  where lower(email) = 'mammaworkoutapp@gmail.com'
);
