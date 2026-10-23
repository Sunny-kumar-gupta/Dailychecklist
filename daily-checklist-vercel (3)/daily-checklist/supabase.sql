-- Run this once in Supabase: SQL Editor > New query > paste > Run

create table if not exists agents (
  id         text primary key,
  name       text not null,
  sort_order int  not null default 0,
  active     boolean not null default true
);

create table if not exists entries (
  date        date not null,
  agent_id    text not null,
  name        text not null,
  closed      int  not null default 0,
  pending     int  not null default 0,
  in_progress int  not null default 0,
  bug         int  not null default 0,
  ratings     int  not null default 0,
  avg         numeric(3,2),
  saved_at    text,
  updated_at  timestamptz not null default now(),
  primary key (date, agent_id)
);

create table if not exists days (
  date         date primary key,
  team_lead    text,
  reporting_to text,
  aging        jsonb not null default '{}'::jsonb,
  bugs         jsonb not null default '[]'::jsonb,
  low_ratings  text,
  signature    text,
  sign_time    text,
  updated_at   timestamptz not null default now()
);

alter table agents  enable row level security;
alter table entries enable row level security;
alter table days    enable row level security;

drop policy if exists team_all on agents;
drop policy if exists team_all on entries;
drop policy if exists team_all on days;
create policy team_all on agents  for all to anon using (true) with check (true);
create policy team_all on entries for all to anon using (true) with check (true);
create policy team_all on days    for all to anon using (true) with check (true);

insert into agents (id, name, sort_order) values
  ('a_sunny_gupta','Sunny Gupta',1),
  ('a_yash_chaturvedi','Yash Chaturvedi',2),
  ('a_nitika','Nitika',3),
  ('a_sudeshna_mitra','Sudeshna Mitra',4),
  ('a_ujjwal_srivastva','Ujjwal Srivastva',5),
  ('a_nisha_kumari','Nisha Kumari',6),
  ('a_divya','Divya',7)
on conflict (id) do nothing;
