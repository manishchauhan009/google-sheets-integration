import { timingSafeEqual } from "node:crypto";
import { admin, type Sheet } from "@/lib/supabase";
import { ingestRows } from "@/lib/sync";

const MAX_ROWS = 2000; // the script sends in batches of 500

const json = (body: object, status = 200) => Response.json(body, { status });
const isStrings = (a: unknown): a is string[] => Array.isArray(a) && a.every((v) => typeof v === "string");

// Called by the Apps Script inside a lead sheet every 5 minutes with the rows added since its last push.
// Body: { sheetId, header: string[], rows: string[][], firstRow: number }. Header: Authorization: Bearer <ingest_token>.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!body || typeof body.sheetId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.sheetId)) {
    return json({ error: "sheetId missing" }, 400);
  }

  const { data } = await admin().from("sheets").select("*").eq("id", body.sheetId).maybeSingle();
  const sheet = data as Sheet | null;
  const given = Buffer.from(token);
  const expected = Buffer.from(sheet?.ingest_token ?? "");
  const ok = sheet && expected.length > 0 && given.length === expected.length && timingSafeEqual(given, expected);
  if (!ok) return json({ error: "unauthorized" }, 401);

  const { header, rows, firstRow } = body;
  if (!isStrings(header) || !Array.isArray(rows) || !rows.every(isStrings) || !Number.isInteger(firstRow) || firstRow < 2) {
    return json({ error: "expected header: string[], rows: string[][], firstRow >= 2" }, 400);
  }
  if (rows.length > MAX_ROWS) return json({ error: `max ${MAX_ROWS} rows per call` }, 413);
  // 409 keeps the script's position, so these rows are sent again once the mapping is saved.
  if (!sheet.mapping) return json({ error: "map this sheet's fields on /setup first" }, 409);

  try {
    return json({ inserted: await ingestRows(sheet, header, rows, firstRow) });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
}
