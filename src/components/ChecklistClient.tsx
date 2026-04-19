use client (
  id uuid primary key default gen_random_uuid(),
  room_id text references rooms(id) on delete cascade,
  category text not null,
  name text not null,
  contact text,
  memo text,
  status text default 'searching',
  created_at timestamptz default now()
);

create table if not exists budget_items (
  id uuid primary key default gen_random_uuid(),
  room_id text references rooms(id) on delete cascade,
  category text not null,
  schedule text,
  label text not null,
  planned bigint default 0,
  deposit bigint default 0,
  balance bigint default 0,
  total bigint default 0,
  groom bigint default 0,
  bride bigint default 0,
  status text default '미정',
  note text,
  sort_order int default 0,
  created_at timestamptz default now()
);

alter table vendors enable row level security;
alter table budget_items enable row level security;
create policy "vendors_all" on vendors for all using (true) with check (true);
create policy "budget_all" on budget_items for all using (true) with check (true);
