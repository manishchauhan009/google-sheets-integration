import Link from "next/link";
import { admin, type Project, type Sheet } from "@/lib/supabase";
import { addSheet, createProject, deleteProject, removeSheet, setSheetProject, syncNow } from "../actions";

export const dynamic = "force-dynamic";

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "never";
const input = "h-9 rounded-md border border-slate-300 bg-white px-3 text-sm";
const btn = "h-9 rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700";
const btnGhost = "h-8 rounded-md border border-slate-300 px-3 text-xs hover:bg-slate-50";

function ProjectOptions({ projects }: { projects: Project[] }) {
  return (
    <>
      <option value="">No project</option>
      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </>
  );
}

export default async function Setup({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const db = admin();
  const [{ data: projectRows }, { data: sheetRows }] = await Promise.all([
    db.from("projects").select("*").order("name"),
    db.from("sheets").select("*").order("created_at"),
  ]);
  const projects = (projectRows ?? []) as Project[];
  const sheets = (sheetRows ?? []) as Sheet[];
  const count = async (col: "sheet_id" | "project_id", id: string) =>
    (await db.from("leads").select("id", { count: "exact", head: true }).eq(col, id)).count ?? 0;
  const [perSheet, perProject] = await Promise.all([
    Promise.all(sheets.map(async (s) => [s.id, await count("sheet_id", s.id)] as const)).then(Object.fromEntries),
    Promise.all(projects.map(async (p) => [p.id, await count("project_id", p.id)] as const)).then(Object.fromEntries),
  ]) as [Record<string, number>, Record<string, number>];

  return (
    <div className="space-y-6">
      {ok && <p className="rounded-md bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{ok}</p>}
      {error && <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-800">{error}</p>}

      <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <h2 className="mb-2 font-semibold">How it works</h2>
        <ol className="list-decimal space-y-1 pl-5 text-slate-600">
          <li>In Meta Ads Manager, connect each lead form to a Google Sheet.</li>
          <li>Share that sheet (Viewer) with <code className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-900">{process.env.GOOGLE_SA_EMAIL || "GOOGLE_SA_EMAIL not set"}</code></li>
          <li>Add it below, map its columns to lead fields, and link it to a project. Its leads get that project; you can change any lead on the dashboard.</li>
          <li>New rows are pulled whenever the dashboard is opened or refreshed.</li>
        </ol>
      </section>

      <section className="grid gap-4 md:grid-cols-[1fr_2fr]">
        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Projects</h2>
          <form action={createProject} className="flex gap-2">
            <input name="name" placeholder="e.g. Skyline Towers" className={`${input} min-w-0 flex-1`} required />
            <button className={btn}>Add</button>
          </form>
          {projects.length === 0 && <p className="text-xs text-slate-500">No projects yet.</p>}
          <ul className="divide-y divide-slate-100 text-sm">
            {projects.map((p) => (
              <li key={p.id} className="flex items-center gap-2 py-2">
                <span className="flex-1 font-medium">{p.name}</span>
                <span className="text-xs text-slate-500">{perProject[p.id] ?? 0} leads</span>
                <form action={deleteProject}><input type="hidden" name="id" value={p.id} /><button className={`${btnGhost} text-red-600`}>Delete</button></form>
              </li>
            ))}
          </ul>
        </div>

        <form action={addSheet} className="space-y-2 self-start rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Add sheet</h2>
          <div className="flex flex-wrap gap-2">
            <input name="url" placeholder="Google Sheet URL" className={`${input} min-w-64 flex-1`} required />
            <input name="tab" placeholder="Tab (default: first)" className={`${input} w-44`} />
            <select name="project_id" className={input} defaultValue=""><ProjectOptions projects={projects} /></select>
          </div>
          <button className={btn}>Add &amp; map fields</button>
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <h2 className="border-b border-slate-100 px-4 py-2 font-semibold">Sheets <span className="text-xs font-normal text-slate-500">{sheets.length}</span></h2>
        {sheets.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">No sheets yet.</p>}
        {sheets.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-4 py-3 text-sm first:border-t-0">
            <div className="min-w-0 flex-1">
              <a href={`https://docs.google.com/spreadsheets/d/${s.spreadsheet_id}`} target="_blank" className="font-medium text-blue-700 hover:underline">
                {s.title ?? s.spreadsheet_id}
              </a>{" "}
              <span className="text-slate-500">/ {s.tab_name}</span>
              <div className="text-xs text-slate-500">
                {s.mapping
                  ? <>{perSheet[s.id] ?? 0} leads · synced {fmt(s.last_synced_at)}</>
                  : <span className="font-medium text-amber-600">Fields not mapped yet: nothing imported</span>}
              </div>
              {s.last_error && <div className="mt-1 text-xs text-red-600">{s.last_error}</div>}
            </div>
            <form action={setSheetProject} className="flex gap-1">
              <input type="hidden" name="id" value={s.id} />
              <select name="project_id" defaultValue={s.project_id ?? ""} className={`${input} h-8 text-xs`}><ProjectOptions projects={projects} /></select>
              <button className={btnGhost}>Save</button>
            </form>
            <Link href={`/setup/map/${s.id}`} className={`${btnGhost} inline-flex items-center`}>Map fields</Link>
            <form action={syncNow}><input type="hidden" name="id" value={s.id} /><button className={btnGhost}>Sync now</button></form>
            <form action={removeSheet}><input type="hidden" name="id" value={s.id} /><button className={`${btnGhost} text-red-600`}>Remove</button></form>
          </div>
        ))}
      </section>
    </div>
  );
}
