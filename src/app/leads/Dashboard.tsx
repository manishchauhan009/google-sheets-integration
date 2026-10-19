"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Lead, Project, Sheet } from "@/lib/supabase";
import { setLeadProject } from "../actions";

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

export default function Dashboard({
  projects, sheets, leads, syncedAt,
}: {
  projects: Project[]; sheets: Sheet[]; leads: Lead[]; syncedAt: string;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [projectId, setProjectId] = useState(""); // "" = all, "none" = unlinked
  const [sheetId, setSheetId] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const sheetName = useMemo(
    () => Object.fromEntries(sheets.map((s) => [s.id, `${s.title ?? s.spreadsheet_id} / ${s.tab_name}`])),
    [sheets],
  );

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return leads.filter(
      (l) =>
        (!projectId || (projectId === "none" ? !l.project_id : l.project_id === projectId)) &&
        (!sheetId || l.sheet_id === sheetId) &&
        (!needle || [l.name, l.phone, l.email, l.campaign, l.form].some((v) => v?.toLowerCase().includes(needle))),
    );
  }, [leads, projectId, sheetId, q]);

  const changeProject = (leadId: string, value: string) =>
    startRefresh(async () => {
      await setLeadProject(leadId, value || null);
      router.refresh();
    });

  const input = "h-9 rounded-md border border-slate-300 bg-white px-3 text-sm";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">
          Leads <span className="ml-2 align-middle text-xs font-normal text-slate-500">synced {fmt(syncedAt)}</span>
        </h1>
        <button
          onClick={() => startRefresh(() => router.refresh())}
          disabled={refreshing}
          className="h-9 rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
        >
          {refreshing ? "Syncing…" : "Refresh"}
        </button>
        <input className={`${input} w-56`} placeholder="Search name, phone, email…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={input} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">All projects</option>
          <option value="none">No project</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className={input} value={sheetId} onChange={(e) => setSheetId(e.target.value)}>
          <option value="">All sheets</option>
          {sheets.map((s) => (
            <option key={s.id} value={s.id}>{sheetName[s.id]}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {["Name", "Phone", "Email", "Campaign / Form", "Project", "Sheet", "Lead time", "Received"].map((h) => (
                <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-slate-500">
                {leads.length ? "No leads match the filters." : "No leads yet. Add a sheet on the Setup page."}
              </td></tr>
            )}
            {shown.map((l) => (
              <Fragment key={l.id}>
                <tr onClick={() => setOpen(open === l.id ? null : l.id)} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium">{l.name ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2">{l.phone ? <a href={`tel:${l.phone}`} onClick={(e) => e.stopPropagation()} className="text-blue-600">{l.phone}</a> : "—"}</td>
                  <td className="px-3 py-2">{l.email ?? "—"}</td>
                  <td className="px-3 py-2">{l.campaign ?? "—"}{l.form ? <div className="text-xs text-slate-500">{l.form}</div> : null}</td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={l.project_id ?? ""}
                      onChange={(e) => changeProject(l.id, e.target.value)}
                      disabled={refreshing}
                      className="h-8 max-w-40 rounded-md border border-slate-300 bg-white px-2 text-xs"
                    >
                      <option value="">No project</option>
                      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{sheetName[l.sheet_id] ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{fmt(l.lead_created_at)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{fmt(l.received_at)}</td>
                </tr>
                {open === l.id && (
                  <tr className="bg-slate-50">
                    <td colSpan={8} className="px-3 py-3">
                      <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
                        {Object.entries(l.data).map(([k, v]) => (
                          <div key={k} className="flex gap-2"><dt className="text-slate-500">{k}:</dt><dd className="break-all">{v || "—"}</dd></div>
                        ))}
                      </dl>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        Showing {shown.length} of {leads.length} leads{leads.length >= 1000 ? " (latest 1000)" : ""}
      </p>
    </div>
  );
}
