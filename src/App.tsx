import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Camera,
  Cloud,
  Database,
  Fuel,
  Gauge,
  HardDrive,
  Moon,
  Package,
  Sailboat,
  Settings,
  Sun,
  Wrench,
  X,
} from 'lucide-react';
import { CaptainsDatabase } from './types';
import { isInitialSampleDatabase, loadDatabase, saveDatabase } from './db/storage';
import {
  loadSupabaseConfig,
  pullFromLocalDiskFile,
  pullFromSupabaseCloud,
  pushToLocalDiskFile,
  pushToSupabaseCloud,
  saveSupabaseConfig,
  SupabaseSyncConfig,
  SyncStatusReport,
  vesselNameToBoatSyncId,
} from './db/supabaseSync';
import { calculateFuelStats, compressImageFile, evaluateSchedule } from './utils/vendors';
import { ALL_INSIGNIAS, isBadgeLogoInsignia, renderVesselInsignia } from './utils/insignias';
import { IS_DEMO_MODE } from './utils/demoMode';
import { MaintenanceView } from './components/MaintenanceView';
import { SailLogView } from './components/SailLogView';
import { FuelLogView } from './components/FuelLogView';
import { PartsCatalogView } from './components/PartsCatalogView';
import { BackupSettingsView } from './components/BackupSettingsView';
import { EngineHoursModal } from './components/EngineHoursModal';

type ActiveTab = 'maintenance' | 'sail' | 'fuel' | 'parts' | 'settings';

