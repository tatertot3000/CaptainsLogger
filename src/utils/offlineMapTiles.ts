import L from 'leaflet';

export const OFFLINE_TILE_CACHE_NAME = 'captains_logger_offline_tiles_v1';

export interface TileCoordinate {
  x: number;
  y: number;
  z: number;
}

export interface TilePackCalculation {
  tiles: TileCoordinate[];
  totalTiles: number;
  estimatedBytes: number;
  formattedEstimatedSize: string;
}

export interface DownloadProgress {
  total: number;
  completed: number;
  percent: number;
  failed: number;
  status: 'idle' | 'downloading' | 'completed' | 'cancelled' | 'error';
  currentZoom?: number;
  message?: string;
}

export interface DownloadPackOptions {
  centerLat: number;
  centerLon: number;
  radiusNm: number;
  minZoom?: number;
  maxZoom?: number;
  includeSeamarks?: boolean;
  onProgress?: (progress: DownloadProgress) => void;
  abortSignal?: AbortSignal;
}

export function lonToTileX(lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

export function latToTileY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom)
  );
}

/**
 * Calculates all tile coordinates covering a circle of radiusNm around a center point
 */
export function calculateTilePack(
  centerLat: number,
  centerLon: number,
  radiusNm: number,
  minZoom = 10,
  maxZoom = 13
): TilePackCalculation {
  const deltaLat = radiusNm / 60;
  const deltaLon = radiusNm / (60 * Math.max(0.1, Math.cos((centerLat * Math.PI) / 180)));

  const minLat = Math.max(-85, centerLat - deltaLat);
  const maxLat = Math.min(85, centerLat + deltaLat);
  const minLon = Math.max(-180, centerLon - deltaLon);
  const maxLon = Math.min(180, centerLon + deltaLon);

  const tiles: TileCoordinate[] = [];

  for (let z = minZoom; z <= maxZoom; z++) {
    const x1 = Math.min(lonToTileX(minLon, z), lonToTileX(maxLon, z));
    const x2 = Math.max(lonToTileX(minLon, z), lonToTileX(maxLon, z));
    const y1 = Math.min(latToTileY(maxLat, z), latToTileY(minLat, z));
    const y2 = Math.max(latToTileY(maxLat, z), latToTileY(minLat, z));

    for (let x = x1; x <= x2; x++) {
      for (let y = y1; y <= y2; y++) {
        tiles.push({ x, y, z });
      }
    }
  }

  // Average compressed tile is ~20 KB
  const estimatedBytes = tiles.length * 20 * 1024;
  const mb = estimatedBytes / (1024 * 1024);
  const formattedEstimatedSize = mb >= 1000 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;

  return {
    tiles,
    totalTiles: tiles.length,
    estimatedBytes,
    formattedEstimatedSize,
  };
}

/**
 * Formats byte counts into human-readable strings
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Returns cache storage stats (total tiles cached and total approximate size)
 */
export async function getOfflineCacheStats(): Promise<{
  totalTiles: number;
  sizeBytes: number;
  formattedSize: string;
}> {
  if (typeof caches === 'undefined') {
    return { totalTiles: 0, sizeBytes: 0, formattedSize: '0 MB' };
  }

  try {
    const cache = await caches.open(OFFLINE_TILE_CACHE_NAME);
    const keys = await cache.keys();
    let totalBytes = 0;

    // Approximate size by sampling or key count
    // Reading all response blobs can be slow with thousands of tiles, so sample average tile size
    const totalTiles = keys.length;
    const sampleCount = Math.min(20, totalTiles);
    if (sampleCount > 0) {
      let sampleBytes = 0;
      for (let i = 0; i < sampleCount; i++) {
        const resp = await cache.match(keys[i]);
        if (resp) {
          const blob = await resp.blob();
          sampleBytes += blob.size;
        }
      }
      const avgTileBytes = sampleBytes / sampleCount;
      totalBytes = Math.round(avgTileBytes * totalTiles);
    }

    return {
      totalTiles,
      sizeBytes: totalBytes,
      formattedSize: formatBytes(totalBytes),
    };
  } catch (err) {
    console.warn('Failed to inspect offline tile cache:', err);
    return { totalTiles: 0, sizeBytes: 0, formattedSize: '0 MB' };
  }
}

/**
 * Clears the offline tile cache
 */
export async function clearOfflineTileCache(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    await caches.delete(OFFLINE_TILE_CACHE_NAME);
  } catch (err) {
    console.warn('Failed to clear tile cache:', err);
  }
}

/**
 * Downloads a batch of tiles for offline use with progress callback
 */
