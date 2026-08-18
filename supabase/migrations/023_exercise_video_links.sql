alter table public.exercises
  add column if not exists video_url text;

alter table public.exercises
  add column if not exists video_provider text not null default 'none';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'exercises_video_provider_check'
      and conrelid = 'public.exercises'::regclass
  ) then
    alter table public.exercises
      add constraint exercises_video_provider_check
      check (video_provider in ('youtube', 'instagram', 'facebook', 'external', 'none'));
  end if;
end $$;

update public.exercises
set
  video_provider = 'youtube',
  video_url = coalesce(video_url, 'https://www.youtube.com/watch?v=' || youtube_video_id)
where youtube_video_id is not null
  and (video_provider = 'none' or video_url is null);
