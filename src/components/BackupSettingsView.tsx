import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Anchor,
  Camera,
  CheckCircle2,
  Cloud,
  Compass,
  Copy,
  Download,
  Eye,
  FileSpreadsheet,
  HardDrive,
  Image as ImageIcon,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Sliders,
  Smartphone,
  Tag,
  Trash2,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import { CaptainsDatabase, FuelType } from '../types';
import {
  exportFileOrShare,
  generateFuelCsv,
  generatePartsCatalogCsv,
  generateServiceHistoryCsv,
  getInitialEmptyDatabase,
  getInitialSampleDatabase,
} from '../db/storage';
import {
  SUPABASE_SETUP_SQL,
  SupabaseSyncConfig,
  SyncStatusReport,
  formatSupabaseUrl,
  vesselNameToBoatSyncId,
} from '../db/supabaseSync';
import { compressImageFile } from '../utils/vendors';
import { ALL_INSIGNIAS } from '../utils/insignias';
import { IS_DEMO_MODE } from '../utils/demoMode';
import { GPS_POLLING_PROFILES } from '../utils/geo';

interface BackupSettingsViewProps {
  db: CaptainsDatabase;
  onUpdateDb: (updater: (prev: CaptainsDatabase) => CaptainsDatabase) => void;
  supabaseConfig: SupabaseSyncConfig;
  onSaveSupabaseConfig: (config: SupabaseSyncConfig) => void;
  syncReport: SyncStatusReport;
  onTriggerManualSync: (direction?: 'auto' | 'push' | 'pull') => Promise<void>;
}

const STANDARD_CATEGORIES: string[] = [
  'Engine',
  'Cooling',
  'Fuel',
  'Lubrication',
  'Electrical',
  'Transmission',
  'Plumbing & Water',
  'Rigging / Deck',
  'Safety',
];