export async function downloadTilePack(options: DownloadPackOptions): Promise<{
  downloaded: number;
  failed: number;
  total: number;
}> {
  const {
    centerLat,
    centerLon,
    radiusNm,
    minZoom = 10,
    maxZoom = 13,
    includeSeamarks = true,
    onProgress,
    abortSignal,
  } = options;

  if (typeof caches === 'undefined') {
    throw new Error('CacheStorage is not supported by your browser or environment.');
  }

  const { tiles } = calculateTilePack(centerLat, centerLon, radiusNm, minZoom, maxZoom);
  const cache = await caches.open(OFFLINE_TILE_CACHE_NAME);

  const urlsToDownload: string[] = [];
  tiles.forEach((t) => {
    // OpenStreetMap base tile
    urlsToDownload.push(`https://tile.openstreetmap.org/${t.z}/${t.x}/${t.y}.png`);
    // OpenSeaMap nautical seamarks tile
    if (includeSeamarks) {
      urlsToDownload.push(`https://tiles.openseamap.org/seamark/${t.z}/${t.x}/${t.y}.png`);
    }
  });

  const total = urlsToDownload.length;
  let completed = 0;
  let failed = 0;

  const updateProgress = (status: DownloadProgress['status'], message?: string) => {
    if (onProgress) {
      onProgress({
        total,
        completed,
        percent: total > 0 ? Math.round((completed / total) * 100) : 100,
        failed,
        status,
        message,
      });
    }
  };

  updateProgress('downloading', 'Starting offline download...');

  // Concurrency pool with polite delay to respect tile server fair use
  const CONCURRENCY = 4;
  let currentIndex = 0;

  const worker = async () => {
    while (currentIndex < urlsToDownload.length) {
      if (abortSignal?.aborted) {
        throw new Error('Download cancelled by user.');
      }

      const url = urlsToDownload[currentIndex++];

      try {
        // Skip if already in cache
        const existing = await cache.match(url);
        if (!existing) {
          const res = await fetch(url, {
            mode: 'cors',
            signal: abortSignal,
          });

          if (res.ok) {
            await cache.put(url, res.clone());
          } else {
            failed++;
          }
        }
      } catch (err: any) {
        if (abortSignal?.aborted) throw err;
        failed++;
      } finally {
        completed++;
        if (completed % 5 === 0 || completed === total) {
          updateProgress('downloading', `Downloading offline tiles (${completed}/${total})...`);
        }
      }

      // Small polite delay between requests
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  };

  try {
    const workers = Array.from({ length: Math.min(CONCURRENCY, urlsToDownload.length) }, () =>
      worker()
    );
    await Promise.all(workers);
    updateProgress('completed', `Download complete! ${completed - failed} tiles saved for offline use.`);
  } catch (err: any) {
    if (abortSignal?.aborted) {
      updateProgress('cancelled', 'Download cancelled.');
    } else {
      updateProgress('error', err?.message || 'Download failed.');
      throw err;
    }
  }

  return { downloaded: completed - failed, failed, total };
}

/**
 * Custom Leaflet Offline TileLayer that checks CacheStorage first
 */
export function createOfflineTileLayer(
  urlTemplate: string,
  options: L.TileLayerOptions = {}
): L.TileLayer {
  const OfflineLayer = (L.TileLayer as any).extend({
    createTile(coords: L.Coords, done: (error: any, tile: HTMLImageElement) => void) {
      const tile = document.createElement('img');
      tile.setAttribute('role', 'presentation');

      const url = (this as any).getTileUrl(coords);

      if (typeof caches !== 'undefined') {
        caches
          .open(OFFLINE_TILE_CACHE_NAME)
          .then((cache) => {
            return cache.match(url).then((response) => {
              if (response) {
                return response.blob().then((blob) => {
                  const objectUrl = URL.createObjectURL(blob);
                  tile.onload = () => {
                    URL.revokeObjectURL(objectUrl);
                    done(null, tile);
                  };
                  tile.onerror = (err) => {
                    URL.revokeObjectURL(objectUrl);
                    done(err, tile);
                  };
                  tile.src = objectUrl;
                });
              } else {
                // Not in cache: fetch from network and opportunistically save to cache
                (this as any)._loadFromNetwork(tile, url, cache, done);
              }
            });
          })
          .catch(() => {
            (this as any)._loadFromNetwork(tile, url, null, done);
          });
      } else {
        tile.onload = () => done(null, tile);
        tile.onerror = (err) => done(err, tile);
        tile.src = url;
      }

      return tile;
    },

    _loadFromNetwork(
      tile: HTMLImageElement,
      url: string,
      cache: Cache | null,
      done: (error: any, tile: HTMLImageElement) => void
    ) {
      tile.onload = () => {
        // Opportunistic passive caching: save tile when user browses while online
        if (cache && typeof fetch !== 'undefined') {
          fetch(url, { mode: 'cors' })
            .then((res) => {
              if (res.ok) cache.put(url, res);
            })
            .catch(() => {
              // Ignore network caching errors
            });
        }
        done(null, tile);
      };

      tile.onerror = () => {
        // Hide broken image outline when offline and tile not yet cached
        tile.style.visibility = 'hidden';
        done(null, tile);
      };

      tile.src = url;
    },
  });

  return new OfflineLayer(urlTemplate, options);
}

