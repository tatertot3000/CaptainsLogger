import { CaptainsDatabase, MaintenancePhoto } from '../types';
import { IS_DEMO_MODE } from '../utils/demoMode';
import {
  buildPdfMediaKey,
  buildPhotoMediaKey,
  getMediaBlob,
  hasMediaLocally,
  saveMediaBlob,
} from './mediaStorage';

const SUPABASE_CONFIG_KEY = 'captains_logger_supabase_config_v1';
const MEDIA_BUCKET = 'captains-media';

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
  with check (true);

insert into storage.buckets (id, name, public)
values ('captains-media', 'captains-media', false)
on conflict (id) do nothing;

drop policy if exists "Allow anon read/write captains-media" on storage.objects;

create policy "Allow anon read/write captains-media"
  on storage.objects
  for all
  to anon, authenticated
  using (bucket_id = 'captains-media')
  with check (bucket_id = 'captains-media');`;

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

function encodeStoragePath(objectPath: string): string {
  return objectPath
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

async function uploadBlobToSupabaseStorage(
  objectPath: string,
  blob: Blob,
  config: SupabaseSyncConfig
): Promise<{ ok: boolean; error?: string }> {
  const url = formatSupabaseUrl(config.supabaseUrl);
  const endpoint = `${url}/storage/v1/object/${MEDIA_BUCKET}/${encodeStoragePath(objectPath)}`;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`,
        'Content-Type': blob.type || 'application/octet-stream',
        'x-upsert': 'true',
      },
      body: blob,
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Storage HTTP ${res.status}: ${text.slice(0, 120)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message || 'Network unreachable' };
  }
}

async function downloadBlobFromSupabaseStorage(
  objectPath: string,
  config: SupabaseSyncConfig
): Promise<Blob | null> {
  const url = formatSupabaseUrl(config.supabaseUrl);
  const encoded = encodeStoragePath(objectPath);
  const headers = {
    apikey: config.supabaseAnonKey,
    Authorization: `Bearer ${config.supabaseAnonKey}`,
  };

  for (const endpoint of [
    `${url}/storage/v1/object/authenticated/${MEDIA_BUCKET}/${encoded}`,
    `${url}/storage/v1/object/${MEDIA_BUCKET}/${encoded}`,
  ]) {
    try {
      const res = await fetch(endpoint, { method: 'GET', headers });
      if (res.ok) {
        return await res.blob();
      }
    } catch {
      // Try next endpoint / ignore transient failure
    }
  }
  return null;
}

export interface MediaSyncResult {
  updatedDb: CaptainsDatabase;
  metadataUpdated: boolean;
  uploadedCount: number;
  downloadedCount: number;
  warning?: string;
}

/**
 * Synchronizes binary photos and PDFs (invoices & manuals) with Supabase Storage bucket (`captains-media`).
 * - Never downloads files that already exist locally (zero startup network reload).
 * - Only uploads binaries that don't yet have a `remotePath` matching the current vessel's sync ID.
 */