export const BackupSettingsView: React.FC<BackupSettingsViewProps> = ({
  db,
  onUpdateDb,
  supabaseConfig,
  onSaveSupabaseConfig,
  syncReport,
  onTriggerManualSync,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showSqlModal, setShowSqlModal] = useState(false);

  // Supabase form state
  const [sbUrl, setSbUrl] = useState(supabaseConfig.supabaseUrl);
  const [sbKey, setSbKey] = useState(supabaseConfig.supabaseAnonKey);
  const [sbBoatId, setSbBoatId] = useState(supabaseConfig.boatSyncId);
  const [sbEnabled, setSbEnabled] = useState(supabaseConfig.enabled);

  useEffect(() => {
    setSbBoatId(supabaseConfig.boatSyncId);
  }, [supabaseConfig.boatSyncId]);

  // Vessel profile form
  const [name, setName] = useState(db.vessel.name);
  const [boatMakeModel, setBoatMakeModel] = useState(db.vessel.boatMakeModel);
  const [year, setYear] = useState(String(db.vessel.year));
  const [engineMakeModel, setEngineMakeModel] = useState(db.vessel.engineMakeModel);
  const [engineSerial, setEngineSerial] = useState(db.vessel.engineSerial);
  const [fuelType, setFuelType] = useState<FuelType>(db.vessel.fuelType || 'diesel');
  const [fuelCapacity, setFuelCapacity] = useState(String(db.vessel.fuelCapacityGallons));
  const [defaultGph, setDefaultGph] = useState(String(db.vessel.defaultBurnRateGph));

  // Vessel Insignia & Builder Logo State
  const [vesselInsignia, setVesselInsignia] = useState(db.vessel.insignia || 'compass');
  const [isUploadingInsignia, setIsUploadingInsignia] = useState(false);

  useEffect(() => {
    setVesselInsignia(db.vessel.insignia || 'compass');
  }, [db.vessel.insignia]);

  useEffect(() => {
    setName(db.vessel.name);
    setBoatMakeModel(db.vessel.boatMakeModel);
    setYear(String(db.vessel.year));
    setEngineMakeModel(db.vessel.engineMakeModel);
    setEngineSerial(db.vessel.engineSerial);
    setFuelType(db.vessel.fuelType || 'diesel');
    setFuelCapacity(String(db.vessel.fuelCapacityGallons));
    setDefaultGph(String(db.vessel.defaultBurnRateGph));
  }, [db.vessel]);

  const handleSelectInsignia = (insigniaId: string) => {
    setVesselInsignia(insigniaId);
    onUpdateDb((prev) => ({
      ...prev,
      vessel: {
        ...prev.vessel,
        insignia: insigniaId,
      },
    }));
    showToast('Vessel insignia updated!');
  };

  const handleInsigniaFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) return;
    setIsUploadingInsignia(true);
    try {
      const compressed = await compressImageFile(file, 512, 0.85);
      handleSelectInsignia(compressed);
    } catch (err) {
      console.error('Failed to compress custom insignia:', err);
      showToast('Could not process insignia image file.');
    } finally {
      setIsUploadingInsignia(false);
    }
  };

  // Optional Vessel Wallpaper State & Handlers
  const [wallpaperEnabled, setWallpaperEnabled] = useState(Boolean(db.vessel.wallpaperEnabled));
  const [wallpaperUrl, setWallpaperUrl] = useState(db.vessel.wallpaperUrl || '');
  const [wallpaperOpacity, setWallpaperOpacity] = useState(db.vessel.wallpaperOpacity ?? 0.2);
  const [isUploadingWallpaper, setIsUploadingWallpaper] = useState(false);

  useEffect(() => {
    setWallpaperEnabled(Boolean(db.vessel.wallpaperEnabled));
    setWallpaperUrl(db.vessel.wallpaperUrl || '');
    setWallpaperOpacity(db.vessel.wallpaperOpacity ?? 0.2);
  }, [db.vessel.wallpaperEnabled, db.vessel.wallpaperUrl, db.vessel.wallpaperOpacity]);

  const updateWallpaperSettings = (enabled: boolean, url: string, opacity: number) => {
    setWallpaperEnabled(enabled);
    setWallpaperUrl(url);
    setWallpaperOpacity(opacity);
    onUpdateDb((prev) => ({
      ...prev,
      vessel: {
        ...prev.vessel,
        wallpaperEnabled: enabled,
        wallpaperUrl: url,
        wallpaperOpacity: opacity,
      },
    }));
  };

  const handleWallpaperFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) return;
    setIsUploadingWallpaper(true);
    try {
      const compressedDataUrl = await compressImageFile(file, 1400, 0.75);
      updateWallpaperSettings(true, compressedDataUrl, wallpaperOpacity);
      showToast('Custom boat wallpaper applied!');
    } catch (err) {
      console.error('Failed to compress wallpaper:', err);
      showToast('Could not process image file.');
    } finally {
      setIsUploadingWallpaper(false);
    }
  };

  const handleClearWallpaper = () => {
    updateWallpaperSettings(false, '', 0.2);
    showToast('Wallpaper cleared. Reset to default slate theme.');
  };

  const showToast = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 4500);
  };

  // Custom Category Management State
  const [editingCategoryOldName, setEditingCategoryOldName] = useState<string | null>(null);
  const [editingCategoryNewName, setEditingCategoryNewName] = useState('');
  const [newCustomCategoryInput, setNewCustomCategoryInput] = useState('');
  const [reassignModalOldCat, setReassignModalOldCat] = useState<string | null>(null);
  const [reassignTargetCat, setReassignTargetCat] = useState('Engine');

  const customCategoriesList = useMemo(() => {
    const set = new Set<string>(db.customCategories || []);
    for (const p of db.parts) {
      if (p.category && !STANDARD_CATEGORIES.includes(p.category)) {
        set.add(p.category);
      }
    }
    for (const s of db.schedules) {
      if (s.category && !STANDARD_CATEGORIES.includes(s.category)) {
        set.add(s.category);
      }
    }
    for (const l of db.serviceLogs) {
      if (l.category && !STANDARD_CATEGORIES.includes(l.category)) {
        set.add(l.category);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [db.customCategories, db.parts, db.schedules, db.serviceLogs]);

  const allAvailableCategories = useMemo(() => {
    return [...STANDARD_CATEGORIES, ...customCategoriesList];
  }, [customCategoriesList]);

  const handleAddCategory = () => {
    const trimmed = newCustomCategoryInput.trim();
    if (!trimmed) return;
    if (STANDARD_CATEGORIES.includes(trimmed) || customCategoriesList.includes(trimmed)) {
      showToast(`Category "${trimmed}" already exists.`);
      return;
    }
    onUpdateDb((prev) => ({
      ...prev,
      customCategories: [...(prev.customCategories || []), trimmed],
    }));
    setNewCustomCategoryInput('');
    showToast(`Added custom category "${trimmed}".`);
  };

  const handleSaveRenameCategory = (oldName: string) => {
    const trimmed = editingCategoryNewName.trim();
    if (!trimmed || trimmed === oldName) {
      setEditingCategoryOldName(null);
      return;
    }

    onUpdateDb((prev) => {
      const updatedCustom = (prev.customCategories || [])
        .map((c) => (c === oldName ? trimmed : c))
        .filter((v, i, a) => a.indexOf(v) === i);

      const updatedParts = prev.parts.map((p) =>
        p.category === oldName ? { ...p, category: trimmed } : p
      );
      const updatedSchedules = prev.schedules.map((s) =>
        s.category === oldName ? { ...s, category: trimmed } : s
      );
      const updatedLogs = prev.serviceLogs.map((l) =>
        l.category === oldName ? { ...l, category: trimmed } : l
      );

      return {
        ...prev,
        customCategories: updatedCustom,
        parts: updatedParts,
        schedules: updatedSchedules,
        serviceLogs: updatedLogs,
      };
    });

    showToast(`Renamed "${oldName}" to "${trimmed}" across all items.`);
    setEditingCategoryOldName(null);
    setEditingCategoryNewName('');
  };

  const handleDeleteCategory = (catName: string) => {
    const partsCount = db.parts.filter((p) => p.category === catName).length;
    const tasksCount = db.schedules.filter((s) => s.category === catName).length;
    const logsCount = db.serviceLogs.filter((l) => l.category === catName).length;
    const totalItems = partsCount + tasksCount + logsCount;

    if (totalItems > 0) {
      setReassignModalOldCat(catName);
      setReassignTargetCat(STANDARD_CATEGORIES[0]);
      return;
    }

    onUpdateDb((prev) => ({
      ...prev,
      customCategories: (prev.customCategories || []).filter((c) => c !== catName),
    }));
    showToast(`Deleted unused category "${catName}".`);
  };

  const handleConfirmReassignAndDelete = () => {
    if (!reassignModalOldCat || !reassignTargetCat) return;
    const oldName = reassignModalOldCat;
    const target = reassignTargetCat;

    onUpdateDb((prev) => {
      const updatedParts = prev.parts.map((p) =>
        p.category === oldName ? { ...p, category: target } : p
      );
      const updatedSchedules = prev.schedules.map((s) =>
        s.category === oldName ? { ...s, category: target } : s
      );
      const updatedLogs = prev.serviceLogs.map((l) =>
        l.category === oldName ? { ...l, category: target } : l
      );
      const updatedCustom = (prev.customCategories || []).filter((c) => c !== oldName);

      return {
        ...prev,
        customCategories: updatedCustom,
        parts: updatedParts,
        schedules: updatedSchedules,
        serviceLogs: updatedLogs,
      };
    });

    showToast(`Reassigned items from "${oldName}" to "${target}" and removed category.`);
    setReassignModalOldCat(null);
  };

  const handleSaveSupabase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (IS_DEMO_MODE) return;
    const cleanUrl = formatSupabaseUrl(sbUrl);
    setSbUrl(cleanUrl);
    const updated: SupabaseSyncConfig = {
      supabaseUrl: cleanUrl,
      supabaseAnonKey: sbKey.trim(),
      boatSyncId: sbBoatId.trim() || 'windward-spirit-main',
      enabled: sbEnabled && Boolean(cleanUrl && sbKey.trim()),
    };
    onSaveSupabaseConfig(updated);
    showToast('Supabase settings saved. Syncing with cloud...');
  };

  const handleManualSyncWithLatestInputs = async (direction: 'push' | 'pull') => {
    if (IS_DEMO_MODE) return;
    const cleanUrl = formatSupabaseUrl(sbUrl);
    setSbUrl(cleanUrl);
    const updated: SupabaseSyncConfig = {
      supabaseUrl: cleanUrl,
      supabaseAnonKey: sbKey.trim(),
      boatSyncId: sbBoatId.trim() || 'windward-spirit-main',
      enabled: Boolean(cleanUrl && sbKey.trim()),
    };
    setSbEnabled(true);
    onSaveSupabaseConfig(updated);
    showToast(`Saved settings. ${direction === 'push' ? 'Pushing to cloud' : 'Pulling from cloud'}...`);
    await onTriggerManualSync(direction);
  };

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_SETUP_SQL);
      showToast('Copied Supabase table setup SQL to clipboard!');
    } catch {
      setShowSqlModal(true);
    }
  };

  const handleSaveVessel = (e: React.FormEvent) => {
    e.preventDefault();
    if (IS_DEMO_MODE) {
      showToast('Saving vessel profile is disabled in Demo Mode.');
      return;
    }
    const finalName = name.trim() || db.vessel.name;
    const newSyncId = vesselNameToBoatSyncId(finalName);

    onUpdateDb((prev) => ({
      ...prev,
      vessel: {
        ...prev.vessel,
        name: finalName,
        boatMakeModel: boatMakeModel.trim(),
        year: parseInt(year, 10) || prev.vessel.year,
        engineMakeModel: engineMakeModel.trim(),
        engineSerial: engineSerial.trim(),
        fuelType: fuelType,
        fuelCapacityGallons: parseFloat(fuelCapacity) || prev.vessel.fuelCapacityGallons,
        defaultBurnRateGph: parseFloat(defaultGph) || prev.vessel.defaultBurnRateGph,
        insignia: vesselInsignia,
      },
    }));

    if (newSyncId && newSyncId !== supabaseConfig.boatSyncId) {
      setSbBoatId(newSyncId);
      onSaveSupabaseConfig({
        ...supabaseConfig,
        boatSyncId: newSyncId,
      });
    }

    showToast('Vessel profile saved & Boat Sync ID updated.');
  };

  const handleExportJson = async () => {
    if (IS_DEMO_MODE) return;
    const dateSlug = new Date().toISOString().slice(0, 10);
    const filename = `captains-logger-backup-${dateSlug}.json`;
    await exportFileOrShare(
      filename,
      JSON.stringify(db, null, 2),
      'application/json',
      "Captain's Logger Full Backup"
    );
    showToast(`Exported ${filename}`);
  };

  const handleCopyJson = async () => {
    if (IS_DEMO_MODE) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(db, null, 2));
      showToast('Database JSON copied to clipboard!');
    } catch {
      showToast('Could not copy to clipboard.');
    }
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (IS_DEMO_MODE) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as CaptainsDatabase;
        if (!parsed.vessel || !Array.isArray(parsed.schedules)) {
          throw new Error('Invalid backup file structure');
        }
        onUpdateDb(() => parsed);
        setName(parsed.vessel.name);
        const importedSyncId = vesselNameToBoatSyncId(parsed.vessel.name);
        setSbBoatId(importedSyncId);
        onSaveSupabaseConfig({
          ...supabaseConfig,
          boatSyncId: importedSyncId,
        });
        setBoatMakeModel(parsed.vessel.boatMakeModel);
        setYear(String(parsed.vessel.year));
        setEngineMakeModel(parsed.vessel.engineMakeModel);
        setEngineSerial(parsed.vessel.engineSerial);
        setFuelType(parsed.vessel.fuelType || 'diesel');
        setFuelCapacity(String(parsed.vessel.fuelCapacityGallons));
        setDefaultGph(String(parsed.vessel.defaultBurnRateGph));
        showToast('Backup restored and synced!');
      } catch (err) {
        alert('Could not restore backup file: ' + (err as Error).message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      {statusMessage && (
        <div className="bg-emerald-500/20 border border-emerald-500/50 text-emerald-200 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* In Normal Mode: Show Option A (Hard Drive Auto-Save) & Option B (Supabase Cloud Sync) */}
      {!IS_DEMO_MODE ? (
        <>
          {/* OPTION A: Local Disk File Auto-Save Status */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5" />
                  Option A • Local Hard Drive Auto-Save
                </span>
                <h3 className="text-base font-bold text-white mt-0.5">
                  Physical File on PC Disk
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Whenever connected to your PC server, every edit automatically writes to:
                </p>
                <code className="block mt-1.5 text-[11px] bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-sky-300 font-mono break-all">
                  {syncReport.diskFilePath || './data/captains-log.json'}
                </code>
              </div>

              <span
                className={`text-[11px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${
                  syncReport.diskStatus === 'saved'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : syncReport.diskStatus === 'syncing'
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {syncReport.diskStatus === 'saved'
                  ? 'DISK SAVED'
                  : syncReport.diskStatus === 'syncing'
                  ? 'WRITING...'
                  : 'OFFLINE / STANDALONE'}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/80">
              <span>
                Last saved:{' '}
                <strong className="text-slate-200">
                  {syncReport.diskLastSaved
                    ? new Date(syncReport.diskLastSaved).toLocaleTimeString()
                    : 'On startup'}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => onTriggerManualSync('auto')}
                className="text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Sync Disk & Cloud Now
              </button>
            </div>
          </div>

          {/* OPTION B: Supabase Cloud Sync */}
          <form
            onSubmit={handleSaveSupabase}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                  <Cloud className="w-3.5 h-3.5" />
                  Option B • Supabase Cloud Sync (Phone ↔ PC)
                </span>
                <h3 className="text-base font-bold text-white mt-0.5">
                  Automatic Offline-to-Cloud Database Sync
                </h3>
              </div>

              <span
                className={`text-[11px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${
                  syncReport.cloudStatus === 'synced'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : syncReport.cloudStatus === 'syncing'
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                    : syncReport.cloudStatus === 'offline-pending'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : syncReport.cloudStatus === 'error'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {syncReport.cloudStatus === 'synced'
                  ? 'CLOUD SYNCED'
                  : syncReport.cloudStatus === 'syncing'
                  ? 'SYNCING...'
                  : syncReport.cloudStatus === 'offline-pending'
                  ? 'PENDING (OFFLINE)'
                  : syncReport.cloudStatus === 'error'
                  ? 'SYNC ERROR'
                  : 'NOT CONFIGURED'}
              </span>
            </div>

            {/* 3-Step Quick Setup Box */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 space-y-2">
              <div className="font-semibold text-white">
                3-Minute Free Setup at{' '}
                <a
                  href="https://supabase.com/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 underline"
                >
                  supabase.com
                </a>
                :
              </div>
              <ol className="list-decimal list-inside space-y-1 text-slate-400">
                <li>Create a free project, open the <strong>SQL Editor</strong>, and run the setup SQL below.</li>
                <li>
                  Go to <strong>Project Settings → API</strong> and copy your <strong>Project URL</strong> &{' '}
                  <strong>anon public key</strong> below.
                </li>
                <li>Use the same <strong>Boat Sync ID</strong> on your PC and Android phone.</li>
              </ol>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 px-3 py-1.5 rounded-lg font-semibold transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy Table Setup SQL
                </button>
                <button
                  type="button"
                  onClick={() => setShowSqlModal((v) => !v)}
                  className="text-xs text-slate-400 hover:text-slate-200 underline px-2 py-1"
                >
                  {showSqlModal ? 'Hide SQL' : 'View SQL'}
                </button>
              </div>

              {showSqlModal && (
                <pre className="bg-slate-900 border border-slate-800 p-2.5 rounded-lg text-[11px] font-mono text-emerald-300 overflow-x-auto">
                  {SUPABASE_SETUP_SQL}
                </pre>
              )}
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Supabase Project URL
                </label>
                <input
                  type="url"
                  placeholder="https://your-project-id.supabase.co"
                  value={sbUrl}
                  onChange={(e) => setSbUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Supabase Anon / Public API Key
                </label>
                <input
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={sbKey}
                  onChange={(e) => setSbKey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Boat Sync ID (Shared Key)
                  </label>
                  <input
                    type="text"
                    placeholder="windward-spirit-main"
                    value={sbBoatId}
                    onChange={(e) => setSbBoatId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-200 bg-slate-950 p-2.5 rounded-lg border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sbEnabled}
                    onChange={(e) => setSbEnabled(e.target.checked)}
                    className="rounded text-sky-500"
                  />
                  <span>Enable Auto-Sync</span>
                </label>
              </div>
            </div>

            {syncReport.cloudLastSynced && !syncReport.cloudError && (
              <div className="text-[11px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 rounded-lg px-3 py-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Connected & synced to Supabase ({new Date(syncReport.cloudLastSynced).toLocaleTimeString()})</span>
              </div>
            )}

            {syncReport.cloudError && (
              <div className="text-xs text-rose-300 bg-rose-950/70 border border-rose-800/80 rounded-xl p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-rose-200">Cloud Sync Failed</div>
                    <div className="text-[11px] text-rose-300/90 mt-0.5 font-mono leading-relaxed">{syncReport.cloudError}</div>
                  </div>
                </div>
                {syncReport.cloudError.includes('captains_log_sync') && (
                  <div className="pt-2 border-t border-rose-900/60 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] text-slate-300">Run the setup SQL in the Supabase SQL Editor:</span>
                    <button
                      type="button"
                      onClick={handleCopySql}
                      className="bg-rose-900/90 hover:bg-rose-800 text-rose-100 text-[11px] px-2.5 py-1 rounded font-semibold transition"
                    >
                      Copy Setup SQL
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleManualSyncWithLatestInputs('push')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 transition"
                  title="Save current credentials and push local database to cloud"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Push to Cloud</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleManualSyncWithLatestInputs('pull')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                  title="Save current credentials and pull latest database from cloud"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Pull from Cloud</span>
                </button>
              </div>

              <button
                type="submit"
                className="flex items-center gap-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs px-4 py-2 rounded-lg transition shadow"
              >
                <Save className="w-3.5 h-3.5" />
                Save & Connect Cloud
              </button>
            </div>
          </form>
        </>
      ) : (
        <div className="bg-slate-900 border border-sky-500/30 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cloud className="w-5 h-5 text-sky-400" />
              <h3 className="text-base font-bold text-white">Public Showcase Preview</h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40">
              READ-ONLY DEMO
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Welcome to the live showcase of <strong>Captain's Logger</strong>! Hard drive auto-saving, Supabase cloud sync, backup restoring, and persistent storage are disabled in this public preview. Any explorations or simulated edits during this session will reset upon reload.
          </p>
        </div>
      )}

      {/* Manual File Snapshots & Spreadsheets Section (Hidden in Public Demo Mode) */}
      {!IS_DEMO_MODE && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div>
            <h3 className="text-base font-bold text-white">
              Portable File Export & Google Drive Share
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Download or share a standalone `.json` backup or `.csv` spreadsheets to Google Drive, email, or Excel anytime.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              onClick={handleExportJson}
              className="flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs px-3 py-3 rounded-xl transition shadow"
            >
              <Download className="w-4 h-4" />
              Backup to Drive / File
            </button>

            <button
              onClick={handleCopyJson}
              className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs px-3 py-3 rounded-xl border border-slate-700 transition"
              title="Copy full JSON database to clipboard"
            >
              <Copy className="w-4 h-4 text-sky-400" />
              Copy JSON Backup
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs px-3 py-3 rounded-xl border border-slate-700 transition"
            >
              <Upload className="w-4 h-4 text-emerald-400" />
              Restore Backup (.JSON)
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportJson}
              className="hidden"
            />
          </div>

          <div className="pt-2 border-t border-slate-800 space-y-2">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Export Spreadsheets (.CSV)
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() =>
                  exportFileOrShare(
                    'fuel-log.csv',
                    generateFuelCsv(db),
                    'text/csv',
                    'Fuel Log CSV'
                  )
                }
                className="flex items-center justify-center gap-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg py-2 px-2 text-xs text-slate-200 transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                Fuel Log
              </button>
              <button
                onClick={() =>
                  exportFileOrShare(
                    'service-history.csv',
                    generateServiceHistoryCsv(db),
                    'text/csv',
                    'Service Log CSV'
                  )
                }
                className="flex items-center justify-center gap-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg py-2 px-2 text-xs text-slate-200 transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-sky-400" />
                Service Log
              </button>
              <button
                onClick={() =>
                  exportFileOrShare(
                    'parts-catalog.csv',
                    generatePartsCatalogCsv(db),
                    'text/csv',
                    'Parts Catalog CSV'
                  )
                }
                className="flex items-center justify-center gap-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg py-2 px-2 text-xs text-slate-200 transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
                Parts List
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vessel & Engine Profile Form */}
      <form
        onSubmit={handleSaveVessel}
        className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Anchor className="w-4 h-4 text-sky-400" />
            Vessel & Auxiliary Engine Profile
          </h3>
          {!IS_DEMO_MODE ? (
            <button
              type="submit"
              className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-lg transition"
            >
              <Save className="w-3.5 h-3.5" />
              Save Profile
            </button>
          ) : (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              Demo Mode: Read-Only
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Vessel Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                const newName = e.target.value;
                setName(newName);
                setSbBoatId(vesselNameToBoatSyncId(newName));
              }}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Sailboat Make & Model</label>
            <input
              type="text"
              value={boatMakeModel}
              onChange={(e) => setBoatMakeModel(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Engine Make & Model</label>
            <input
              type="text"
              value={engineMakeModel}
              onChange={(e) => setEngineMakeModel(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Engine Serial Number</label>
            <input
              type="text"
              value={engineSerial}
              onChange={(e) => setEngineSerial(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Fuel Type</label>
            <select
              value={fuelType}
              onChange={(e) => setFuelType(e.target.value as FuelType)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-medium focus:border-sky-500 focus:outline-none"
            >
              <option value="diesel">Diesel</option>
              <option value="gasoline">Gasoline (Gas)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Fuel Tank (Gal)</label>
            <input
              type="number"
              step="0.5"
              value={fuelCapacity}
              onChange={(e) => setFuelCapacity(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Default GPH</label>
            <input
              type="number"
              step="0.05"
              value={defaultGph}
              onChange={(e) => setDefaultGph(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
            />
          </div>
        </div>

        {/* Vessel Insignia & Builder Logo Picker */}
        <div className="pt-3 border-t border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-sky-400" />
              Title Bar Insignia / Builder Logo
            </label>
            <span className="text-[10px] text-slate-500">Appears on the top header</span>
          </div>

          {/* Classic Nautical Icons */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
              Classic Nautical Icons
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ALL_INSIGNIAS.filter((i) => i.category === 'classic').map((ins) => {
                const isSelected =
                  vesselInsignia === ins.id || (!vesselInsignia && ins.id === 'compass');
                return (
                  <button
                    key={ins.id}
                    type="button"
                    onClick={() => handleSelectInsignia(ins.id)}
                    className={`flex items-center gap-2 p-2 rounded-xl border text-left transition cursor-pointer ${
                      isSelected
                        ? 'bg-sky-500/20 border-sky-500 text-sky-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-lg bg-slate-900 flex items-center justify-center shrink-0 border border-slate-800 text-sky-400">
                      {ins.renderIcon('w-3.5 h-3.5')}
                    </div>
                    <span className="text-[11px] font-bold truncate">{ins.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sailboat Builder Logos */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                Sailboat Builder Logos (27 Brands)
              </span>
              <span className="text-[10px] text-slate-500">Wide badge format</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1">
              {ALL_INSIGNIAS.filter((i) => i.category === 'builder').map((ins) => {
                const isSelected = vesselInsignia === ins.id;
                return (
                  <button
                    key={ins.id}
                    type="button"
                    onClick={() => handleSelectInsignia(ins.id)}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border text-center transition cursor-pointer ${
                      isSelected
                        ? 'bg-sky-500/20 border-sky-500 text-sky-200 ring-1 ring-sky-400/50'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="w-full h-11 rounded-lg bg-white/95 px-2 py-1 flex items-center justify-center border border-slate-300 overflow-hidden shadow-inner">
                      {ins.renderIcon('max-h-9 w-auto max-w-full')}
                    </div>
                    <span className="text-[11px] font-bold truncate w-full">{ins.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Insignia Upload */}
          {!IS_DEMO_MODE ? (
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-sky-300 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition">
                <Camera className="w-3.5 h-3.5" />
                <span>
                  {isUploadingInsignia ? 'Compressing...' : '+ Upload Custom Logo / Burgee'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={isUploadingInsignia}
                  className="hidden"
                  onChange={(e) => {
                    void handleInsigniaFileUpload(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>

              {vesselInsignia && vesselInsignia !== 'compass' && (
                <button
                  type="button"
                  onClick={() => handleSelectInsignia('compass')}
                  className="text-[11px] text-slate-400 hover:text-slate-200 underline cursor-pointer"
                >
                  Reset to Default Compass
                </button>
              )}
            </div>
          ) : null}
        </div>
      </form>

            {/* GPS Tracking & Battery Consumption Profile */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3.5">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            GPS Tracking & Battery Profile
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure how frequently the GPS satellite receiver polls your position during passage tracking to balance navigation accuracy against battery consumption.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {Object.values(GPS_POLLING_PROFILES).map((prof) => {
            const isSelected = (db.vessel.gpsPollingProfile || 'cruising') === prof.id;
            return (
              <button
                key={prof.id}
                type="button"
                onClick={() => {
                  onUpdateDb((prev) => ({
                    ...prev,
                    vessel: {
                      ...prev.vessel,
                      gpsPollingProfile: prof.id,
                    },
                  }));
                  showToast(`GPS profile updated to ${prof.label}`);
                }}
                className={`text-left p-3 rounded-xl border transition cursor-pointer flex flex-col justify-between gap-2.5 ${
                  isSelected
                    ? 'bg-sky-500/15 border-sky-500 text-sky-200 ring-1 ring-sky-500/50'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-xs text-white flex items-center gap-1.5">
                      {isSelected ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-slate-700 shrink-0" />
                      )}
                      {prof.label}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                        prof.id === 'high'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : prof.id === 'balanced'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : prof.id === 'cruising'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      }`}
                    >
                      {prof.batteryHint}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
                    {prof.description}
                  </p>
                </div>
                <div className="text-[10px] font-mono text-slate-500 pt-1.5 border-t border-slate-800/60 flex items-center justify-between">
                  <span>Ping: {prof.intervalSeconds}s</span>
                  <span>Filter: {prof.distanceFilterMeters === 0 ? 'None (0m)' : `${prof.distanceFilterMeters}m`}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Optional Vessel Wallpaper & Background */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-sky-400" />
              Vessel Wallpaper & Background
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                Optional
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Personalize your app with a photo of your boat or a nautical background.
            </p>
          </div>

          {/* Master Enable/Disable Toggle */}
          <button
            type="button"
            onClick={() => {
              const nextState = !wallpaperEnabled;
              updateWallpaperSettings(nextState, wallpaperUrl, wallpaperOpacity);
              showToast(
                nextState ? 'Wallpaper enabled' : 'Wallpaper disabled (clean slate theme)'
              );
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
              wallpaperEnabled
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-sm'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                wallpaperEnabled ? 'bg-sky-400 animate-pulse' : 'bg-slate-600'
              }`}
            />
            <span>{wallpaperEnabled ? 'Enabled' : 'Disabled (Default)'}</span>
          </button>
        </div>

        {wallpaperEnabled ? (
          <div className="space-y-3 pt-1 border-t border-slate-800/80">
            {/* Live Preview Box if wallpaperUrl exists */}
            {wallpaperUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950 h-28 flex items-center justify-center group">
                <div
                  className="absolute inset-0 bg-cover bg-center transition-opacity"
                  style={{
                    backgroundImage: `url(${wallpaperUrl})`,
                    opacity: wallpaperOpacity,
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-transparent to-slate-950/80 pointer-events-none" />
                <div className="relative z-10 text-center px-4 py-2 bg-slate-900/80 backdrop-blur rounded-lg border border-slate-700/60 shadow">
                  <span className="text-xs font-bold text-white flex items-center justify-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-sky-400" />
                    Live Backdrop Preview ({Math.round(wallpaperOpacity * 100)}% Opacity)
                  </span>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Active background behind cards & gauges
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClearWallpaper}
                  className="absolute top-2 right-2 bg-rose-950/80 hover:bg-rose-900 text-rose-300 p-1.5 rounded-lg border border-rose-800/60 transition shadow opacity-0 group-hover:opacity-100 cursor-pointer"
                  title="Remove wallpaper"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-xl p-4 text-center space-y-1.5">
                <ImageIcon className="w-6 h-6 text-slate-600 mx-auto" />
                <div className="text-xs text-slate-300 font-semibold">
                  No wallpaper image selected yet
                </div>
                <p className="text-[11px] text-slate-500">
                  Upload a photo of your boat below or pick one of our nautical presets.
                </p>
              </div>
            )}

            {/* Custom Upload Button */}
            {!IS_DEMO_MODE ? (
              <div className="flex items-center gap-2 pt-1">
                <label className="flex-1 flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs py-2 px-3 rounded-xl transition cursor-pointer shadow">
                  <Camera className="w-4 h-4" />
                  <span>
                    {isUploadingWallpaper ? 'Compressing...' : '+ Upload Custom Boat Photo'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={isUploadingWallpaper}
                    className="hidden"
                    onChange={(e) => {
                      void handleWallpaperFileUpload(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </label>

                {wallpaperUrl && (
                  <button
                    type="button"
                    onClick={handleClearWallpaper}
                    className="px-3 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-950/30 hover:bg-rose-950/50 border border-rose-800/40 rounded-xl transition cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
            ) : null}

            {/* Curated Nautical Presets */}
            <div>
              <label className="block text-[11px] text-slate-400 font-semibold mb-1.5">
                Or Pick a Nautical Preset:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    name: 'Deep Ocean Wake',
                    url: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?auto=format&fit=crop&w=1200&q=80',
                  },
                  {
                    name: 'Glassy Anchorage',
                    url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80',
                  },
                  {
                    name: 'Night Ocean',
                    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
                  },
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      updateWallpaperSettings(true, preset.url, wallpaperOpacity);
                      showToast(`Applied preset: ${preset.name}`);
                    }}
                    className={`relative rounded-lg overflow-hidden border p-1 text-center transition group cursor-pointer ${
                      wallpaperUrl === preset.url
                        ? 'border-sky-500 bg-sky-950/40 ring-1 ring-sky-500'
                        : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                    }`}
                  >
                    <div className="h-10 rounded overflow-hidden mb-1">
                      <img
                        src={preset.url}
                        alt={preset.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                      />
                    </div>
                    <div className="text-[10px] text-slate-300 truncate font-medium">
                      {preset.name}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Opacity Slider */}
            {wallpaperUrl && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-sky-400" />
                    Backdrop Dimming & Opacity
                  </label>
                  <span className="text-xs font-mono font-bold text-sky-300 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800/40">
                    {Math.round(wallpaperOpacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.45"
                  step="0.02"
                  value={wallpaperOpacity}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    updateWallpaperSettings(true, wallpaperUrl, val);
                  }}
                  className="w-full accent-sky-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Subtle (5%)</span>
                  <span>Balanced (20%)</span>
                  <span>Vivid (45%)</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-slate-400 bg-slate-950/60 rounded-xl p-3 border border-slate-800 flex items-center justify-between">
            <span>Using the default clean, dark slate background.</span>
            <button
              type="button"
              onClick={() => {
                updateWallpaperSettings(true, wallpaperUrl, wallpaperOpacity);
                showToast('Wallpaper enabled');
              }}
              className="text-xs font-bold text-sky-400 hover:text-sky-300 cursor-pointer"
            >
              Turn On Wallpaper →
            </button>
          </div>
        )}
      </div>

      {/* Vessel Systems & Custom Categories Manager */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Tag className="w-4 h-4 text-sky-400" />
              Vessel Systems & Custom Categories
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage custom equipment systems. Renaming cascades across all parts, maintenance tasks, and service logs.
            </p>
          </div>
        </div>

        {/* Add New Custom Category Row */}
        <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
          <input
            type="text"
            placeholder="Add new custom category (e.g. Electronics & Nav, HVAC, Tender)..."
            value={newCustomCategoryInput}
            onChange={(e) => setNewCustomCategoryInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCategory();
              }
            }}
            className="flex-1 bg-transparent border-none text-xs text-white placeholder-slate-500 focus:outline-none px-2 py-1"
          />
          <button
            type="button"
            onClick={handleAddCategory}
            disabled={!newCustomCategoryInput.trim()}
            className="flex items-center gap-1 bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-lg transition shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Category
          </button>
        </div>

        {/* Custom Categories List */}
        <div className="space-y-2 pt-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            User-Defined Systems ({customCategoriesList.length})
          </span>

          {customCategoriesList.length === 0 ? (
            <div className="text-xs text-slate-500 italic bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
              No custom categories created yet. Standard systems are active below.
            </div>
          ) : (
            <div className="space-y-1.5">
              {customCategoriesList.map((cat) => {
                const partsCount = db.parts.filter((p) => p.category === cat).length;
                const tasksCount = db.schedules.filter((s) => s.category === cat).length;
                const logsCount = db.serviceLogs.filter((l) => l.category === cat).length;
                const isEditing = editingCategoryOldName === cat;

                return (
                  <div
                    key={cat}
                    className="flex items-center justify-between bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 gap-2"
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 flex-1">
                        <input
                          type="text"
                          value={editingCategoryNewName}
                          onChange={(e) => setEditingCategoryNewName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRenameCategory(cat);
                            if (e.key === 'Escape') setEditingCategoryOldName(null);
                          }}
                          className="flex-1 bg-slate-900 border border-sky-500 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveRenameCategory(cat)}
                          className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCategoryOldName(null)}
                          className="px-2 py-1 text-slate-400 hover:text-slate-200 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-sky-400" />
                            {cat}
                          </span>
                          <span className="text-[10px] text-slate-400 bg-slate-900 border border-slate-800 rounded px-2 py-0.5 font-mono">
                            {partsCount} parts • {tasksCount} tasks • {logsCount} logs
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCategoryOldName(cat);
                              setEditingCategoryNewName(cat);
                            }}
                            className="p-1.5 text-slate-400 hover:text-sky-300 rounded hover:bg-slate-800 transition"
                            title={`Rename ${cat}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 rounded hover:bg-rose-500/10 transition"
                            title={`Delete ${cat}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Standard Systems Reference */}
        <div className="pt-2 border-t border-slate-800 space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            Standard Vessel Systems (Built-in)
          </span>
          <div className="flex flex-wrap gap-1.5">
            {STANDARD_CATEGORIES.map((std) => (
              <span
                key={std}
                className="text-[11px] bg-slate-950 text-slate-400 border border-slate-800/80 rounded-lg px-2.5 py-1"
              >
                {std}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Modal: Reassign Items Before Deleting Category */}
      {reassignModalOldCat && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-rose-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-white">Reassign Active Items</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Category <strong className="text-white">"{reassignModalOldCat}"</strong> is currently in use. Select a target category to reassign all linked parts, tasks, and history records to:
            </p>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Reassign items to:</label>
              <select
                value={reassignTargetCat}
                onChange={(e) => setReassignTargetCat(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
              >
                {allAvailableCategories
                  .filter((c) => c !== reassignModalOldCat)
                  .map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReassignModalOldCat(null)}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReassignAndDelete}
                className="px-3.5 py-2 rounded-lg text-xs font-bold bg-rose-500 hover:bg-rose-400 text-white transition"
              >
                Reassign & Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Android Install Guide + Reset */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-start gap-2.5">
          <Smartphone className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300 space-y-1">
            <div className="font-bold text-white">Installing on your Android Phone</div>
            <p className="text-slate-400">
              Open this app in Chrome on Android, tap the 3-dot menu (⋮) in the top right, and select{' '}
              <strong className="text-slate-200">"Add to Home screen" / "Install app"</strong>. It will run full-screen and work 100% offline at sea.
            </p>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-end gap-4">
          {!IS_DEMO_MODE && (
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    'Clear all logs, schedules, parts, and reset vessel profile to empty?'
                  )
                ) {
                  onUpdateDb(() => getInitialEmptyDatabase());
                  showToast('Logbook cleared to empty defaults.');
                }
              }}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-400 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Clear All Entries (Empty Logbook)
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  'Reset all logs and schedules back to the sample Hunter 33 / Yanmar 3YM30 data?'
                )
              ) {
                onUpdateDb(() => getInitialSampleDatabase());
                showToast('Sample sailboat data restored.');
              }
            }}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-400 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {IS_DEMO_MODE ? 'Reset to Sample Sailboat Data' : 'Load Sample Sailboat Data'}
          </button>
        </div>
      </div>

      {/* Creator Credits & Legal Rights Notice */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Anchor className="w-4 h-4 text-sky-400" />
          <span className="text-sm font-extrabold text-white tracking-wide">
            Captain's Logger
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-sky-300 border border-slate-700">
            {import.meta.env.VITE_APP_VERSION || 'v1.0'}
          </span>
        </div>
        <p className="text-xs text-slate-300 font-medium">
          Designed &amp; Developed by <strong className="text-white">Eddie Fiorelli</strong>
        </p>
        <p className="text-[11px] text-slate-400">
          © 2026 Eddie Fiorelli. Licensed under GNU GPLv3.
        </p>
        <div className="pt-1 flex items-center justify-center gap-3 text-xs">
          <a
            href="https://github.com/tatertot3000/CaptainsLogger"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-400 hover:text-sky-300 font-semibold underline underline-offset-2 transition"
          >
            GitHub Repository
          </a>
          <span className="text-slate-600">•</span>
          <a
            href="https://github.com/tatertot3000/CaptainsLogger/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-400 hover:text-sky-300 font-semibold underline underline-offset-2 transition"
          >
            Questions &amp; Feedback
          </a>
        </div>
        <div className="pt-2 border-t border-slate-800/60 flex items-center justify-center gap-3 text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Offline Nautical PWA
          </span>
          <span>•</span>
          <span>Open Source (GPL-3.0)</span>
        </div>
      </div>
    </div>
  );
};
