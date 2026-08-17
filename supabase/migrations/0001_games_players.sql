create extension if not exists pgcrypto;

create table if not exists games (
  id_game uuid primary key default gen_random_uuid(),
  type text not null check (type in ('multiplayer', 'singleplayer')),
  state text not null check (state in ('waiting', 'playing', 'finish')),
  turn smallint not null check (turn in (0, 1)),
  dice smallint not null check (dice between 1 and 6),
  winner uuid null,
  created_at timestamptz not null default now()
);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games (id_game) on delete cascade,
  seat smallint not null check (seat in (0, 1)),
  name text not null,
  type text not null check (type in ('human', 'bot')),
  "table" jsonb not null default '[[-1,-1,-1],[-1,-1,-1],[-1,-1,-1]]',
  points jsonb not null default '{"col1":0,"col2":0,"col3":0}',
  total_points int not null default 0,
  unique (game_id, seat)
);

alter table public.games enable row level security;
alter table public.players enable row level security;