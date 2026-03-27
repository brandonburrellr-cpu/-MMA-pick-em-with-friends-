create table if not exists submissions (
  id bigint generated always as identity primary key,
  event_id text not null,
  player_name text not null,
  picks jsonb not null,
  created_at timestamptz not null default now(),
  unique (event_id, player_name)
);

create table if not exists results (
  id bigint generated always as identity primary key,
  event_id text not null,
  fight_key text not null,
  winner text not null,
  created_at timestamptz not null default now(),
  unique (event_id, fight_key)
);

alter table submissions enable row level security;
alter table results enable row level security;

create policy "Anyone can read submissions"
on submissions for select
using (true);

create policy "Anyone can insert submissions"
on submissions for insert
with check (true);

create policy "Anyone can update submissions"
on submissions for update
using (true)
with check (true);

create policy "Anyone can read results"
on results for select
using (true);

create policy "Anyone can insert results"
on results for insert
with check (true);

create policy "Anyone can update results"
on results for update
using (true)
with check (true);
