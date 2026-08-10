update public.exercises
set
  name = 'Knäböj',
  description = 'En enkel benövning för hela kroppen.',
  updated_at = now()
where name = 'Knaboj';

update public.exercises
set
  name = 'Höftlyft',
  description = 'Stark och lugn övning för säte och baksida.',
  updated_at = now()
where name = 'Hoftlyft';

update public.exercises
set
  description = 'Kort core-övning som räcker gott för dagens streak.',
  updated_at = now()
where name = 'Plankan'
  and description = 'Kort core-ovning som racker gott for dagens streak.';
