import Link from "next/link";
import { notFound } from "next/navigation";
import { admin, type Sheet } from "@/lib/supabase";
import { readValues } from "@/lib/google";
import { cleanHeader, FIELDS, guessMapping, type Field } from "@/lib/parse";
import { saveMapping } from "../../../actions";

export const dynamic = "force-dynamic";

export default async function MapFields({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = await admin().from("sheets").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const sheet = data as Sheet;

  let values: string[][] = [];
  let error = "";
  try {
    values = await readValues(sheet.spreadsheet_id, sheet.tab_name);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const header = cleanHeader(values[0]);
  const sample = values.slice(1, 6);
  // Saved choice wins; fields never saved (or a new sheet) start from the automatic guess.
  const guess = guessMapping(header);
  const current = (f: Field) => {
    const saved = sheet.mapping?.[f];
    return saved !== undefined && (saved === "" || header.includes(saved)) ? saved : guess[f];
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/setup" className="text-sm text-slate-500 hover:text-slate-900">← Setup</Link>
        <h1 className="mt-1 text-xl font-semibold">Map fields: {sheet.title} / {sheet.tab_name}</h1>
        <p className="text-sm text-slate-600">
          Pick which sheet column fills each lead field. Every column is still saved with the lead and shown when you open it.
        </p>
      </div>

      {error && <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-800">{error}</p>}
      {!error && header.length === 0 && (
        <p className="rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800">The tab is empty. Row 1 must hold the column names.</p>
      )}

      {header.length > 0 && (
        <form action={saveMapping} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
          <input type="hidden" name="id" value={sheet.id} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(FIELDS) as Field[]).map((f) => (
              <label key={f} className="space-y-1 text-sm">
                <span className="font-medium">{FIELDS[f].label}</span>
                <select name={f} defaultValue={current(f)} className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm">
                  <option value="">— not in this sheet —</option>
                  {header.map((h, j) => <option key={j} value={h}>{h}</option>)}
                </select>
              </label>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Lead ID prevents duplicates. Without it the row number is used, so don&apos;t re-sort the sheet.
            {sheet.mapping && " Changing the Lead ID column re-imports this sheet's leads, and hand-set projects reset."}
          </p>
          <button className="h-9 rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700">
            Save mapping &amp; import
          </button>
        </form>
      )}

      {sample.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Sheet preview (first {sample.length} rows)</h2>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>{header.map((h, j) => <th key={j} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {sample.map((r, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    {header.map((_, j) => <td key={j} className="whitespace-nowrap px-3 py-2">{r[j] ?? ""}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
