import { admin, type Sheet } from "./supabase";
import { readValues } from "./google";
import { parseRows, type Mapping, type ParsedLead } from "./parse";

async function fail(sheet: Sheet, err: unknown): Promise<never> {
  const msg = err instanceof Error ? err.message : String(err);
  await admin().from("sheets").update({ last_error: msg }).eq("id", sheet.id);
  throw new Error(msg);
}

async function upsertChunks(rows: object[], ignoreDuplicates: boolean) {
  let affected = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const { data, error } = await admin()
      .from("leads")
      .upsert(rows.slice(i, i + 500), { onConflict: "sheet_id,row_key", ignoreDuplicates })
      .select("id");
    if (error) throw new Error(error.message);
    affected += data?.length ?? 0;
  }
  return affected;
}

const withSheet = (sheet: Sheet, leads: ParsedLead[]) =>
  leads.map((l) => ({ ...l, sheet_id: sheet.id, project_id: sheet.project_id }));

// Reads the whole tab and inserts rows not seen before. Safe to run any number of times.
// Sheets without a saved mapping (just added, not confirmed) are skipped.
// ponytail: full read on every sync; read from the last synced row if tabs pass ~10k rows.
export async function syncSheet(sheet: Sheet) {
  if (!sheet.mapping) return 0;
  try {
    const { header, leads } = parseRows(await readValues(sheet.spreadsheet_id, sheet.tab_name), sheet.mapping);
    // New rows take the sheet's project; existing rows are skipped, so a project changed by hand sticks.
    const inserted = await upsertChunks(withSheet(sheet, leads), true);
    await admin().from("sheets").update({ header, last_synced_at: new Date().toISOString(), last_error: null }).eq("id", sheet.id);
    return inserted;
  } catch (err) {
    return fail(sheet, err);
  }
}

// Saves a new mapping and re-applies it to leads already imported from this sheet.
export async function remapSheet(sheet: Sheet, mapping: Mapping) {
  const db = admin();
  const idChanged = sheet.mapping !== null && (sheet.mapping.row_key ?? null) !== (mapping.row_key ?? null);
  await db.from("sheets").update({ mapping }).eq("id", sheet.id);
  const next = { ...sheet, mapping };
  try {
    // A different Lead ID column means different dedup keys: start this sheet over (projects reset to the sheet's).
    if (idChanged) await db.from("leads").delete().eq("sheet_id", sheet.id);
    const inserted = await syncSheet(next);
    if (idChanged) return { inserted, updated: 0 };
    // Every row exists now: update mapped fields only (project_id and received_at untouched).
    const { leads } = parseRows(await readValues(sheet.spreadsheet_id, sheet.tab_name), mapping);
    // Same id twice in a sheet: last row wins (Postgres can't update one row twice in a batch).
    const unique = [...new Map(leads.map((l) => [l.row_key, { ...l, sheet_id: sheet.id }])).values()];
    const updated = await upsertChunks(unique, false);
    return { inserted, updated: updated - inserted };
  } catch (err) {
    return fail(next, err);
  }
}

// Pull on demand (dashboard open / Refresh): no cron, no webhook. Errors are stored per sheet and shown on /setup.
export async function syncAll() {
  const { data } = await admin().from("sheets").select("*");
  await Promise.allSettled(((data ?? []) as Sheet[]).map(syncSheet));
}
