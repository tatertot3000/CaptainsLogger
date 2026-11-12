import { CaptainsDatabase } from '../types';
import { IS_DEMO_MODE } from '../utils/demoMode';

const SUPABASE_CONFIG_KEY = 'captains_logger_supabase_config_v1';

export interface SupabaseSyncConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  boatSyncId: string;
  enabled: boolean;
}

export interface SyncStatusReport {
  diskStatus: 'saved' | 'unavailable' | 'syncing' | 'error';
  diskFilePath?: string;
  diskLastSaved?: string;
  cloudStatus: 'unconfigured' | 'synced' | 'syncing' | 'offline-pending' | 'error';
  cloudLastSynced?: string;
  cloudError?: string;
}

export const SUPABASE_SETUP_SQL = `create table if not exists public.captains_log_sync (
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
  with check (true);`;

export function vesselNameToBoatSyncId(name: string): string {
  const cleaned = (name || '')
    .trim()
    .toLowerCase()
    .replace(/^(s\/v|sv|m\/v|mv|s\/y|sy|m\/y|my)[.\s-]+/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'boat-sync';
}

export function formatSupabaseUrl(url: string): string {
  let cleaned = (url || '').trim().replace(/\/+$/, '');
  if (cleaned && !/^https?:\/\//i.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  }
  return cleaned;
}

export function loadSupabaseConfig(): SupabaseSyncConfig {
  if (IS_DEMO_MODE) {
    return {
      supabaseUrl: '',
      supabaseAnonKey: '',
      boatSyncId: 'windward-spirit-main',
      enabled: false,
    };
  }

  const envUrl = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SUPABASE_URL || '';
  const envKey = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SUPABASE_ANON_KEY || '';
  const envBoatId =
    (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_BOAT_SYNC_ID ||
    'windward-spirit-main';

  try {
    const raw = localStorage.getItem(SUPABASE_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SupabaseSyncConfig>;
      const url = formatSupabaseUrl(parsed.supabaseUrl ?? envUrl);
      const key = (parsed.supabaseAnonKey ?? envKey).trim();
      const boatSyncId = (parsed.boatSyncId || envBoatId).trim();
      return {
        supabaseUrl: url,
        supabaseAnonKey: key,
        boatSyncId,
        enabled: Boolean(parsed.enabled ?? (url && key)),
      };
    }
  } catch {
    // ignore parse error
  }

  const url = formatSupabaseUrl(envUrl);
  return {
    supabaseUrl: url,
    supabaseAnonKey: envKey.trim(),
    boatSyncId: envBoatId,
    enabled: Boolean(url && envKey.trim()),
  };
}

export function saveSupabaseConfig(config: SupabaseSyncConfig): void {
  if (IS_DEMO_MODE) return;

  const cleanUrl = formatSupabaseUrl(config.supabaseUrl);
  const cleaned: SupabaseSyncConfig = {
    supabaseUrl: cleanUrl,
    supabaseAnonKey: config.supabaseAnonKey.trim(),
    boatSyncId: config.boatSyncId.trim() || 'windward-spirit-main',
    enabled: config.enabled && Boolean(cleanUrl && config.supabaseAnonKey.trim()),
  };
  localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(cleaned));
}

export async function pushToLocalDiskFile(
  db: CaptainsDatabase
): Promise<{ ok: boolean; filePath?: string; savedAt?: string }> {
  if (IS_DEMO_MODE) return { ok: false };

  try {
    const res = await fetch('/api/local-db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(db),
    });
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as { ok?: boolean; filePath?: string; savedAt?: string };
    return {
      ok: Boolean(data.ok),
      filePath: data.filePath,
      savedAt: data.savedAt,
    };
  } catch {
    return { ok: false };
  }
}

export async function pullFromLocalDiskFile(): Promise<{
  exists: boolean;
  filePath?: string;
  data?: CaptainsDatabase;
}> {
  if (IS_DEMO_MODE) return { exists: false };

  try {
    const res = await fetch('/api/local-db', { method: 'GET' });
    if (!res.ok) return { exists: false };
    const json = (await res.json()) as {
      exists: boolean;
      filePath?: string;
      data?: CaptainsDatabase;
    };
    return json;
  } catch {
    return { exists: false };
  }
}

export async function pushToSupabaseCloud(
  db: CaptainsDatabase,
  config: SupabaseSyncConfig
): Promise<{ ok: boolean; error?: string; syncedAt?: string }> {
  if (IS_DEMO_MODE) {
    return { ok: false, error: 'Supabase sync is disabled in Demo Mode.' };
  }

  const url = formatSupabaseUrl(config.supabaseUrl);
  if (!config.enabled || !url || !config.supabaseAnonKey) {
    return { ok: false, error: 'Supabase sync is disabled or missing Project URL / Anon Key.' };
  }

  const syncedAt = new Date().toISOString();
  const endpoint = `${url}/rest/v1/captains_log_sync?on_conflict=boat_id`;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`,
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        boat_id: config.boatSyncId || 'windward-spirit-main',
        vessel_name: db.vessel.name,
        updated_at: db.exportedAt || syncedAt,
        payload: db,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      let hint = '';
      if (res.status === 404) {
        hint = ' → Table "captains_log_sync" missing in Supabase! Run the Table Setup SQL in the Supabase SQL Editor.';
      } else if (res.status === 401) {
        hint = ' → Invalid API Key. Ensure you copied the "anon" "public" key from Supabase Project Settings > API.';
      } else if (res.status === 403) {
        hint = ' → Row Level Security (RLS) blocked the write. Run the RLS policy in the Table Setup SQL.';
      }
      return {
        ok: false,
        error: `Supabase HTTP ${res.status}: ${text.slice(0, 100)}${hint}`,
      };
    }

    return { ok: true, syncedAt };
  } catch (err) {
    const msg = (err as Error)?.message || 'Network unreachable';
    return {
      ok: false,
      error: `Connection failed (${msg}). Check your Project URL (${url}) and internet connection.`,
    };
  }
}

export async function pullFromSupabaseCloud(
  config: SupabaseSyncConfig
): Promise<{ ok: boolean; data?: CaptainsDatabase; discoveredBoatId?: string; error?: string }> {
  if (IS_DEMO_MODE) {
    return { ok: false, error: 'Supabase sync is disabled in Demo Mode.' };
  }

  const url = formatSupabaseUrl(config.supabaseUrl);
  if (!config.enabled || !url || !config.supabaseAnonKey) {
    return { ok: false, error: 'Supabase sync is disabled or missing Project URL / Anon Key.' };
  }

  const endpoint = `${url}/rest/v1/captains_log_sync?boat_id=eq.${encodeURIComponent(
    config.boatSyncId || 'windward-spirit-main'
  )}&select=boat_id,updated_at,payload`;

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      let hint = '';
      if (res.status === 404) {
        hint = ' → Table "captains_log_sync" missing in Supabase! Run the Table Setup SQL in the Supabase SQL Editor.';
      } else if (res.status === 401) {
        hint = ' → Invalid API Key.';
      }
      return {
        ok: false,
        error: `Supabase HTTP ${res.status}: ${text.slice(0, 100)}${hint}`,
      };
    }

    const rows = (await res.json()) as Array<{
      boat_id: string;
      updated_at: string;
      payload: CaptainsDatabase;
    }>;

    const isRealBoatName = (name?: string) =>
      Boolean(name && name !== 'S/V Windward Spirit' && name !== 'Enter Name');

    if (rows && rows.length > 0 && isRealBoatName(rows[0].payload?.vessel?.name)) {
      return { ok: true, data: rows[0].payload, discoveredBoatId: rows[0].boat_id };
    }

    // Fallback: query all rows in captains_log_sync ordered by updated_at desc
    // so a fresh install automatically finds the user's real boat even if boatSyncId differed
    const fallbackRes = await fetch(
      `${url}/rest/v1/captains_log_sync?select=boat_id,updated_at,payload&order=updated_at.desc&limit=10`,
      {
        method: 'GET',
        headers: {
          apikey: config.supabaseAnonKey,
          Authorization: `Bearer ${config.supabaseAnonKey}`,
        },
      }
    );

    if (fallbackRes.ok) {
      const allRows = (await fallbackRes.json()) as Array<{
        boat_id: string;
        updated_at: string;
        payload: CaptainsDatabase;
      }>;
      if (allRows && allRows.length > 0) {
        const realBoatRow =
          allRows.find((r) => isRealBoatName(r.payload?.vessel?.name)) ||
          allRows[0];
        return {
          ok: true,
          data: realBoatRow.payload,
          discoveredBoatId: realBoatRow.boat_id,
        };
      }
    }

    if (!rows || rows.length === 0) {
      return { ok: true, data: undefined };
    }

    return { ok: true, data: rows[0].payload, discoveredBoatId: rows[0].boat_id };
  } catch (err) {
    const msg = (err as Error)?.message || 'Network unreachable';
    return {
      ok: false,
      error: `Connection failed (${msg}). Check your Project URL (${url}) and internet connection.`,
    };
  }
}

