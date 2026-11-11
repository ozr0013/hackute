-- Utah HackMatch schema
-- Run this once in the Supabase SQL editor (or `psql`) on a fresh project, then run seed.sql.
-- Every table has Row Level Security enabled.

-- ---------------------------------------------------------------------------
-- 1. utah.edu only: reject any auth user whose email is not utah.edu
--    (subdomains such as umail.utah.edu are allowed)
-- ---------------------------------------------------------------------------
create or replace function public.is_utah_email(p_email text)
returns boolean
language sql
immutable
as $$
  select coalesce(lower(p_email) ~ '^[^@\s]+@([a-z0-9-]+\.)*utah\.edu$', false);
$$;

create or replace function public.enforce_utah_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_utah_email(new.email) then
    raise exception 'Only utah.edu email addresses can sign up for Utah HackMatch'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_utah_email on auth.users;
create trigger enforce_utah_email
  before insert or update of email on auth.users
  for each row execute function public.enforce_utah_email();

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  full_name    text not null check (char_length(full_name) between 1 and 100),
  major        text check (char_length(major) <= 100),
  year         text not null check (year in ('Freshman', 'Sophomore', 'Junior', 'Senior', 'Grad')),
  skills       text[] not null default '{}',
  interests    text[] not null default '{}',
  bio          text check (char_length(bio) <= 300),
  github_url   text check (char_length(github_url) <= 200),
  linkedin_url text check (char_length(linkedin_url) <= 200),
  discord      text check (char_length(discord) <= 64),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.hackathons (
  id        uuid primary key default gen_random_uuid(),
  slug      text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name      text not null,
  starts_at timestamptz not null,
  ends_at   timestamptz not null,
  location  text,
  tracks    text[] not null default '{}',
  check (ends_at >= starts_at)
);

create table if not exists public.participations (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  hackathon_id uuid not null references public.hackathons (id) on delete cascade,
  track        text,
  mode         text not null check (mode in ('looking_for_team', 'recruiting')),
  available    boolean not null default true,
  created_at   timestamptz not null default now(),
  primary key (user_id, hackathon_id)
);

create table if not exists public.teams (
  id           uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references public.hackathons (id) on delete cascade,
  owner_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 60),
  track        text,
  description  text check (char_length(description) <= 500),
  roles_needed text[] not null default '{}',
  max_size     int not null default 4 check (max_size between 2 and 6),
  created_at   timestamptz not null default now()
);
create index if not exists teams_hackathon_idx on public.teams (hackathon_id);

