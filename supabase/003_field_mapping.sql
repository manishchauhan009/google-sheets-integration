-- Per-sheet column mapping: { "name": "Client Name", "phone": "Mobile", ... }.
-- null = not mapped yet (sheet is not synced); {} = automatic guess. Existing sheets keep working on automatic.
alter table sheets add column if not exists mapping jsonb;
update sheets set mapping = '{}' where mapping is null;
