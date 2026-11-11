-- Sample data for Utah HackMatch. Safe to re-run.

insert into public.hackathons (slug, name, starts_at, ends_at, location, tracks) values
  ('hacktheu-2026', 'HackTheU 2026', '2026-11-21 09:00-07', '2026-11-22 17:00-07',
   'Crocker Science Center, University of Utah',
   array['AI/ML', 'Health Tech', 'Sustainability', 'Fintech', 'Open Innovation']),
  ('u-winter-build-2027', 'U of U Winter Build Weekend 2027', '2027-01-30 10:00-07', '2027-01-31 16:00-07',
   'Merrill Engineering Building, University of Utah',
   array['Developer Tools', 'Games', 'Social Good', 'Hardware'])
on conflict (slug) do update set
  name = excluded.name,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  location = excluded.location,
  tracks = excluded.tracks;

insert into public.tag_options (kind, name) values
  ('skill', 'Frontend'), ('skill', 'Backend'), ('skill', 'Full Stack'), ('skill', 'Mobile'),
  ('skill', 'iOS'), ('skill', 'Android'), ('skill', 'UI/UX Design'), ('skill', 'Product'),
  ('skill', 'Machine Learning'), ('skill', 'Data Science'), ('skill', 'LLMs / Agents'),
  ('skill', 'Computer Vision'), ('skill', 'DevOps'), ('skill', 'Cloud'), ('skill', 'Databases'),
  ('skill', 'Security'), ('skill', 'Hardware / Embedded'), ('skill', 'Game Dev'),
  ('skill', 'Blockchain'), ('skill', 'Pitching'),
  ('skill', 'React'), ('skill', 'Next.js'), ('skill', 'TypeScript'), ('skill', 'Python'),
  ('skill', 'Java'), ('skill', 'C++'), ('skill', 'Go'), ('skill', 'Rust'), ('skill', 'Swift'),
  ('skill', 'Kotlin'), ('skill', 'SQL'), ('skill', 'Figma'),
  ('interest', 'AI'), ('interest', 'Health'), ('interest', 'Education'), ('interest', 'Climate'),
  ('interest', 'Finance'), ('interest', 'Gaming'), ('interest', 'Social Impact'),
  ('interest', 'Developer Tools'), ('interest', 'Startups'), ('interest', 'Music'),
  ('interest', 'Sports'), ('interest', 'Accessibility'), ('interest', 'Robotics'),
  ('interest', 'Outdoors'), ('interest', 'Art & Design')
on conflict do nothing;
