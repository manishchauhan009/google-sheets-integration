import { createSign } from "node:crypto";

// Service-account auth with a self-signed JWT (no google-auth-library needed).
const SCOPES = "https://www.googleapis.com/auth/spreadsheets.readonly";
let cached: { token: string; exp: number } | null = null;

async function accessToken() {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const email = process.env.GOOGLE_SA_EMAIL;
  const key = process.env.GOOGLE_SA_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) throw new Error("GOOGLE_SA_EMAIL / GOOGLE_SA_PRIVATE_KEY not set");

  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: email, scope: SCOPES, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  })}`;
  const assertion = `${unsigned}.${createSign("RSA-SHA256").update(unsigned).sign(key, "base64url")}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Google auth failed: ${json.error_description || json.error}`);
  cached = { token: json.access_token, exp: Date.now() + json.expires_in * 1000 };
  return cached.token;
}

async function g<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store", headers: { Authorization: `Bearer ${await accessToken()}` } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json.error?.message || res.statusText;
    if (res.status === 403 || res.status === 404) {
      throw new Error(`${msg} (is the sheet shared with ${process.env.GOOGLE_SA_EMAIL}?)`);
    }
    throw new Error(msg);
  }
  return json as T;
}

// Accepts a full Sheets URL or a bare spreadsheet id.
export function spreadsheetIdFrom(input: string) {
  const m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : input.trim();
}

export async function getSpreadsheet(id: string) {
  const s = await g<{ properties: { title: string }; sheets: { properties: { title: string } }[] }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=properties.title,sheets.properties.title`,
  );
  return { title: s.properties.title, tabs: s.sheets.map((t) => t.properties.title) };
}

export async function readValues(id: string, tab: string) {
  const range = encodeURIComponent(`'${tab.replace(/'/g, "''")}'!A:ZZ`);
  const r = await g<{ values?: string[][] }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${range}?valueRenderOption=FORMATTED_VALUE`,
  );
  return r.values ?? [];
}