export const App: React.FC = () => {
  const [db, setDb] = useState<CaptainsDatabase>(() => loadDatabase());
  const [activeTab, setActiveTab] = useState<ActiveTab>('sail');
  const [nightMode, setNightMode] = useState(false);
  const [showEngineHoursModal, setShowEngineHoursModal] = useState(false);
  const [showInsigniaModal, setShowInsigniaModal] = useState(false);
  const [showManualsModal, setShowManualsModal] = useState(false);
  const [highlightedPartId, setHighlightedPartId] = useState<string | null>(null);

  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseSyncConfig>(() =>
    loadSupabaseConfig()
  );
  const [syncReport, setSyncReport] = useState<SyncStatusReport>(() => ({
    diskStatus: 'syncing',
    cloudStatus: loadSupabaseConfig().enabled ? 'syncing' : 'unconfigured',
  }));

  const syncAllLayers = useCallback(
    async (
      currentDb: CaptainsDatabase,
      currentSbConfig: SupabaseSyncConfig,
      direction: 'auto' | 'push' | 'pull' = 'auto'
    ) => {
      if (IS_DEMO_MODE) return;

      let workingDb = currentDb;
      let activeSbConfig = currentSbConfig;
      let updatedFromRemote = false;

      setSyncReport((prev) => ({
        ...prev,
        diskStatus: 'syncing',
        cloudStatus: activeSbConfig.enabled ? 'syncing' : 'unconfigured',
      }));

      // 1. Check Local Disk File (Option A) if pulling or auto-reconciling
      if (direction === 'auto' || direction === 'pull') {
        const diskRes = await pullFromLocalDiskFile();
        if (diskRes.exists && diskRes.data && diskRes.data.vessel) {
          const diskTime = new Date(diskRes.data.exportedAt || 0).getTime();
          const localTime = new Date(workingDb.exportedAt || 0).getTime();
          const diskIsSample = isInitialSampleDatabase(diskRes.data);
          const localIsSample = isInitialSampleDatabase(workingDb);
          if (!diskIsSample && (localIsSample || diskTime > localTime)) {
            workingDb = diskRes.data;
            updatedFromRemote = true;
          }
        }
      }

      // 2. Check Supabase Cloud (Option B) if configured
      if (activeSbConfig.enabled && (direction === 'auto' || direction === 'pull')) {
        const cloudRes = await pullFromSupabaseCloud(activeSbConfig);
        if (cloudRes.ok && cloudRes.data && cloudRes.data.vessel) {
          const cloudTime = new Date(cloudRes.data.exportedAt || 0).getTime();
          const localTime = new Date(workingDb.exportedAt || 0).getTime();
          const cloudIsSample = isInitialSampleDatabase(cloudRes.data);
          const localIsSample = isInitialSampleDatabase(workingDb);
          if (
            direction === 'pull' ||
            (!cloudIsSample && (localIsSample || cloudTime > localTime))
          ) {
            workingDb = cloudRes.data;
            updatedFromRemote = true;
          }
          if (
            cloudRes.discoveredBoatId &&
            cloudRes.discoveredBoatId !== activeSbConfig.boatSyncId
          ) {
            activeSbConfig = {
              ...activeSbConfig,
              boatSyncId: cloudRes.discoveredBoatId,
            };
            saveSupabaseConfig(activeSbConfig);
            setSupabaseConfig(activeSbConfig);
          }
        }
      }

      if (updatedFromRemote) {
        saveDatabase(workingDb, true);
        setDb(workingDb);
      }

      // Prevent an unedited fresh-install sample database from overwriting real data on disk or Supabase during auto-sync
      const allowPush = direction === 'push' || !isInitialSampleDatabase(workingDb);

      // 3. Push latest snapshot to Local Disk File (Option A)
      const diskPush: { ok: boolean; filePath?: string; savedAt?: string } = allowPush
        ? await pushToLocalDiskFile(workingDb)
        : { ok: false };

      // 4. Push latest snapshot to Supabase Cloud (Option B)
      let cloudStatus: SyncStatusReport['cloudStatus'] = 'unconfigured';
      let cloudLastSynced: string | undefined;
      let cloudError: string | undefined;

      if (activeSbConfig.enabled) {
        if (allowPush) {
          const cloudPush = await pushToSupabaseCloud(workingDb, activeSbConfig);
          if (cloudPush.ok) {
            cloudStatus = 'synced';
            cloudLastSynced = cloudPush.syncedAt;
          } else {
            cloudStatus =
              typeof navigator !== 'undefined' && !navigator.onLine
                ? 'offline-pending'
                : 'error';
            cloudError = cloudPush.error;
          }
        } else {
          cloudStatus = 'synced';
          cloudLastSynced = new Date().toISOString();
        }
      }

      setSyncReport({
        diskStatus: diskPush.ok ? 'saved' : 'unavailable',
        diskFilePath: diskPush.filePath,
        diskLastSaved: diskPush.savedAt,
        cloudStatus,
        cloudLastSynced,
        cloudError,
      });
    },
    []
  );

  // Initial reconcile on boot + auto-sync when coming back online
  useEffect(() => {
    // In Public Demo Mode, do NOT pull from local disk (data/captains-log.json) or Supabase
    if (IS_DEMO_MODE) {
      setSyncReport({
        diskStatus: 'unavailable',
        cloudStatus: 'unconfigured',
      });
      return;
    }

    void syncAllLayers(db, supabaseConfig, 'auto');

    const handleOnline = () => {
      void syncAllLayers(db, supabaseConfig, 'auto');
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpdateDb = (updater: (prev: CaptainsDatabase) => CaptainsDatabase) => {
    setDb((prev) => {
      const next: CaptainsDatabase = {
        ...updater(prev),
        exportedAt: new Date().toISOString(),
      };
      if (IS_DEMO_MODE) {
        return next;
      }

      saveDatabase(next);

      let workingSbConfig = supabaseConfig;
      if (next.vessel?.name && next.vessel.name !== prev.vessel?.name) {
        const autoSyncId = vesselNameToBoatSyncId(next.vessel.name);
        if (autoSyncId && autoSyncId !== supabaseConfig.boatSyncId) {
          workingSbConfig = {
            ...supabaseConfig,
            boatSyncId: autoSyncId,
          };
          saveSupabaseConfig(workingSbConfig);
          setSupabaseConfig(workingSbConfig);
        }
      }

      // Push asynchronously to Option A (Disk) and Option B (Supabase Cloud)
      void syncAllLayers(next, workingSbConfig, 'push');
      return next;
    });
  };

  const handleSaveSupabaseConfig = (newConfig: SupabaseSyncConfig) => {
    if (IS_DEMO_MODE) return;
    saveSupabaseConfig(newConfig);
    setSupabaseConfig(newConfig);
    void syncAllLayers(db, newConfig, 'auto');
  };

  const { overdueCount, dueSoonCount } = useMemo(() => {
    let overdue = 0;
    let dueSoon = 0;
    for (const s of db.schedules) {
      const ev = evaluateSchedule(s, db.vessel.currentEngineHours);
      if (ev.status === 'overdue') overdue++;
      else if (ev.status === 'due-soon') dueSoon++;
    }
    return { overdueCount: overdue, dueSoonCount: dueSoon };
  }, [db.schedules, db.vessel.currentEngineHours]);
  const lowSparesCount = useMemo(
    () =>
      db.parts.filter((p) => {
        if (p.trackQuantity === false) return false;
        const qty =
          p.itemType === 'consumable' && p.containers && p.containers.length > 0
            ? p.containers.reduce((sum, c) => sum + (c.quantityRemaining || 0), 0)
            : p.quantityOnBoard;
        return qty <= p.minQuantity;
      }).length,
    [db.parts]
  );
  const fuelStats = useMemo(
    () => calculateFuelStats(db.fuelLogs, db.vessel),
    [db.fuelLogs, db.vessel]
  );
  const hasUnderwayPassage = useMemo(
    () => (db.sailTrips || []).some((t) => t.status === 'underway'),
    [db.sailTrips]
  );
  const isWallpaperActive = Boolean(
    db.vessel.wallpaperEnabled && db.vessel.wallpaperUrl
  );
  const wallpaperOpacity = Math.min(
    Math.max(db.vessel.wallpaperOpacity ?? 0.2, 0.05),
    0.6
  );

  const handleJumpToPart = (partId: string) => {
    setHighlightedPartId(partId);
    setActiveTab('parts');
  };

  return (
    <div
      className={`min-h-screen bg-slate-950 text-slate-100 pb-24 ${
        nightMode ? 'night-vision-mode' : ''
      }`}
    >
      {/* Optional Custom Vessel Wallpaper Background */}
      {isWallpaperActive && (
        <div
          className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
          aria-hidden="true"
        >
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-300"
            style={{
              backgroundImage: `url(${db.vessel.wallpaperUrl})`,
              opacity: wallpaperOpacity,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/20 to-slate-950/70" />
        </div>
      )}

      {/* Top Nautical Header with Android Status Bar clearance */}
      <header
        className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur border-b border-slate-800 pb-3"
        style={{
          paddingTop: 'max(2.5rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))',
        }}
      >
        <div className="max-w-2xl mx-auto px-3 sm:px-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setShowInsigniaModal(true)}
              title="Vessel Insignia / Builder Logo (Tap to change)"
              className={
                isBadgeLogoInsignia(db.vessel.insignia)
                  ? 'h-8 sm:h-9 px-1 sm:px-2 py-0.5 sm:py-1 rounded-xl bg-white/95 border border-slate-300 shadow-sm flex items-center justify-center shrink-0 hover:bg-white transition cursor-pointer group'
                  : 'w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-sky-500/15 border border-sky-500/40 flex items-center justify-center shrink-0 hover:bg-sky-500/25 transition cursor-pointer group'
              }
            >
              {renderVesselInsignia(
                db.vessel.insignia,
                isBadgeLogoInsignia(db.vessel.insignia)
                  ? 'h-5 sm:h-7 w-auto max-w-[46px] sm:max-w-[100px] group-hover:scale-105 transition'
                  : 'w-4 h-4 sm:w-5 sm:h-5 text-sky-400 group-hover:scale-105 transition'
              )}
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-xs sm:text-sm font-extrabold text-white tracking-tight truncate leading-tight">
                {db.vessel.name}
              </h1>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate leading-tight">
                <span>{db.vessel.boatMakeModel}</span>
                <span className="hidden sm:inline"> • {db.vessel.engineMakeModel}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Live Disk & Cloud Sync Status Pill */}
            {!IS_DEMO_MODE ? (
              <button
                onClick={() => setActiveTab('settings')}
                title="Storage & Cloud Sync Status (Tap to configure)"
                className="flex items-center gap-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl px-1.5 sm:px-2 py-1 sm:py-1.5 text-[11px] font-semibold transition"
              >
                {syncReport.cloudStatus === 'synced' ? (
                  <>
                    <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300 hidden sm:inline">Synced</span>
                  </>
                ) : syncReport.diskStatus === 'saved' ? (
                  <>
                    <HardDrive className="w-3.5 h-3.5 text-sky-400" />
                    <span className="text-sky-300 hidden sm:inline">Disk Saved</span>
                  </>
                ) : (
                  <>
                    <Database className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-amber-300 hidden sm:inline">Offline</span>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={() => setActiveTab('settings')}
                title="Public Showcase Preview (Demo Mode)"
                className="flex items-center gap-1 bg-sky-950/60 hover:bg-sky-900/60 border border-sky-800/60 rounded-xl px-1.5 sm:px-2.5 py-1 sm:py-1.5 text-[10px] sm:text-[11px] font-semibold text-sky-300 transition"
              >
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-sky-400 shrink-0" />
                <span className="hidden sm:inline">Demo Mode</span>
              </button>
            )}

            {/* Quick Engine Hour Meter / Hours Pill */}
            <button
              onClick={() => setShowEngineHoursModal(true)}
              title="View Engine Hours Progression & Service Milestones"
              className="flex items-center gap-1 bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/50 rounded-xl px-1.5 sm:px-2.5 py-1 sm:py-1.5 transition group"
            >
              <Gauge className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
              <span className="text-[11px] sm:text-xs font-extrabold font-mono text-white">
                {db.vessel.currentEngineHours.toFixed(1)}h
              </span>
            </button>

            {/* Night Watch Red-Light Mode Toggle */}
            <button
              onClick={() => setNightMode((v) => !v)}
              title="Toggle Red-Light Night Watch Mode"
              className={`p-1.5 sm:p-2 rounded-xl border transition ${
                nightMode
                  ? 'bg-rose-950 border-rose-600 text-rose-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {nightMode ? <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container (no z-index here so child modals can stack above header z-30 & nav z-40) */}
      <main className="relative max-w-2xl mx-auto px-3 sm:px-4 pt-3 space-y-3.5 sm:space-y-4">
        {/* Quick Ship Status Strip */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          <button
            onClick={() => setActiveTab('maintenance')}
            className={`text-left p-2 sm:p-2.5 rounded-xl border transition ${
              overdueCount > 0
                ? 'bg-rose-950/40 border-rose-700/60'
                : dueSoonCount > 0
                ? 'bg-amber-950/40 border-amber-700/60'
                : 'bg-slate-900 border-slate-800'
            }`}
          >
            <div className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-slate-400 truncate">
              Maintenance
            </div>
            <div className="text-[11px] sm:text-xs font-bold mt-0.5 flex items-center gap-1 truncate">
              {overdueCount > 0 ? (
                <span className="text-rose-400 flex items-center gap-1 truncate">
                  <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                  <span>{overdueCount} Overdue</span>
                </span>
              ) : dueSoonCount > 0 ? (
                <span className="text-amber-300 truncate">{dueSoonCount} Due Soon</span>
              ) : (
                <span className="text-emerald-400 truncate">All Good</span>
              )}
            </div>
          </button>

          {activeTab === 'sail' ? (
            <button
              onClick={() => setActiveTab('fuel')}
              className="text-left p-2 sm:p-2.5 rounded-xl border bg-slate-900 border-slate-800 transition hover:border-sky-500/50 hover:bg-slate-900/90 group"
              title="View Fuel Tank Levels & Log Refueling"
            >
              <div className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-slate-400 truncate flex items-center gap-1">
                <Fuel className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-sky-400 shrink-0" />
                <span>
                  {db.vessel.fuelType === 'gasoline' ? 'Est. Gas Tank' : 'Est. Diesel Tank'}
                </span>
              </div>
              <div className="text-[11px] sm:text-xs font-bold mt-0.5 text-sky-400 font-mono truncate flex items-center gap-1">
                <span>
                  {fuelStats.estimatedGallonsRemaining}g ({fuelStats.estimatedTankPercent}%)
                </span>
              </div>
            </button>
          ) : (
            <button
              onClick={() => {
                setActiveTab('maintenance');
                setShowManualsModal(true);
              }}
              className="text-left p-2 sm:p-2.5 rounded-xl border bg-slate-900 border-slate-800 transition hover:border-indigo-500/50 hover:bg-slate-900/90 group"
              title="Open Equipment Manuals & Schematics Locker"
            >
              <div className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-indigo-300 truncate flex items-center gap-1">
                <BookOpen className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-indigo-400 shrink-0" />
                <span>Service Manuals</span>
              </div>
              <div className="text-[11px] sm:text-xs font-bold mt-0.5 text-indigo-200 truncate flex items-center gap-1">
                <span>{(db.manuals || []).length} PDF Manuals</span>
              </div>
            </button>
          )}

          <button
            onClick={() => setActiveTab('parts')}
            className={`text-left p-2 sm:p-2.5 rounded-xl border transition ${
              lowSparesCount > 0
                ? 'bg-rose-950/30 border-rose-800/60'
                : 'bg-slate-900 border-slate-800'
            }`}
          >
            <div className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-slate-400 truncate">
              Spares Locker
            </div>
            <div className="text-[11px] sm:text-xs font-bold mt-0.5 truncate">
              {lowSparesCount > 0 ? (
                <span className="text-rose-400 flex items-center gap-1 truncate">
                  <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                  <span>Low Supply</span>
                </span>
              ) : (
                <span className="text-emerald-400 truncate">Good Supply</span>
              )}
            </div>
          </button>
        </div>

        {/* Active View */}
        {activeTab === 'maintenance' && (
          <MaintenanceView
            db={db}
            onUpdateDb={handleUpdateDb}
            onJumpToPart={handleJumpToPart}
            showManualsModalSignal={showManualsModal}
            onCloseManualsModal={() => setShowManualsModal(false)}
          />
        )}

        <div className={activeTab === 'sail' ? '' : 'hidden'}>
          <SailLogView
            db={db}
            onUpdateDb={handleUpdateDb}
          />
        </div>

        {activeTab === 'fuel' && (
          <FuelLogView
            db={db}
            onUpdateDb={handleUpdateDb}
            onJumpToPart={handleJumpToPart}
          />
        )}

        {activeTab === 'parts' && (
          <PartsCatalogView
            db={db}
            onUpdateDb={handleUpdateDb}
            highlightedPartId={highlightedPartId}
            onClearHighlight={() => setHighlightedPartId(null)}
          />
        )}

        {activeTab === 'settings' && (
          <BackupSettingsView
            db={db}
            onUpdateDb={handleUpdateDb}
            supabaseConfig={supabaseConfig}
            onSaveSupabaseConfig={handleSaveSupabaseConfig}
            syncReport={syncReport}
            onTriggerManualSync={(dir) => syncAllLayers(db, supabaseConfig, dir)}
          />
        )}
      </main>

      {/* Bottom Android Navigation Bar */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur border-t border-slate-800"
        style={{
          paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="max-w-2xl mx-auto grid grid-cols-5">
          

          <button
            onClick={() => setActiveTab('sail')}
            className={`flex flex-col items-center justify-center py-2.5 gap-1 text-[11px] font-semibold transition relative ${
              activeTab === 'sail'
                ? 'text-sky-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sailboat className="w-5 h-5" />
            <span>Passage Log</span>
            {hasUnderwayPassage && (
              <span className="absolute top-1.5 right-4 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('maintenance')}
            className={`flex flex-col items-center justify-center py-2.5 gap-1 text-[11px] font-semibold transition relative ${
              activeTab === 'maintenance'
                ? 'text-sky-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wrench className="w-5 h-5" />
            <span>Maintenance</span>
            {overdueCount > 0 && (
              <span className="absolute top-1.5 right-4 w-2 h-2 rounded-full bg-rose-500" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('fuel')}
            className={`flex flex-col items-center justify-center py-2.5 gap-1 text-[11px] font-semibold transition ${
              activeTab === 'fuel'
                ? 'text-sky-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Fuel className="w-5 h-5" />
            <span>Fuel Log</span>
          </button>

          <button
            onClick={() => setActiveTab('parts')}
            className={`flex flex-col items-center justify-center py-2.5 gap-1 text-[11px] font-semibold transition relative ${
              activeTab === 'parts'
                ? 'text-sky-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Package className="w-5 h-5" />
            <span>Parts Locker</span>
            {lowSparesCount > 0 && (
              <span className="absolute top-1.5 right-4 w-2 h-2 rounded-full bg-rose-500" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center justify-center py-2.5 gap-1 text-[11px] font-semibold transition ${
              activeTab === 'settings'
                ? 'text-sky-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </button>
        </div>
      </nav>

      {/* Engine Hours Progression & Service Milestones Modal */}
      {showEngineHoursModal && (
        <EngineHoursModal
          db={db}
          onClose={() => setShowEngineHoursModal(false)}
          onUpdateDb={(updated) => handleUpdateDb(() => updated)}
        />
      )}

      {/* Insignia / Builder Logo Quick Picker Modal */}
      {showInsigniaModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  {isBadgeLogoInsignia(db.vessel.insignia) ? (
                    <span className="inline-flex items-center justify-center bg-white/95 rounded-md px-1.5 py-0.5 border border-slate-300">
                      {renderVesselInsignia(db.vessel.insignia, 'h-4 w-auto max-w-[70px]')}
                    </span>
                  ) : (
                    renderVesselInsignia(db.vessel.insignia, 'w-4 h-4 text-sky-400')
                  )}
                  Vessel Insignia &amp; Logo
                </h3>
                <p className="text-xs text-slate-400">
                  Select your boatbuilder logo or upload a custom insignia
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowInsigniaModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Builder Logos */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                  Sailboat Builders (27 Brands)
                </span>
                <span className="text-[10px] text-slate-500">Scroll to browse</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-1.5 max-h-72 overflow-y-auto pr-1">
                {ALL_INSIGNIAS.filter((i) => i.category === 'builder').map((ins) => {
                  const isSelected = db.vessel.insignia === ins.id;
                  return (
                    <button
                      key={ins.id}
                      type="button"
                      onClick={() => {
                        handleUpdateDb((prev) => ({
                          ...prev,
                          vessel: { ...prev.vessel, insignia: ins.id },
                        }));
                        setShowInsigniaModal(false);
                      }}
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border text-center transition cursor-pointer ${
                        isSelected
                          ? 'bg-sky-500/20 border-sky-500 text-sky-200 ring-1 ring-sky-400/50'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="w-full h-11 rounded-lg bg-white/95 px-2 py-1 flex items-center justify-center border border-slate-300 overflow-hidden shadow-inner">
                        {ins.renderIcon('max-h-9 w-auto max-w-full')}
                      </div>
                      <div className="text-[11px] font-bold truncate w-full">{ins.name}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Nautical Classics */}
            <div>
              <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                Nautical Classics
              </span>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                {ALL_INSIGNIAS.filter((i) => i.category === 'classic').map((ins) => {
                  const isSelected =
                    db.vessel.insignia === ins.id || (!db.vessel.insignia && ins.id === 'compass');
                  return (
                    <button
                      key={ins.id}
                      type="button"
                      onClick={() => {
                        handleUpdateDb((prev) => ({
                          ...prev,
                          vessel: { ...prev.vessel, insignia: ins.id },
                        }));
                        setShowInsigniaModal(false);
                      }}
                      className={`flex items-center gap-2 p-2 rounded-xl border text-left transition cursor-pointer ${
                        isSelected
                          ? 'bg-sky-500/20 border-sky-500 text-sky-200'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center shrink-0 border border-slate-800 text-sky-400">
                        {ins.renderIcon('w-4 h-4')}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">{ins.name}</div>
                        <div className="text-[10px] text-slate-500 truncate">{ins.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Upload (Disabled in Demo Mode) */}
            {!IS_DEMO_MODE ? (
              <div className="pt-2 border-t border-slate-800">
                <label className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-sky-300 font-semibold text-xs py-2 px-3 rounded-xl border border-slate-700 transition cursor-pointer shadow">
                  <Camera className="w-4 h-4" />
                  <span>Upload Custom Logo / Burgee</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const compressed = await compressImageFile(file, 512, 0.85);
                        handleUpdateDb((prev) => ({
                          ...prev,
                          vessel: { ...prev.vessel, insignia: compressed },
                        }));
                        setShowInsigniaModal(false);
                      } catch (err) {
                        console.error('Failed to compress insignia logo:', err);
                      }
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
