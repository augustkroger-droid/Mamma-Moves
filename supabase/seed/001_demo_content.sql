insert into public.exercises (name, description, youtube_video_id, category)
values
  ('Knäböj', 'En enkel benövning för hela kroppen.', 'dQw4w9WgXcQ', 'Ben'),
  ('Höftlyft', 'Stark och lugn övning för säte och baksida.', 'dQw4w9WgXcQ', 'Styrka'),
  ('Plankan', 'Kort core-övning som räcker gott för dagens streak.', 'dQw4w9WgXcQ', 'Core')
on conflict do nothing;
