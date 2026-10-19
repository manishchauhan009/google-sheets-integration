import { admin, type Project, type Lead, type Sheet } from "@/lib/supabase";
import { syncAll } from "@/lib/sync";
import Dashboard from "./Dashboard";

export const dynamic = "force-dynamic";

export default async function Page() {
  // Pull new rows from every sheet on each open / Refresh (no cron, no webhook).
  await syncAll();
  const db = admin();
  const [projects, sheets, leads] = await Promise.all([
    db.from("projects").select("*").order("name"),
    db.from("sheets").select("*").order("created_at"),
    db.from("leads").select("*").order("received_at", { ascending: false }).limit(1000),
  ]);

  return (
    <Dashboard
      projects={(projects.data ?? []) as Project[]}
      sheets={(sheets.data ?? []) as Sheet[]}
      leads={(leads.data ?? []) as Lead[]}
      syncedAt={new Date().toISOString()}
    />
  );
}
