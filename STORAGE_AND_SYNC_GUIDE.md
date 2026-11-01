# Captain's Logger — Storage, Backup & Cloud Sync Guide

This guide explains how your boat maintenance, fuel logs, and parts catalog data are saved across your devices, how to back them up, and how to set up free cloud syncing between your PC and Android phone.

---

## 1. Running on PC & Installing the Android APK

### On Your PC (Local Development)
From your project folder, run:

```bash
npm run dev
```

Open http://localhost:5173/ in your PC browser.

### On Your Android Phone (Automated GitHub APK Build)
Every time you push changes to the `main` branch on GitHub, the GitHub Actions workflow ([`.github/workflows/build-android-apk.yml`](./.github/workflows/build-android-apk.yml)) automatically compiles a native Android installer (`CaptainsLogger.apk`) in the cloud and publishes it to your repository's **Releases** page:

1. Push your commits to GitHub:
   ```bash
   git add .
   git commit -m "Update Captains Logger"
   git push origin main
   ```
2. Wait ~2–3 minutes for the **Build Android APK** action to finish under your repository's **Actions** tab.
3. On your Android phone, open your repository's **Releases** page (`releases/tag/latest-apk`).
4. Tap **`CaptainsLogger.apk`** under **Assets** to download and install the app onto your phone.
   *(Note: If Android Play Protect shows a prompt because it's a self-signed build, tap **More details → Install anyway**.)*

---

## 2. How the 3-Layer Storage System Works

Every time you update engine hours, log a maintenance task, record a fuel fill-up, or change a spare part count, the app saves your data across **three layers**:

### Layer 1: Instant Offline Device Storage (`localStorage` + `IndexedDB`)
* **Where it lives:** Inside the browser / installed PWA on the device you are currently using.
* **Why it's there:** Works **100% offline** at sea or in the boatyard with zero cell signal.
* **Code:** [`src/db/storage.ts`](./src/db/storage.ts)

### Layer 2 (Option A): Automatic PC Hard Drive File (`data/captains-log.json`)
* **Where it lives:** `data/captains-log.json` inside your project folder on your computer's hard drive.
* **How it works:** Whenever the app is connected to your local Vite server on your PC (or from your phone over home Wi-Fi), every change is automatically written to `data/captains-log.json`.
* **Status Indicator:** Look for the blue **`Disk Saved`** badge in the top header bar.
* **Code:** [`vite-disk-plugin.js`](./vite-disk-plugin.js)

### Layer 3 (Option B): Supabase Cloud Sync (Phone ↔ PC Sync)
* **Where it lives:** Your private PostgreSQL database on [Supabase](https://supabase.com) (free tier).
* **How it works:**
  * When you are at the boat without internet, changes save to Layer 1 on your phone and show **`Pending (Offline)`**.
  * As soon as your phone reconnects to cell service or Wi-Fi, the app automatically pushes your updates to Supabase.
  * When you open the app on your PC, it automatically pulls the latest changes from Supabase (and writes them to `data/captains-log.json` as well).
* **Status Indicator:** Look for the green **`Synced`** badge in the top header bar.
* **Code:** [`src/db/supabaseSync.ts`](./src/db/supabaseSync.ts)

---

## 3. Step-by-Step: Setting Up Free Supabase Cloud Sync (Option B)

Setting up Supabase takes about 3 minutes and is completely free:

### Step 1: Create a Free Supabase Project
1. Go to https://supabase.com/dashboard and sign in (or create a free account).
2. Click **"New Project"**, give it a name (e.g., `CaptainsLogger`), set a database password, and wait ~60 seconds for the database to finish provisioning.

### Step 2: Create the Sync Table (Run SQL Once)
1. In the left sidebar of your Supabase dashboard, click **SQL Editor** → **"New query"**.
2. Paste the following SQL (also located in [`supabase/schema.sql`](./supabase/schema.sql)) and click **Run**:

```sql
create table if not exists public.captains_log_sync (
  boat_id text primary key,
  vessel_name text not null,
  updated_at timestamptz not null default now(),
  payload jsonb not null
);

alter table public.captains_log_sync enable row level security;

drop policy if exists "Allow anon read/write by boat_id" on public.captains_log_sync;

create policy "Allow anon read/write by boat_id"
  on public.captains_log_sync
  for all
  to anon, authenticated
  using (true)
  with check (true);
```

### Step 3: Copy Your Project URL & Anon Key into the App
1. In your Supabase dashboard sidebar, click **Project Settings** (the gear icon at the bottom) → **API**.
2. Copy two values:
   * **Project URL** (looks like `https://abcdefghijklm.supabase.co`)
   * **Project API Keys → `anon` `public` key** (a long string starting with `eyJ...`)
3. Open **Captain's Logger**, go to the **Boat & Backup** tab at the bottom, and scroll to **Option B • Supabase Cloud Sync**.
4. Paste your **Project URL** and **Anon Key**, verify your **Boat Sync ID** (e.g., `windward-spirit-main` — use the exact same Boat Sync ID on both your PC and your Android phone), check **Enable Auto-Sync**, and click **Save & Connect Cloud**.

---

## 4. Optional: Pre-configuring Supabase via `.env.local`

If you don't want to paste your Supabase URL and Key into the browser UI, you can create a file named `.env.local` in your project root folder:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key-here
VITE_BOAT_SYNC_ID=windward-spirit-main
```

Any device loaded from the server will automatically pick up these defaults.

---

## 5. Manual File Backups & Spreadsheet Exports (`.JSON` & `.CSV`)

In the **Boat & Backup** tab under **Portable File Export & Google Drive Share**:
* **Backup All Data (`.JSON`):** Exports a complete snapshot file. On Android, this opens the native Android Share menu so you can tap **Save to Google Drive** directly.
* **Restore Backup (`.JSON`):** Restores all schedules, service history, fuel logs, and parts from a `.json` backup file.
* **Export Spreadsheets (`.CSV`):** Downloads Excel / Google Sheets compatible `.csv` files for your **Fuel Log**, **Service Log**, or **Parts List**.

