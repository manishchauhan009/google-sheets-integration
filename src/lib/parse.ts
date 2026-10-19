// Pure sheet-row → lead mapping (no I/O) so it can be tested on its own.

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Lead fields a sheet column can be mapped to, with header aliases used for the automatic guess
// (matched case/space/underscore-insensitively; Meta's sheet uses full_name, phone_number, …).
export const FIELDS = {
  row_key: { label: "Lead ID (dedup)", aliases: ["id", "leadid"] },
  name: { label: "Name", aliases: ["fullname", "name", "firstname"] },
  phone: { label: "Phone", aliases: ["phonenumber", "phone", "mobile", "mobilenumber", "contactnumber"] },
  email: { label: "Email", aliases: ["email", "emailaddress"] },
  campaign: { label: "Campaign", aliases: ["campaignname", "campaign"] },
  form: { label: "Form", aliases: ["formname", "form"] },
  lead_created_at: { label: "Lead time", aliases: ["createdtime", "createdat", "created", "date"] },
} as const;

export type Field = keyof typeof FIELDS;
// field → header name. Missing field = automatic guess; "" = not mapped.
export type Mapping = Partial<Record<Field, string>>;

export function cleanHeader(rawHeader: string[] = []) {
  return rawHeader.map((h, j) => String(h ?? "").trim() || `col_${j + 1}`);
}

export function guessMapping(header: string[]): Record<Field, string> {
  const out = {} as Record<Field, string>;
  for (const f of Object.keys(FIELDS) as Field[]) {
    out[f] = header.find((h) => (FIELDS[f].aliases as readonly string[]).includes(norm(h))) ?? "";
  }
  return out;
}

// Meta exports prefix values with "l:", "p:", "f:" … — strip it.
const unprefix = (v: string) => v.replace(/^[a-z]:/i, "").trim();

export type ParsedLead = {
  row_key: string; name: string | null; phone: string | null; email: string | null;
  campaign: string | null; form: string | null; lead_created_at: string | null; data: Record<string, string>;
};

// values[0] is the header row; firstRow is the sheet row number of values[1] (2 for a whole-tab read,
// higher when only new rows are pushed by the Apps Script) so the row-number fallback key stays the same.
export function parseRows(
  values: string[][], mapping: Mapping = {}, firstRow = 2,
): { header: string[]; leads: ParsedLead[] } {
  const [rawHeader = [], ...rows] = values;
  const header = cleanHeader(rawHeader);
  const guess = guessMapping(header);
  const col = {} as Record<Field, number>;
  for (const f of Object.keys(FIELDS) as Field[]) {
    const name = mapping[f] ?? guess[f];
    col[f] = name ? header.indexOf(name) : -1;
  }

  const leads: ParsedLead[] = [];
  rows.forEach((r, i) => {
    if (!r.some((c) => String(c ?? "").trim())) return; // blank row
    const cell = (f: Field) => (col[f] >= 0 ? unprefix(String(r[col[f]] ?? "")) : "") || null;
    const created = cell("lead_created_at");
    const createdDate = created ? new Date(created) : null;
    leads.push({
      // Lead id stays stable if rows get re-sorted; sheet row number is the fallback.
      row_key: cell("row_key") ?? `row:${firstRow + i}`,
      name: cell("name"),
      phone: cell("phone"),
      email: cell("email")?.toLowerCase() ?? null,
      campaign: cell("campaign"),
      form: cell("form"),
      lead_created_at: createdDate && !isNaN(+createdDate) ? createdDate.toISOString() : null,
      data: Object.fromEntries(header.map((h, j) => [h, String(r[j] ?? "")])),
    });
  });
  return { header, leads };
}
