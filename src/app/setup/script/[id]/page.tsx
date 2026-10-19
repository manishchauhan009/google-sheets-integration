import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { admin, type Sheet } from "@/lib/supabase";
import { appsScript } from "@/lib/apps-script";
import CopyButton from "./CopyButton";

export const dynamic = "force-dynamic";

export default async function ScriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = await admin().from("sheets").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const sheet = data as Sheet;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const endpoint = `${proto}://${host}/api/ingest`;
  const isLocal = /^(localhost|127\.|\[::1\])/.test(host);
  const code = appsScript({ endpoint, sheetId: sheet.id, token: sheet.ingest_token, tab: sheet.tab_name });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/setup" className="text-sm text-slate-500 hover:text-slate-900">← Setup</Link>
        <h1 className="mt-1 text-xl font-semibold">Auto-push: {sheet.title} / {sheet.tab_name}</h1>
        <p className="text-sm text-slate-600">
          A small script inside the Google Sheet sends new leads here every 5 minutes, even when nobody has this app open.
        </p>
      </div>

      {isLocal && (
        <p className="rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800">
          You&apos;re on {host}. Google can&apos;t reach localhost: open this page on your deployed (Vercel) URL and copy the script from there.
        </p>
      )}
      {!sheet.mapping && (
        <p className="rounded-md bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Fields aren&apos;t mapped yet. Pushes are refused (and retried) until you <Link href={`/setup/map/${sheet.id}`} className="underline">map fields</Link>.
        </p>
      )}

      <ol className="list-decimal space-y-1 rounded-lg border border-slate-200 bg-white p-4 pl-8 text-sm text-slate-700">
        <li>Open the sheet → <b>Extensions → Apps Script</b>.</li>
        <li>Delete what&apos;s in <code>Code.gs</code> and paste the script below. Save (Ctrl+S).</li>
        <li>Pick <b>setup</b> in the function dropdown at the top → <b>Run</b> → allow the permissions Google asks for.</li>
        <li>Done. It sends existing rows now and new rows every 5 minutes. Check <b>Executions</b> (left menu) for errors.</li>
      </ol>

      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <CopyButton text={code} />
          <span className="text-xs text-slate-500">Contains this sheet&apos;s secret token. Share it only with the sheet owner.</span>
        </div>
        <pre className="max-h-[28rem] overflow-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">{code}</pre>
      </div>
    </div>
  );
}
