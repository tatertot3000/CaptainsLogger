# Captain's Logger — Storage, Backup & Cloud Sync Guide

This guide explains how vessel maintenance records, spare parts inventory, fuel logs, passage journals, GPS tracks, and equipment manuals are saved across your devices, how to back them up, and how to set up free cloud syncing between your PC, tablet, and Android phone.

---

## 1. Running on PC & Installing the Android App

### On Your PC (Local Development)
From your project folder:

```bash
npm run dev
```

Open **`http://localhost:5173`** in your browser.

### On Your Android Phone or Tablet
GitHub Actions automatically builds and signs a native Android APK (`CaptainsLogger.apk`) on every push to `main`:

1. On your Android device, open your repository's [**Releases**](https://github.com/tatertot3000/CaptainsLogger/releases) page.
2. Under **Assets**, tap **`CaptainsLogger.apk`** to download and install.
   *(If prompted, allow installation from unknown sources).*
3. To record GPS tracks continuously when your phone is locked or in your pocket:  
   Go to **Android Settings > Apps > Captain's Logger > Permissions > Location** and select **"Allow all the time"**.

---

## 2. The 3-Layer Storage Architecture

Every time you update engine hours, log maintenance, deduct spare parts, record fuel, or finish an AutoLeg passage, the data is handled across three layers:

### Layer 1: Offline Device Storage (`IndexedDB` + `localStorage`)
* **Location:** Inside your local device storage.
* **Function:** Operates **100% offline** at sea or in boatyards without cellular coverage. All records, GPS breadcrumbs, and PDF manuals are stored locally.
* **Code Reference:** [`src/db/storage.ts`](./src/db/storage.ts)

### Layer 2 (Option A): Automatic PC Disk Backup (`data/captains-log.json`)
* **Location:** `data/captains-log.json` on your computer's hard drive.
* **Function:** When running the local Vite server on your PC, any changes made in the app are automatically saved to `data/captains-log.json`.
* **Indicator:** Displays a blue **`Disk Saved`** badge in the header.
* **Code Reference:** [`vite-disk-plugin.js`](./vite-disk-plugin.js)

### Layer 3 (Option B): Supabase Cloud Sync (Multi-Device Sync)
* **Location:** Your own private PostgreSQL database hosted on [Supabase](https://supabase.com) (free tier).
* **Function:**
  * While offshore without internet, changes save locally to Layer 1 and show **`Pending (Offline)`**.
  * Once the device reconnects to Wi-Fi or cellular service, updates automatically push to your Supabase database.
  * Opening the app on your computer or second device automatically pulls the latest records.
* **Indicator:** Displays a green **`Synced`** badge in the header.
* **Code Reference:** [`src/db/supabaseSync.ts`](./src/db/supabaseSync.ts)

---

## 3. Setting Up Free Supabase Cloud Sync (Option B)

Setup takes approximately 3 minutes and uses Supabase's free tier.

### Step 1: Create a Supabase Project
1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard) and sign in (or register).
2. Click **"New Project"**, name it (e.g. `CaptainsLogger`), set a database password, and wait for provisioning to finish (~1 minute).

### Step 2: Create the Sync Table
1. In the Supabase sidebar, open **SQL Editor** → **"New query"**.
2. Paste the SQL below (also in [`supabase/schema.sql`](./supabase/schema.sql)) and click **Run**:

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

### Step 3: Enter Your Project Credentials into the App
1. In your Supabase dashboard, click **Project Settings** (gear icon) → **API**.
2. Copy two values:
   * **Project URL** (e.g. `https://your-project-id.supabase.co`)
   * **Project API Keys → `anon` `public` key** (a long string starting with `eyJ...`)
3. In **Captain's Logger**, open the **Boat & Backup** tab, scroll to **Option B • Supabase Cloud Sync**.
4. Enter your **Project URL**, **Anon Key**, and a **Boat Sync ID** (e.g. `windward-spirit-main`).  
   *(Use the exact same Boat Sync ID on all your devices to sync to the same vessel).*
5. Check **Enable Auto-Sync** and click **Save & Connect Cloud**.

---

## 4. Optional: Pre-configuring Credentials via `.env.local`

You can pre-configure credentials by creating a `.env.local` file in your repository root:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key-here
VITE_BOAT_SYNC_ID=windward-spirit-main
```

Any client connecting to your local server will inherit these settings automatically.

---

## 5. Manual File Backups & Spreadsheet Exports

Under the **Boat & Backup** tab:
* **Backup All Data (`.JSON`):** Exports a full database snapshot. On Android, this opens the native share menu so you can save directly to Google Drive, send via email, or save to files.
* **Restore Backup (`.JSON`):** Imports and restores all maintenance schedules, service logs, parts inventory, fuel logs, and passage tracks from a `.json` backup file.
* **Export Spreadsheets (`.CSV`):** Exports individual spreadsheet files for your **Fuel Log**, **Service Log**, or **Parts Catalog** for viewing in Excel or Google Sheets.
