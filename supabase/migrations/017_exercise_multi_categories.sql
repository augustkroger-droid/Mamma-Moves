alter table public.exercises
  add column if not exists categories text[] not null default array[]::text[];

update public.exercises
set categories = array[category]
where coalesce(array_length(categories, 1), 0) = 0
  and category is not null
  and btrim(category) <> '';

create index if not exists exercises_categories_idx
  on public.exercises using gin (categories);
