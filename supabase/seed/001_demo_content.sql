insert into public.exercises (name, description, youtube_video_id, category)
values
  ('Knaboj', 'En enkel benovning for hela kroppen.', 'dQw4w9WgXcQ', 'Ben'),
  ('Hoftlyft', 'Stark och lugn ovning for sate och baksida.', 'dQw4w9WgXcQ', 'Styrka'),
  ('Plankan', 'Kort core-ovning som racker gott for dagens streak.', 'dQw4w9WgXcQ', 'Core')
on conflict do nothing;
