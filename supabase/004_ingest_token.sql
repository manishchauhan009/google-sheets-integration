-- Apps Script push: each sheet gets its own secret token, sent by that sheet's script.
-- Leaking one token only lets someone add rows to that one sheet's leads.
alter table sheets add column if not exists ingest_token uuid not null default gen_random_uuid();