create table if not exists public.team_members (
  team_id   uuid not null references public.teams (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index if not exists team_members_user_idx on public.team_members (user_id);

create table if not exists public.join_requests (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  direction  text not null check (direction in ('request', 'invite')),
  message    text check (char_length(message) <= 300),
  status     text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);
create index if not exists join_requests_user_idx on public.join_requests (user_id);

-- Picker options for skills and interests (read only for clients)
create table if not exists public.tag_options (
  kind text not null check (kind in ('skill', 'interest')),
  name text not null,
  primary key (kind, name)
);

-- ---------------------------------------------------------------------------
-- 3. Helper functions (security definer so RLS policies don't recurse)
-- ---------------------------------------------------------------------------
create or replace function public.is_team_owner(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.teams where id = p_team_id and owner_id = auth.uid());
$$;

create or replace function public.is_on_team_in_hackathon(p_user_id uuid, p_hackathon_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where tm.user_id = p_user_id and t.hackathon_id = p_hackathon_id
  );
$$;

-- profiles.email always mirrors the auth email; clients can't spoof it
create or replace function public.profiles_set_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select u.email into new.email from auth.users u where u.id = new.id;
  if new.email is null then
    raise exception 'No auth user for profile %', new.id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_email on public.profiles;
create trigger profiles_set_email
  before insert or update on public.profiles
  for each row execute function public.profiles_set_email();

-- ---------------------------------------------------------------------------
-- 4. Rule 2: team owner becomes a member and is marked unavailable
-- ---------------------------------------------------------------------------
create or replace function public.on_team_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.team_members (team_id, user_id)
  values (new.id, new.owner_id)
  on conflict do nothing;

  insert into public.participations (user_id, hackathon_id, track, mode, available)
  values (new.owner_id, new.hackathon_id, new.track, 'recruiting', false)
  on conflict (user_id, hackathon_id)
  do update set available = false, mode = 'recruiting';

  -- the owner's own pending requests to other teams in this hackathon are moot now
  update public.join_requests jr
  set status = 'declined'
  from public.teams t
  where jr.team_id = t.id
    and t.hackathon_id = new.hackathon_id
    and jr.user_id = new.owner_id
    and jr.status = 'pending';

  return new;
end;
$$;

drop trigger if exists on_team_created on public.teams;
create trigger on_team_created
  after insert on public.teams
  for each row execute function public.on_team_created();

-- ---------------------------------------------------------------------------
-- 5. Rule 3: accept a join request or invite atomically
-- ---------------------------------------------------------------------------
create or replace function public.accept_join_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r     public.join_requests;
  t     public.teams;
  n     int;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select * into r from public.join_requests where id = p_request_id for update;
  if not found then
    raise exception 'Request not found';
  end if;
  if r.status <> 'pending' then
    raise exception 'This request is no longer pending';
  end if;

  -- lock the team row so two accepts can't overfill it
  select * into t from public.teams where id = r.team_id for update;

  if r.direction = 'request' and t.owner_id <> auth.uid() then
    raise exception 'Only the team owner can accept a join request';
  end if;
  if r.direction = 'invite' and r.user_id <> auth.uid() then
    raise exception 'Only the invited student can accept an invite';
  end if;

  select count(*) into n from public.team_members where team_id = t.id;
  if n >= t.max_size then
    raise exception 'Team is full';
  end if;

  if public.is_on_team_in_hackathon(r.user_id, t.hackathon_id) then
    raise exception 'Already on a team for this hackathon';
  end if;

  insert into public.team_members (team_id, user_id) values (t.id, r.user_id);

  update public.join_requests set status = 'accepted' where id = r.id;

  insert into public.participations (user_id, hackathon_id, track, mode, available)
  values (r.user_id, t.hackathon_id, t.track, 'looking_for_team', false)
  on conflict (user_id, hackathon_id) do update set available = false;

  -- auto decline that user's other pending requests/invites in the same hackathon
  update public.join_requests jr
  set status = 'declined'
  from public.teams t2
  where jr.team_id = t2.id
    and t2.hackathon_id = t.hackathon_id
    and jr.user_id = r.user_id
    and jr.status = 'pending'
    and jr.id <> r.id;

  -- if the team just filled up, close out its remaining pending requests
  if n + 1 >= t.max_size then
    update public.join_requests
    set status = 'declined'
    where team_id = t.id and status = 'pending';
  end if;
end;
$$;

-- Decline (or cancel) a pending request/invite. Either side may do this.
create or replace function public.decline_join_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.join_requests;
begin
  select * into r from public.join_requests where id = p_request_id for update;
  if not found then
    raise exception 'Request not found';
  end if;
  if r.user_id <> auth.uid() and not public.is_team_owner(r.team_id) then
    raise exception 'Not allowed';
  end if;
  if r.status <> 'pending' then
    raise exception 'This request is no longer pending';
  end if;
  update public.join_requests set status = 'declined' where id = r.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Rule 5: contact info only for teammates / other side of a pending request
-- ---------------------------------------------------------------------------
create or replace function public.get_contact(p_user_id uuid)
returns table (email text, discord text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.email, p.discord
  from public.profiles p
  where p.id = p_user_id
    and auth.uid() is not null
    and (
      -- yourself
      p_user_id = auth.uid()
      -- teammates
      or exists (
        select 1
        from public.team_members a
        join public.team_members b on a.team_id = b.team_id
        where a.user_id = auth.uid() and b.user_id = p_user_id
      )
      -- I own a team and they have a pending request/invite with it
      or exists (
        select 1
        from public.join_requests jr
        join public.teams t on t.id = jr.team_id
        where jr.status = 'pending' and jr.user_id = p_user_id and t.owner_id = auth.uid()
      )
      -- they own a team and I have a pending request/invite with it
      or exists (
        select 1
        from public.join_requests jr
        join public.teams t on t.id = jr.team_id
        where jr.status = 'pending' and jr.user_id = auth.uid() and t.owner_id = p_user_id
      )
    );
$$;

-- ---------------------------------------------------------------------------
-- 7. Rule 4: open teams view
-- ---------------------------------------------------------------------------
create or replace view public.open_teams
with (security_invoker = true)
as
select t.*, c.member_count
from public.teams t
cross join lateral (
  select count(*)::int as member_count from public.team_members m where m.team_id = t.id
) c
where c.member_count < t.max_size;

-- ---------------------------------------------------------------------------
-- 8. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.hackathons     enable row level security;
alter table public.participations enable row level security;
alter table public.teams          enable row level security;
alter table public.team_members   enable row level security;
alter table public.join_requests  enable row level security;
alter table public.tag_options    enable row level security;

-- profiles: any signed in student can see public fields; only you can write yours
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated with check (id = auth.uid());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- hackathons: public read, writes only via SQL (no policies for insert/update)
drop policy if exists hackathons_select on public.hackathons;
create policy hackathons_select on public.hackathons
  for select to anon, authenticated using (true);

-- tag options: public read
drop policy if exists tag_options_select on public.tag_options;
create policy tag_options_select on public.tag_options
  for select to anon, authenticated using (true);

-- participations: visible to signed in students; you manage your own
drop policy if exists participations_select on public.participations;
create policy participations_select on public.participations
  for select to authenticated using (true);
drop policy if exists participations_insert on public.participations;
create policy participations_insert on public.participations
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists participations_update on public.participations;
create policy participations_update on public.participations
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists participations_delete on public.participations;
create policy participations_delete on public.participations
  for delete to authenticated using (user_id = auth.uid());

-- teams: visible to signed in students; create one if you aren't on a team yet
drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams
  for select to authenticated using (true);
drop policy if exists teams_insert on public.teams;
create policy teams_insert on public.teams
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and not public.is_on_team_in_hackathon(auth.uid(), hackathon_id)
  );
drop policy if exists teams_update on public.teams;
create policy teams_update on public.teams
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists teams_delete on public.teams;
create policy teams_delete on public.teams
  for delete to authenticated using (owner_id = auth.uid());

-- team_members: readable; writes only through triggers / accept_join_request
drop policy if exists team_members_select on public.team_members;
create policy team_members_select on public.team_members
  for select to authenticated using (true);

-- join_requests: only the student and the team owner can see a request
drop policy if exists join_requests_select on public.join_requests;
create policy join_requests_select on public.join_requests
  for select to authenticated
  using (user_id = auth.uid() or public.is_team_owner(team_id));
drop policy if exists join_requests_insert on public.join_requests;
create policy join_requests_insert on public.join_requests
  for insert to authenticated
  with check (
    status = 'pending'
    and (
      (direction = 'request' and user_id = auth.uid() and not public.is_team_owner(team_id))
      or (direction = 'invite' and public.is_team_owner(team_id) and user_id <> auth.uid())
    )
  );
-- status changes go through accept_join_request / decline_join_request

-- ---------------------------------------------------------------------------
-- 9. Grants. Email and Discord are NOT selectable directly; use get_contact().
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

revoke all on public.profiles from anon, authenticated;
grant select (id, full_name, major, year, skills, interests, bio, github_url, linkedin_url, created_at, updated_at)
  on public.profiles to authenticated;
grant insert (id, full_name, major, year, skills, interests, bio, github_url, linkedin_url, discord)
  on public.profiles to authenticated;
grant update (full_name, major, year, skills, interests, bio, github_url, linkedin_url, discord)
  on public.profiles to authenticated;

revoke all on public.hackathons, public.tag_options from anon, authenticated;
grant select on public.hackathons, public.tag_options to anon, authenticated;

revoke all on public.participations, public.teams, public.team_members, public.join_requests from anon, authenticated;
grant select, insert, update, delete on public.participations to authenticated;
grant select, insert, update, delete on public.teams to authenticated;
grant select on public.team_members to authenticated;
grant select, insert on public.join_requests to authenticated;

revoke all on public.open_teams from anon, authenticated;
grant select on public.open_teams to authenticated;

revoke execute on function public.accept_join_request(uuid)  from public, anon;
revoke execute on function public.decline_join_request(uuid) from public, anon;
revoke execute on function public.get_contact(uuid)          from public, anon;
grant execute on function public.accept_join_request(uuid)  to authenticated;
grant execute on function public.decline_join_request(uuid) to authenticated;
grant execute on function public.get_contact(uuid)          to authenticated;

-- Hardening: trigger functions are never called directly; helpers are only for signed in users
alter function public.is_utah_email(text) set search_path = '';
revoke execute on function public.enforce_utah_email() from public, anon, authenticated;
revoke execute on function public.profiles_set_email() from public, anon, authenticated;
revoke execute on function public.on_team_created() from public, anon, authenticated;
revoke execute on function public.is_team_owner(uuid) from public, anon;
revoke execute on function public.is_on_team_in_hackathon(uuid, uuid) from public, anon;
grant execute on function public.is_team_owner(uuid) to authenticated;
grant execute on function public.is_on_team_in_hackathon(uuid, uuid) to authenticated;
