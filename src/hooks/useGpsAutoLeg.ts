import { useState, useEffect, useRef, useCallback } from 'react';
import type { ActiveAutoLeg, GpsFix } from '../types';
import {
  haversineDistanceNm,
  haversineDistanceMeters,
  mpsToKnots,
  isGpsJitter,
} from '../utils/geo';

const STORAGE_KEY = 'captains_logger_active_autoleg_v1';
const MAX_BREADCRUMB_POINTS = 500;

export type GpsTrackingStatus =
  | 'idle'
  | 'tracking'
  | 'paused'
  | 'error'
  | 'permission-denied';

export interface CompletedLegSummary {
  departureTime: string;
  arrivalTime: string;
  distanceNm: number;
  departureCoordinates?: { lat: number; lon: number };
  arrivalCoordinates?: { lat: number; lon: number };
  maxSpeedKts?: number;
  avgSpeedKts?: number;
  elapsedSeconds: number;
}

export function useGpsAutoLeg() {
  const [activeLeg, setActiveLeg] = useState<ActiveAutoLeg | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved) as ActiveAutoLeg;
      }
    } catch (e) {
      console.warn('Failed to parse active autoleg from localStorage:', e);
    }
    return null;
  });

  const [currentFix, setCurrentFix] = useState<GpsFix | null>(null);
  const [trackingStatus, setTrackingStatus] = useState<GpsTrackingStatus>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as ActiveAutoLeg;
        return parsed.isPaused ? 'paused' : 'tracking';
      }
    } catch {
      // ignore
    }
    return 'idle';
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isWakeLockActive, setIsWakeLockActive] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const watchIdRef = useRef<number | null>(null);
  const wakeLockRef = useRef<any>(null);
  const activeLegRef = useRef<ActiveAutoLeg | null>(activeLeg);
  activeLegRef.current = activeLeg;

  // Persist active leg to localStorage
  const persistActiveLeg = useCallback((leg: ActiveAutoLeg | null) => {
    try {
      if (leg) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(leg));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Failed to save autoleg to localStorage:', e);
    }
  }, []);

  // Screen Wake Lock API management
  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator && (navigator as any).wakeLock) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        setIsWakeLockActive(true);
        wakeLockRef.current.addEventListener('release', () => {
          setIsWakeLockActive(false);
        });
      }
    } catch (err) {
      console.debug('Wake lock request failed or unsupported:', err);
      setIsWakeLockActive(false);
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      try {
        wakeLockRef.current.release();
      } catch {
        // ignore
      }
      wakeLockRef.current = null;
      setIsWakeLockActive(false);
    }
  }, []);

  // Re-acquire wake lock if tab becomes visible again while tracking
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'visible' &&
        activeLegRef.current &&
        !activeLegRef.current.isPaused
      ) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [requestWakeLock]);

  // Compute live elapsed time tick
  useEffect(() => {
    if (!activeLeg) {
      setElapsedSeconds(0);
      return;
    }

    const updateTimer = () => {
      if (!activeLegRef.current) return;
      const startMs = new Date(activeLegRef.current.startTime).getTime();
      const nowMs = Date.now();
      let totalPaused = activeLegRef.current.totalPausedMs || 0;

      if (activeLegRef.current.isPaused && activeLegRef.current.pausedAt) {
        const currentPauseDuration = nowMs - new Date(activeLegRef.current.pausedAt).getTime();
        totalPaused += currentPauseDuration;
      }

      const diffSec = Math.max(0, Math.floor((nowMs - startMs - totalPaused) / 1000));
      setElapsedSeconds(diffSec);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeLeg]);

  // Start watching GPS position
  const startWatchingPosition = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setTrackingStatus('error');
      setErrorMessage('Geolocation is not supported by your browser or device.');
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    requestWakeLock();

    const options: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 25000,
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed, heading, accuracy } = pos.coords;
        const nowMs = pos.timestamp || Date.now();
        const currentSpeedKts = mpsToKnots(speed);

        const newFix: GpsFix = {
          lat: latitude,
          lon: longitude,
          timestamp: nowMs,
          accuracyMeters: accuracy != null ? Number(accuracy.toFixed(1)) : undefined,
          speedKts: currentSpeedKts,
          headingDeg: heading != null && !isNaN(heading) ? Math.round(heading) : undefined,
        };

        setCurrentFix(newFix);
        setErrorMessage(null);

        // If leg is currently active and not paused, accumulate nautical distance
        const currentLeg = activeLegRef.current;
        if (!currentLeg || currentLeg.isPaused) {
          return;
        }

        const lastFix =
          currentLeg.fixes.length > 0
            ? currentLeg.fixes[currentLeg.fixes.length - 1]
            : null;

        let deltaNm = 0;
        let shouldRecordFix = false;

        if (!lastFix) {
          // First fix of the leg
          shouldRecordFix = true;
        } else {
          const isJitter = isGpsJitter(lastFix, latitude, longitude, accuracy);
          if (!isJitter) {
            deltaNm = haversineDistanceNm(
              lastFix.lat,
              lastFix.lon,
              latitude,
              longitude
            );

            // Record breadcrumb fix if boat moved at least 15 meters or 15 seconds passed
            const movedMeters = haversineDistanceMeters(
              lastFix.lat,
              lastFix.lon,
              latitude,
              longitude
            );
            const timeSinceLastFixSec = (nowMs - lastFix.timestamp) / 1000;

            if (movedMeters >= 15 || timeSinceLastFixSec >= 15) {
              shouldRecordFix = true;
            }
          }
        }

        const nextDistanceNm = Number((currentLeg.distanceNm + deltaNm).toFixed(2));
        const nextMaxSpeed = Math.max(currentLeg.maxSpeedKts || 0, currentSpeedKts);

        let nextFixes = currentLeg.fixes;
        if (shouldRecordFix) {
          nextFixes = [...currentLeg.fixes, newFix];
          if (nextFixes.length > MAX_BREADCRUMB_POINTS) {
            // Keep first fix (departure) and trim oldest middle fixes
            nextFixes = [
              nextFixes[0],
              ...nextFixes.slice(nextFixes.length - (MAX_BREADCRUMB_POINTS - 1)),
            ];
          }
        }

        const updatedLeg: ActiveAutoLeg = {
          ...currentLeg,
          distanceNm: nextDistanceNm,
          maxSpeedKts: nextMaxSpeed,
          fixes: nextFixes,
        };

        setActiveLeg(updatedLeg);
        persistActiveLeg(updatedLeg);
      },
      (err) => {
        console.warn('GPS AutoLeg watch error:', err);
        if (err.code === err.PERMISSION_DENIED) {
          setTrackingStatus('permission-denied');
          setErrorMessage('Location permission was denied. Please allow GPS access in your browser settings.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setErrorMessage('GPS position currently unavailable. Waiting for satellite fix...');
        } else {
          setErrorMessage(err.message || 'GPS location error.');
        }
      },
      options
    );
  }, [persistActiveLeg, requestWakeLock]);

  // Stop watching GPS position
  const stopWatchingPosition = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    releaseWakeLock();
  }, [releaseWakeLock]);

  // Resume tracking on mount if an unpaused active leg exists in storage
  useEffect(() => {
    if (activeLeg && !activeLeg.isPaused) {
      startWatchingPosition();
    }
    return () => {
      stopWatchingPosition();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // User Action: Start AutoLeg
  const startAutoLeg = useCallback(
    (tripId: string) => {
      const nowIso = new Date().toISOString();
      const initialLeg: ActiveAutoLeg = {
        tripId,
        startTime: nowIso,
        isPaused: false,
        totalPausedMs: 0,
        fixes: currentFix ? [currentFix] : [],
        distanceNm: 0,
        maxSpeedKts: currentFix?.speedKts || 0,
      };

      setActiveLeg(initialLeg);
      setTrackingStatus('tracking');
      setErrorMessage(null);
      persistActiveLeg(initialLeg);
      startWatchingPosition();
    },
    [currentFix, persistActiveLeg, startWatchingPosition]
  );

  // User Action: Pause AutoLeg
  const pauseAutoLeg = useCallback(() => {
    if (!activeLegRef.current) return;
    const nowIso = new Date().toISOString();
    const pausedLeg: ActiveAutoLeg = {
      ...activeLegRef.current,
      isPaused: true,
      pausedAt: nowIso,
    };

    setActiveLeg(pausedLeg);
    setTrackingStatus('paused');
    persistActiveLeg(pausedLeg);
    releaseWakeLock();
  }, [persistActiveLeg, releaseWakeLock]);

  // User Action: Resume AutoLeg
  const resumeAutoLeg = useCallback(() => {
    if (!activeLegRef.current) return;
    const current = activeLegRef.current;
    let addPauseMs = 0;
    if (current.pausedAt) {
      addPauseMs = Date.now() - new Date(current.pausedAt).getTime();
    }

    const resumedLeg: ActiveAutoLeg = {
      ...current,
      isPaused: false,
      pausedAt: undefined,
      totalPausedMs: (current.totalPausedMs || 0) + Math.max(0, addPauseMs),
    };

    setActiveLeg(resumedLeg);
    setTrackingStatus('tracking');
    persistActiveLeg(resumedLeg);
    startWatchingPosition();
  }, [persistActiveLeg, startWatchingPosition]);

  // User Action: Finish AutoLeg (calculates completed summary and cleans up)
  const finishAutoLeg = useCallback((): CompletedLegSummary | null => {
    const current = activeLegRef.current;
    if (!current) return null;

    stopWatchingPosition();

    const arrivalIso = new Date().toISOString();
    const startMs = new Date(current.startTime).getTime();
    const endMs = new Date(arrivalIso).getTime();
    const totalDurationHours = Math.max(
      0.01,
      (endMs - startMs - (current.totalPausedMs || 0)) / (1000 * 3600)
    );

    const firstFix = current.fixes.length > 0 ? current.fixes[0] : null;
    const lastFix =
      currentFix ||
      (current.fixes.length > 0 ? current.fixes[current.fixes.length - 1] : null);

    const avgSpeed = Number((current.distanceNm / totalDurationHours).toFixed(1));

    const summary: CompletedLegSummary = {
      departureTime: current.startTime.slice(0, 16), // YYYY-MM-DDTHH:mm format for HTML datetime-local
      arrivalTime: arrivalIso.slice(0, 16),
      distanceNm: current.distanceNm,
      departureCoordinates: firstFix ? { lat: firstFix.lat, lon: firstFix.lon } : undefined,
      arrivalCoordinates: lastFix ? { lat: lastFix.lat, lon: lastFix.lon } : undefined,
      maxSpeedKts: current.maxSpeedKts || undefined,
      avgSpeedKts: avgSpeed > 0 ? avgSpeed : undefined,
      elapsedSeconds,
    };

    setActiveLeg(null);
    setTrackingStatus('idle');
    persistActiveLeg(null);
    return summary;
  }, [currentFix, elapsedSeconds, persistActiveLeg, stopWatchingPosition]);

  // User Action: Cancel / Discard AutoLeg
  const cancelAutoLeg = useCallback(() => {
    stopWatchingPosition();
    setActiveLeg(null);
    setTrackingStatus('idle');
    setErrorMessage(null);
    persistActiveLeg(null);
  }, [persistActiveLeg, stopWatchingPosition]);

  // Computed averages & metrics
  const avgSpeedKts =
    elapsedSeconds > 30 && activeLeg && activeLeg.distanceNm > 0
      ? Number((activeLeg.distanceNm / (elapsedSeconds / 3600)).toFixed(1))
      : 0;

  return {
    activeLeg,
    currentFix,
    trackingStatus,
    errorMessage,
    isWakeLockActive,
    elapsedSeconds,
    avgSpeedKts,
    startAutoLeg,
    pauseAutoLeg,
    resumeAutoLeg,
    finishAutoLeg,
    cancelAutoLeg,
  };
}

