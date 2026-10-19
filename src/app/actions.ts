"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { admin, type Sheet } from "@/lib/supabase";
import { getSpreadsheet, spreadsheetIdFrom } from "@/lib/google";
import { remapSheet, syncSheet } from "@/lib/sync";
import { FIELDS, type Field, type Mapping } from "@/lib/parse";

const back = (params: Record<string, string>): never => redirect(`/setup?${new URLSearchParams(params)}`);
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const projectIdFrom = (form: FormData) => String(form.get("project_id") ?? "") || null;

function refresh() {
  revalidatePath("/setup");
  revalidatePath("/leads");
}

export async function createProject(form: FormData) {
  const name = String(form.get("name") ?? "").trim();
  if (!name) back({ error: "Project name is required" });
  const { error } = await admin().from("projects").insert({ name });
  if (error) back({ error: error.code === "23505" ? `Project "${name}" already exists` : error.message });
  refresh();
  back({ ok: `Project "${name}" created` });
}

export async function deleteProject(form: FormData) {
  // Leads and sheets stay; they just become unlinked (on delete set null).
  await admin().from("projects").delete().eq("id", String(form.get("id")));
  refresh();
  back({ ok: "Project deleted; its leads are now unlinked" });
}

export async function addSheet(form: FormData) {
  const url = String(form.get("url") ?? "").trim();
  const tabInput = String(form.get("tab") ?? "").trim();
  if (!url) back({ error: "Paste the sheet URL" });

  const spreadsheetId = spreadsheetIdFrom(url);
  let info: Awaited<ReturnType<typeof getSpreadsheet>>;
  try {
    info = await getSpreadsheet(spreadsheetId);
  } catch (e) {
    return back({ error: msg(e) });
  }
  const tab = tabInput || info.tabs[0];
  if (!info.tabs.includes(tab)) back({ error: `Tab "${tab}" not found. Tabs: ${info.tabs.join(", ")}` });

  const { data, error } = await admin()
    .from("sheets")
    .insert({ project_id: projectIdFrom(form), spreadsheet_id: spreadsheetId, tab_name: tab, title: info.title })
    .select("*")
    .single();
  if (error) back({ error: error.code === "23505" ? "This sheet tab is already added" : error.message });

  // Nothing is imported until the column mapping is confirmed.
  refresh();
  redirect(`/setup/map/${(data as Sheet).id}`);
}

export async function saveMapping(form: FormData) {
  const { data } = await admin().from("sheets").select("*").eq("id", String(form.get("id"))).single();
  if (!data) back({ error: "Sheet not found" });
  const sheet = data as Sheet;
  const mapping: Mapping = {};
  for (const f of Object.keys(FIELDS) as Field[]) mapping[f] = String(form.get(f) ?? "");

  let result: Record<string, string>;
  try {
    const { inserted, updated } = await remapSheet(sheet, mapping);
    result = { ok: `${sheet.title}: mapping saved; ${inserted} imported${updated ? `, ${updated} updated` : ""}` };
  } catch (e) {
    result = { error: `${sheet.title}: ${msg(e)}` };
  }
  refresh();
  back(result);
}

// Changing a sheet's project also moves its leads that were still on the old project (hand-picked ones stay).
export async function setSheetProject(form: FormData) {
  const db = admin();
  const { data } = await db.from("sheets").select("*").eq("id", String(form.get("id"))).single();
  if (!data) back({ error: "Sheet not found" });
  const sheet = data as Sheet;
  const projectId = projectIdFrom(form);
  await db.from("sheets").update({ project_id: projectId }).eq("id", sheet.id);
  const leads = db.from("leads").update({ project_id: projectId }).eq("sheet_id", sheet.id);
  await (sheet.project_id ? leads.eq("project_id", sheet.project_id) : leads.is("project_id", null));
  refresh();
  back({ ok: `${sheet.title}: project updated` });
}

// Called from the dashboard row dropdown (no redirect; the client refreshes).
export async function setLeadProject(leadId: string, projectId: string | null) {
  const { error } = await admin().from("leads").update({ project_id: projectId }).eq("id", leadId);
  if (error) throw new Error(error.message);
  revalidatePath("/leads");
}

export async function syncNow(form: FormData) {
  const { data } = await admin().from("sheets").select("*").eq("id", String(form.get("id"))).single();
  if (!data) back({ error: "Sheet not found" });
  const sheet = data as Sheet;
  if (!sheet.mapping) redirect(`/setup/map/${sheet.id}`);
  let result: Record<string, string>;
  try {
    const count = await syncSheet(sheet);
    result = { ok: `${sheet.title}: ${count} new leads` };
  } catch (e) {
    result = { error: msg(e) };
  }
  refresh();
  back(result);
}

export async function removeSheet(form: FormData) {
  await admin().from("sheets").delete().eq("id", String(form.get("id"))); // leads cascade
  refresh();
  back({ ok: "Sheet removed" });
}
