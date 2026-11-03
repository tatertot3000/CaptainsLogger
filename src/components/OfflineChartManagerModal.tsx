import React, { useState, useEffect, useRef } from 'react';
import {
  DownloadCloud,
  HardDrive,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  Compass,
  Radio,
  Layers,
  StopCircle,
} from 'lucide-react';
import {
  calculateTilePack,
  downloadTilePack,
  getOfflineCacheStats,
  clearOfflineTileCache,
  DownloadProgress,
} from '../utils/offlineMapTiles';
import { toMarineCoordinates } from '../utils/geo';

export interface OfflineChartManagerModalProps {
  centerLat: number;
  centerLon: number;
  centerLabel?: string;
  onClose: () => void;
  onDownloaded?: () => void;
}

export const OfflineChartManagerModal: React.FC<OfflineChartManagerModalProps> = ({
  centerLat,
  centerLon,
  centerLabel,
  onClose,
  onDownloaded,
}) => {
  const [radiusNm, setRadiusNm] = useState<number>(25);
  const [includeSeamarks, setIncludeSeamarks] = useState<boolean>(true);
  const [cacheStats, setCacheStats] = useState<{
    totalTiles: number;
    formattedSize: string;
  }>({ totalTiles: 0, formattedSize: '0 MB' });

  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load current cache stats
  const refreshCacheStats = async () => {
    const stats = await getOfflineCacheStats();
    setCacheStats({
      totalTiles: stats.totalTiles,
      formattedSize: stats.formattedSize,
    });
  };

  useEffect(() => {
    refreshCacheStats();
  }, []);

  // Compute tile count & estimated size for current selected radius
  const packCalc = calculateTilePack(centerLat, centerLon, radiusNm, 10, 13);
  const totalDownloadTiles = includeSeamarks ? packCalc.totalTiles * 2 : packCalc.totalTiles;
  const totalEstimatedBytes = includeSeamarks ? packCalc.estimatedBytes * 2 : packCalc.estimatedBytes;
  const estimatedMb = (totalEstimatedBytes / (1024 * 1024)).toFixed(1);

  // Handle Download
  const handleStartDownload = async () => {
    abortControllerRef.current = new AbortController();

    try {
      await downloadTilePack({
        centerLat,
        centerLon,
        radiusNm,
        minZoom: 10,
        maxZoom: 13,
        includeSeamarks,
        abortSignal: abortControllerRef.current.signal,
        onProgress: (p) => setDownloadProgress(p),
      });

      await refreshCacheStats();
      onDownloaded?.();
    } catch (err: any) {
      if (err?.message?.includes('cancelled')) {
        // user cancelled
      } else {
        console.warn('Offline download error:', err);
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleCancelDownload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleClearCache = async () => {
    if (
      window.confirm(
        'Delete all saved offline marine charts from this device? You can re-download anytime.'
      )
    ) {
      setIsClearing(true);
      await clearOfflineTileCache();
      await refreshCacheStats();
      setIsClearing(false);
      onDownloaded?.();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
      onClick={downloadProgress?.status === 'downloading' ? undefined : onClose}
    >
      <div
        className="w-full max-w-lg bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400">
              <DownloadCloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Offline Marine Chart Packs</h3>
              <p className="text-[11px] text-slate-400">Pre-load charts for offshore sailing with 0 bars</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={downloadProgress?.status === 'downloading'}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition disabled:opacity-40 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Storage Usage Bar */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="text-slate-400">Offline Storage Used: </span>
                <strong className="text-slate-100 font-mono">{cacheStats.formattedSize}</strong>
                <span className="text-slate-500 ml-1">({cacheStats.totalTiles} tiles stored)</span>
              </div>
            </div>

            {cacheStats.totalTiles > 0 && (
              <button
                type="button"
                onClick={handleClearCache}
                disabled={isClearing || downloadProgress?.status === 'downloading'}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 px-2 py-1 rounded-lg transition cursor-pointer"
                title="Wipe cached tiles to free up device space"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isClearing ? 'Clearing...' : 'Clear Cache'}</span>
              </button>
            )}
          </div>

          {/* Center Coordinates & Region */}
          <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-1">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-teal-400" />
              <span>Pack Center Point</span>
            </div>
            <div className="text-sm font-bold text-slate-200">
              {centerLabel || 'Selected Cruising Area'}
            </div>
            <div className="text-xs font-mono text-teal-300">
              {toMarineCoordinates(centerLat, centerLon)}
            </div>
          </div>

          {/* Cruising Radius Presets */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Cruising Radius</span>
              <span className="text-sky-400 font-mono font-bold">{radiusNm} NM (~{radiusNm * 2} NM across)</span>
            </label>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setRadiusNm(10)}
                disabled={downloadProgress?.status === 'downloading'}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                  radiusNm === 10
                    ? 'bg-sky-500/20 border-sky-500 text-sky-200 shadow'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-xs text-white">10 NM</div>
                <div className="text-[10px] text-slate-400">Local Bay</div>
                <div className="text-[10px] font-mono text-sky-400 mt-1">~3 MB</div>
              </button>

              <button
                type="button"
                onClick={() => setRadiusNm(25)}
                disabled={downloadProgress?.status === 'downloading'}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer relative ${
                  radiusNm === 25
                    ? 'bg-sky-500/20 border-sky-500 text-sky-200 shadow'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="absolute -top-1.5 -right-1 text-[9px] font-bold bg-amber-500 text-slate-950 px-1.5 rounded-full">
                  POPULAR
                </div>
                <div className="font-bold text-xs text-white">25 NM</div>
                <div className="text-[10px] text-slate-400">Island Cruise</div>
                <div className="text-[10px] font-mono text-sky-400 mt-1">~10 MB</div>
              </button>

              <button
                type="button"
                onClick={() => setRadiusNm(50)}
                disabled={downloadProgress?.status === 'downloading'}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                  radiusNm === 50
                    ? 'bg-sky-500/20 border-sky-500 text-sky-200 shadow'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-xs text-white">50 NM</div>
                <div className="text-[10px] text-slate-400">Coastal Sound</div>
                <div className="text-[10px] font-mono text-sky-400 mt-1">~18 MB</div>
              </button>
            </div>

            {/* Radius slider */}
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={radiusNm}
              disabled={downloadProgress?.status === 'downloading'}
              onChange={(e) => setRadiusNm(Number(e.target.value))}
              className="w-full accent-sky-500 cursor-pointer mt-1"
            />
          </div>

          {/* Included Layers Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/40 border border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-400 shrink-0" />
              <div>
                <div className="font-semibold text-slate-200">Include OpenSeaMap Seamarks</div>
                <div className="text-[11px] text-slate-400">
                  Saves navigational buoys, beacons, and lighthouses offline
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={includeSeamarks}
              disabled={downloadProgress?.status === 'downloading'}
              onChange={(e) => setIncludeSeamarks(e.target.checked)}
              className="w-4 h-4 accent-sky-500 rounded cursor-pointer"
            />
          </div>

          {/* Download Estimation Summary */}
          <div className="p-3 bg-sky-950/30 border border-sky-500/30 rounded-xl text-xs space-y-1">
            <div className="flex items-center justify-between text-slate-300">
              <span>Estimated Download:</span>
              <strong className="text-sky-300 font-mono">~{estimatedMb} MB</strong>
            </div>
            <div className="flex items-center justify-between text-slate-400 text-[11px]">
              <span>Coverage / Zoom Levels:</span>
              <span className="font-mono">Zooms 10 – 13 ({totalDownloadTiles} total tiles)</span>
            </div>
          </div>

          {/* Progress / Status Display */}
          {downloadProgress && (
            <div className="space-y-2 p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  {downloadProgress.status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : downloadProgress.status === 'downloading' ? (
                    <Radio className="w-4 h-4 text-sky-400 animate-pulse" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  )}
                  <span>
                    {downloadProgress.status === 'completed'
                      ? 'Download Complete'
                      : downloadProgress.status === 'downloading'
                      ? 'Downloading Offline Tiles'
                      : downloadProgress.status === 'cancelled'
                      ? 'Cancelled'
                      : 'Error'}
                  </span>
                </span>
                <span className="font-mono font-bold text-sky-400">
                  {downloadProgress.percent}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-200 ${
                    downloadProgress.status === 'completed'
                      ? 'bg-emerald-500'
                      : 'bg-sky-500'
                  }`}
                  style={{ width: `${downloadProgress.percent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>
                  {downloadProgress.completed} / {downloadProgress.total} tiles
                </span>
                {downloadProgress.failed > 0 && (
                  <span className="text-amber-400">{downloadProgress.failed} failed</span>
                )}
              </div>

              {downloadProgress.message && (
                <div className="text-[11px] text-slate-300">{downloadProgress.message}</div>
              )}
            </div>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="px-5 py-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={downloadProgress?.status === 'downloading'}
            className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white rounded-lg transition cursor-pointer disabled:opacity-40"
          >
            Close
          </button>

          {downloadProgress?.status === 'downloading' ? (
            <button
              type="button"
              onClick={handleCancelDownload}
              className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-4 py-2 rounded-lg transition shadow cursor-pointer"
            >
              <StopCircle className="w-4 h-4" />
              <span>Cancel Download</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartDownload}
              className="inline-flex items-center gap-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-xs px-4 py-2 rounded-lg transition shadow cursor-pointer"
            >
              <DownloadCloud className="w-4 h-4" />
              <span>Download {radiusNm} NM Pack (~{estimatedMb} MB)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

