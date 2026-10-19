-- Projects instead of accounts: one account (this app), leads linked to a real-estate project/property.
-- Run once in the SQL editor. Keeps existing sheets and leads.

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);
alter table projects enable row level security;

alter table sheets add column if not exists project_id uuid references projects(id) on delete set null;
alter table leads add column if not exists project_id uuid references projects(id) on delete set null;
create index if not exists leads_project_id_idx on leads (project_id);

alter table sheets drop column if exists account_id;
alter table leads drop column if exists account_id;
drop table if exists accounts;
