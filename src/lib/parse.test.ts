import assert from "node:assert/strict";
import { guessMapping, parseRows } from "./parse.ts";

const values = [
  ["id", "created_time", "Campaign Name", "form_name", "full_name", "phone_number", "EMAIL", ""],
  ["l:111", "2026-10-17T10:00:00+05:30", "Launch 2BHK", "f:Form A", "Asha", "p:+919800000001", "A@X.COM", "extra"],
  ["", "", "", "", "", "", "", ""],
  ["", "not a date", "", "", "Ravi", "9800000002", "", ""],
];

// automatic (no mapping)
const { header, leads } = parseRows(values);
assert.equal(header[7], "col_8");
assert.equal(leads.length, 2, "blank row skipped");
const { data, ...first } = leads[0];
assert.deepEqual(first, {
  row_key: "111", name: "Asha", phone: "+919800000001", email: "a@x.com", campaign: "Launch 2BHK",
  form: "Form A", lead_created_at: "2026-10-17T04:30:00.000Z",
});
assert.equal(data.col_8, "extra");
assert.equal(leads[1].row_key, "row:4", "no id → sheet row number");
assert.equal(leads[1].lead_created_at, null);
assert.deepEqual(parseRows([]), { header: [], leads: [] });

// guess
assert.equal(guessMapping(header).phone, "phone_number");
assert.equal(guessMapping(["Mobile No"]).phone, "", "unknown header → not guessed");

// explicit mapping overrides the guess; "" switches a field off
const mapped = parseRows(
  [["Client", "Mobile No", "id"], ["Kiran", "98000", "l:9"]],
  { name: "Client", phone: "Mobile No", row_key: "" },
);
assert.equal(mapped.leads[0].name, "Kiran");
assert.equal(mapped.leads[0].phone, "98000");
assert.equal(mapped.leads[0].row_key, "row:2", "row_key unmapped → row number");
// pushed slice: row-number keys match a whole-tab read
assert.equal(parseRows([["name"], ["Zed"]], {}, 40).leads[0].row_key, "row:40");
console.log("parse ok");
