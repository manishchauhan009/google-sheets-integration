import { createClient } from "@supabase/supabase-js";
import type { Mapping } from "./parse";

export type Project = { id: string; name: string; created_at: string };
export type Sheet = {
  id: string; project_id: string | null; spreadsheet_id: string; tab_name: string; title: string | null;
  header: string[] | null; mapping: Mapping | null; ingest_token: string; last_synced_at: string | null; last_error: string | null; created_at: string;
};
export type Lead = {
  id: string; sheet_id: string; project_id: string | null; row_key: string;
  name: string | null; phone: string | null; email: string | null; campaign: string | null; form: string | null;
  lead_created_at: string | null; data: Record<string, string>; received_at: string;
};

// Server only: service role bypasses RLS. Never import from a client component.
export function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}
