# Daily Work Checklist (FLABS-SPT-02)

Support team fills daily numbers, the team lead completes the sheet, and a PDF of any day can be downloaded.
Static site (HTML/CSS/JS) + Supabase database. No server code, no build step.

Files: `index.html`, `style.css`, `app.js`, `config.js` (your keys), `supabase.sql` (tables).

## Step 1. Create the database (Supabase, free)
1. Sign up at https://supabase.com and click **New project**. Pick a name, set a database password (save it), choose the nearest region (Mumbai), click **Create**. Wait 1-2 minutes.
2. Left menu > **SQL Editor** > **New query**. Paste all of `supabase.sql` and click **Run**. You should see "Success".
3. Left menu > **Table Editor**: you should see `agents` (7 names), `entries`, `days`.
4. **Project Settings** (gear) > **API**. Copy:
   - **Project URL** (https://xxxx.supabase.co)
   - **anon public** key (starts with eyJ...). Do NOT use the service_role key.

## Step 2. Put the keys in the code
Open `config.js` and replace the two placeholder values:
```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://xxxx.supabase.co",
  SUPABASE_ANON_KEY: "eyJ..."
};
```

## Step 3. Test on your computer (optional)
```bash
npx serve .
```
Open the address it prints. The yellow "Database not connected" banner must be gone.
Choose a name, enter numbers, click Save. Then open Supabase > Table Editor > `entries`: the row should be there.

## Step 4. Push to GitHub
1. https://github.com/new : create a repository (private is fine), no README.
2. In this folder:
```bash
git init
git add .
git commit -m "Daily Work Checklist"
git branch -M main
git remote add origin https://github.com/<your-user>/<repo>.git
git push -u origin main
```

## Step 5. Deploy on Vercel (production)
1. https://vercel.com > sign in with GitHub > **Add New > Project**.
2. Import the repository.
3. Framework Preset: **Other**. Build Command: leave empty. Output Directory: leave empty. Install Command: leave empty.
4. Click **Deploy**. When done you get a link like https://your-project.vercel.app. That is the production site.
5. Share the link with the team. Every `git push` to `main` redeploys automatically.
6. Optional: Vercel > Project > Settings > Domains to add your own domain.

## Using it
- **My entry**: each person picks their name, fills numbers, clicks Save. New person: type a name under "Add a support person".
- **Daily sheet & PDF**: team lead fills aging, bugs, low-rating review, sign-off, then **Download PDF**.
- **History**: all past days; click a day to open it.

## Troubleshooting
- Yellow banner "Database not connected": `config.js` still has placeholders, or you did not redeploy after changing it.
- Names list is empty: `supabase.sql` was not run (or its `insert into agents` part failed). Run it again, it is safe to repeat.
- Save fails / "Could not save": open browser console (F12). A message like "permission denied" or "relation does not exist" means the SQL (tables or policies) was not run completely.
- Numbers not showing for a colleague: the page refreshes every 20 seconds, or reload.

## Security note
Anyone with the link can read and write (anon key is public and the policies allow it). Fine for a small internal link.
To lock it down: enable Supabase Auth, then in `supabase.sql` change `to anon` to `to authenticated`.
