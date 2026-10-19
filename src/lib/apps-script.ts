// The Google Apps Script a sheet owner pastes into Extensions → Apps Script. Filled in per sheet on /setup/script/[id].
export function appsScript(opts: {
  endpoint: string; sheetId: string; token: string; tab: string; spreadsheetId: string; vercelBypass?: string;
}) {
  return `// Sheet Leads push for tab "${opts.tab}". Run setup() once; it then sends new rows every 5 minutes.
const CONFIG = {
  ENDPOINT: ${JSON.stringify(opts.endpoint)},
  SHEET_ID: ${JSON.stringify(opts.sheetId)},
  TOKEN: ${JSON.stringify(opts.token)}, // secret: don't share this script
  TAB: ${JSON.stringify(opts.tab)},
  SPREADSHEET_ID: ${JSON.stringify(opts.spreadsheetId)}, // only runs inside this exact spreadsheet
  VERCEL_BYPASS: ${JSON.stringify(opts.vercelBypass ?? "")}, // lets the push through Vercel Deployment Protection
};
const BATCH = 500;

function setup() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === "pushNewLeads")
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("pushNewLeads").timeBased().everyMinutes(5).create();
  pushNewLeads(); // first run sends existing rows (duplicates are ignored by the server)
}

function pushNewLeads() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return; // previous run still busy
  try {
    const book = SpreadsheetApp.getActive();
    if (book.getId() !== CONFIG.SPREADSHEET_ID) {
      throw new Error("This script belongs to another spreadsheet. Copy this sheet's own script from Setup → Auto-push.");
    }
    const sheet = book.getSheetByName(CONFIG.TAB);
    if (!sheet) throw new Error('Tab "' + CONFIG.TAB + '" not found');
    const props = PropertiesService.getScriptProperties();
    const lastRow = sheet.getLastRow();
    let sent = Number(props.getProperty("LAST_ROW") || 1); // row 1 = header
    if (sent > lastRow) sent = 1; // rows were deleted: resend all, server skips duplicates
    if (lastRow <= sent) return;

    const width = sheet.getLastColumn();
    const header = sheet.getRange(1, 1, 1, width).getDisplayValues()[0];
    while (sent < lastRow) {
      const count = Math.min(BATCH, lastRow - sent);
      const rows = sheet.getRange(sent + 1, 1, count, width).getDisplayValues();
      const res = UrlFetchApp.fetch(CONFIG.ENDPOINT, {
        method: "post",
        contentType: "application/json",
        headers: Object.assign(
          { Authorization: "Bearer " + CONFIG.TOKEN },
          CONFIG.VERCEL_BYPASS ? { "x-vercel-protection-bypass": CONFIG.VERCEL_BYPASS } : {}
        ),
        payload: JSON.stringify({ sheetId: CONFIG.SHEET_ID, header: header, rows: rows, firstRow: sent + 1 }),
        muteHttpExceptions: true,
      });
      // Not saved on failure: the same rows are retried on the next run. Google emails the owner about errors.
      if (res.getResponseCode() !== 200) throw new Error("Push failed " + res.getResponseCode() + ": " + res.getContentText());
      sent += count;
      props.setProperty("LAST_ROW", String(sent));
    }
  } finally {
    lock.releaseLock();
  }
}
`;
}
