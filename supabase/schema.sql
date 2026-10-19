-- Sheet Leads prototype schema (fresh project). Existing databases: run 002_projects.sql, then 003_field_mapping.sql.

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists sheets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete set null, -- default project for this sheet's leads
  spreadsheet_id text not null,
  tab_name text not null,
  title text,
  header jsonb,
  mapping jsonb, -- column → lead field; null = not mapped yet (not synced), {} = automatic guess
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (spreadsheet_id, tab_name)
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references sheets(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  row_key text not null,
  name text,
  phone text,
  email text,
  campaign text,
  form text,
  lead_created_at timestamptz,
  data jsonb not null default '{}',
  received_at timestamptz not null default now(),
  unique (sheet_id, row_key)
);

create index if not exists leads_received_at_idx on leads (received_at desc);
create index if not exists leads_project_id_idx on leads (project_id);

-- All access goes through the Next.js server with the service role. RLS on with no policies = anon key reads nothing.
alter table projects enable row level security;
alter table sheets enable row level security;
alter table leads enable row level security;
