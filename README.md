# Sheet Leads (prototype)

Meta lead ads → Google Sheets → this dashboard. No cron, no webhook, no Zapier/Make/Pabbly.

**How:** each time the dashboard is opened or **Refresh** is clicked, the server reads every added sheet with the
Sheets API and inserts rows it hasn't seen. Dedup is on the Meta lead `id` column, falling back to row number.

> No auth. Anyone with the URL can see leads. Keep it private; prototype only.

## Setup

1. **Supabase:** run `supabase/schema.sql` in the SQL editor of the new project (already set up before projects existed? run `supabase/002_projects.sql` instead).
2. **Google Cloud:** create a project and enable **Google Sheets API**. Create a **service account**, add a JSON key,
   and copy `client_email` and `private_key`.
3. **Env:** copy `.env.example` to `.env.local` **in this folder** and fill it in.
4. `npm install` then `npm run dev`, and open http://localhost:3001.
5. **Meta:** connect each lead form to a Google Sheet. Share that sheet as **Viewer** with the service-account email
   (shown on `/setup`).
6. On `/setup`, add projects (your properties), then paste the sheet URL and pick its project. Existing rows import
   right away with that project; any lead can be moved to another project from the dashboard.

## Test

`npm test` runs the row-parser check (`src/lib/parse.test.ts`).
