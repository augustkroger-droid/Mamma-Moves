alter table public.push_subscriptions
  add column if not exists reminder_time text not null default '14:00',
  add column if not exists last_daily_streak_reminder_date date;

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on table public.push_subscriptions to authenticated, service_role;