export async function syncMediaWithSupabaseStorage(
  db: CaptainsDatabase,
  config: SupabaseSyncConfig,
  direction: 'auto' | 'push' | 'pull' = 'auto'
): Promise<MediaSyncResult> {
  if (IS_DEMO_MODE || !config.enabled || !config.supabaseUrl || !config.supabaseAnonKey) {
    return { updatedDb: db, metadataUpdated: false, uploadedCount: 0, downloadedCount: 0 };
  }

  const boatId = (config.boatSyncId || 'windward-spirit-main').trim();
  const boatPrefix = `${boatId}/`;
  let uploadedCount = 0;
  let downloadedCount = 0;
  let metadataUpdated = false;
  let warning: string | undefined;

  const uploadOrDownload = async (
    mediaKey: string,
    remotePath: string | undefined,
    meta?: { fileName?: string; mimeType?: string }
  ): Promise<string | undefined> => {
    const existsLocally = await hasMediaLocally(mediaKey);
    const hasValidRemote = Boolean(remotePath && remotePath.startsWith(boatPrefix));

    // Upload local binary if missing remotePath (or on explicit push without matching boat prefix)
    if ((direction === 'auto' || direction === 'push') && existsLocally && !hasValidRemote) {
      const blob = await getMediaBlob(mediaKey);
      if (blob) {
        const targetPath = `${boatPrefix}${mediaKey}`;
        const up = await uploadBlobToSupabaseStorage(targetPath, blob, config);
        if (up.ok) {
          uploadedCount += 1;
          metadataUpdated = true;
          return targetPath;
        }
        warning = up.error;
      }
    }

    // Download only if missing on this device (fresh install / new phone / restored metadata)
    if ((direction === 'auto' || direction === 'pull') && !existsLocally) {
      const sourcePath = remotePath || (direction === 'pull' ? `${boatPrefix}${mediaKey}` : undefined);
      if (sourcePath) {
        const blob = await downloadBlobFromSupabaseStorage(sourcePath, config);
        if (blob && blob.size > 0) {
          await saveMediaBlob(mediaKey, blob, meta);
          downloadedCount += 1;
        }
      }
    }

    return remotePath;
  };

  const syncPhotos = async (
    photos?: MaintenancePhoto[]
  ): Promise<MaintenancePhoto[] | undefined> => {
    if (!photos || photos.length === 0) return photos;
    let changed = false;
    const next = await Promise.all(
      photos.map(async (p) => {
        if (!p.mediaKey && !p.remotePath) return p;
        const mediaKey = p.mediaKey || buildPhotoMediaKey(p.id, p.mimeType);
        const nextRemote = await uploadOrDownload(mediaKey, p.remotePath, {
          mimeType: p.mimeType || 'image/jpeg',
        });
        if (nextRemote !== p.remotePath || mediaKey !== p.mediaKey) {
          changed = true;
          return { ...p, mediaKey, remotePath: nextRemote };
        }
        return p;
      })
    );
    return changed ? next : photos;
  };

  const parts = await Promise.all(
    (db.parts || []).map(async (p) => ({
      ...p,
      photos: await syncPhotos(p.photos),
    }))
  );

  const schedules = await Promise.all(
    (db.schedules || []).map(async (s) => ({
      ...s,
      photos: await syncPhotos(s.photos),
    }))
  );

  const serviceLogs = await Promise.all(
    (db.serviceLogs || []).map(async (l) => {
      const nextPhotos = await syncPhotos(l.photos);
      const nextInvoices = l.invoices
        ? await Promise.all(
            l.invoices.map(async (inv) => {
              const mediaKey = inv.mediaKey || buildPdfMediaKey('invoice', inv.id);
              const nextRemote = await uploadOrDownload(mediaKey, inv.remotePath, {
                fileName: inv.fileName,
                mimeType: 'application/pdf',
              });
              if (nextRemote !== inv.remotePath || mediaKey !== inv.mediaKey) {
                return { ...inv, mediaKey, remotePath: nextRemote };
              }
              return inv;
            })
          )
        : undefined;
      return { ...l, photos: nextPhotos, invoices: nextInvoices };
    })
  );

  const sailTrips = await Promise.all(
    (db.sailTrips || []).map(async (t) => ({
      ...t,
      photos: await syncPhotos(t.photos),
      legs: await Promise.all(
        (t.legs || []).map(async (leg) => ({
          ...leg,
          photos: await syncPhotos(leg.photos),
        }))
      ),
    }))
  );

  const manuals = await Promise.all(
    (db.manuals || []).map(async (m) => {
      if (!m.hasLocalPdf && !m.mediaKey && !m.remotePath) return m;
      const mediaKey = m.mediaKey || buildPdfMediaKey('manual', m.id);
      const nextRemote = await uploadOrDownload(mediaKey, m.remotePath, {
        fileName: m.fileName,
        mimeType: 'application/pdf',
      });
      const localAfter = await hasMediaLocally(mediaKey);
      if (
        nextRemote !== m.remotePath ||
        mediaKey !== m.mediaKey ||
        localAfter !== Boolean(m.hasLocalPdf)
      ) {
        return {
          ...m,
          mediaKey,
          remotePath: nextRemote,
          hasLocalPdf: localAfter || m.hasLocalPdf,
        };
      }
      return m;
    })
  );

  if (!metadataUpdated && downloadedCount === 0) {
    return { updatedDb: db, metadataUpdated: false, uploadedCount, downloadedCount, warning };
  }

  return {
    updatedDb: {
      ...db,
      parts,
      schedules,
      serviceLogs,
      sailTrips,
      manuals,
    },
    metadataUpdated,
    uploadedCount,
    downloadedCount,
    warning,
  };
}

