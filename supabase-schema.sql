-- ============================================
-- SCHEMA PADEL TOURNOI
-- Colle ce code dans : Supabase > SQL Editor > New Query > Run
-- ============================================

-- Table des tournois
create table if not exists tournaments (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  date date,
  location text,
  status text default 'registration' check (status in ('registration','pools','bracket','finished')),
  admin_code text not null,
  created_at timestamp with time zone default now()
);

-- Table des équipes
create table if not exists teams (
  id uuid default gen_random_uuid() primary key,
  tournament_id uuid references tournaments(id) on delete cascade,
  player1 text not null,
  player2 text not null,
  level text,
  pool_name text,
  pts integer default 0,
  wins integer default 0,
  losses integer default 0,
  goals_for integer default 0,
  goals_against integer default 0,
  created_at timestamp with time zone default now()
);

-- Table des matchs de poule
create table if not exists pool_matches (
  id uuid default gen_random_uuid() primary key,
  tournament_id uuid references tournaments(id) on delete cascade,
  pool_name text not null,
  team1_id uuid references teams(id),
  team2_id uuid references teams(id),
  score1 integer,
  score2 integer,
  played boolean default false,
  created_at timestamp with time zone default now()
);

-- Table des matchs de phase finale
create table if not exists bracket_matches (
  id uuid default gen_random_uuid() primary key,
  tournament_id uuid references tournaments(id) on delete cascade,
  round_name text not null,
  round_index integer not null,
  match_index integer not null,
  team1_id uuid references teams(id),
  team2_id uuid references teams(id),
  score1 integer,
  score2 integer,
  winner integer,
  played boolean default false,
  created_at timestamp with time zone default now()
);

-- Accès public en lecture (pour que tout le monde voie les scores en live)
alter table tournaments enable row level security;
alter table teams enable row level security;
alter table pool_matches enable row level security;
alter table bracket_matches enable row level security;

create policy "Public read tournaments" on tournaments for select using (true);
create policy "Public read teams" on teams for select using (true);
create policy "Public read pool_matches" on pool_matches for select using (true);
create policy "Public read bracket_matches" on bracket_matches for select using (true);

-- Écriture autorisée via anon key (l'admin_code protège côté app)
create policy "Public insert tournaments" on tournaments for insert with check (true);
create policy "Public update tournaments" on tournaments for update using (true);
create policy "Public insert teams" on teams for insert with check (true);
create policy "Public update teams" on teams for update using (true);
create policy "Public delete teams" on teams for delete using (true);
create policy "Public insert pool_matches" on pool_matches for insert with check (true);
create policy "Public update pool_matches" on pool_matches for update using (true);
create policy "Public insert bracket_matches" on bracket_matches for insert with check (true);
create policy "Public update bracket_matches" on bracket_matches for update using (true);
