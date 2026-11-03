import { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation, Position } from '@capacitor/geolocation';
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

  const watchIdRef = useRef<string | number | null>(null);
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

  // Explicitly check or request GPS permissions (native Android dialog or browser query)
  const requestGpsPermission = useCallback(async (): Promise<boolean> => {
    try {
      if (Capacitor.isNativePlatform()) {
        const check = await Geolocation.checkPermissions();
        if (check.location === 'granted') {
          setTrackingStatus((prev) => (prev === 'permission-denied' ? 'idle' : prev));
          setErrorMessage(null);
          return true;
        }
        const req = await Geolocation.requestPermissions({ permissions: ['location', 'coarseLocation'] });
        if (req.location === 'granted') {
          setTrackingStatus((prev) => (prev === 'permission-denied' ? 'idle' : prev));
          setErrorMessage(null);
          return true;
        } else {
          setTrackingStatus('permission-denied');
          setErrorMessage(
            "Location permission was denied. Please allow Location in Android Settings > Apps > Captain's Logger > Permissions."
          );
          return false;
        }
      } else if ('geolocation' in navigator) {
        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => {
              setTrackingStatus((prev) => (prev === 'permission-denied' ? 'idle' : prev));
              setErrorMessage(null);
              resolve(true);
            },
            (err) => {
              if (err.code === err.PERMISSION_DENIED) {
                setTrackingStatus('permission-denied');
                setErrorMessage('Location permission was denied in your browser settings.');
              } else {
                setErrorMessage(err.message || 'GPS location error.');
              }
              resolve(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
          );
        });
      }
      return true;
    } catch (err: any) {
      console.warn('GPS permission error:', err);
      setErrorMessage(err?.message || 'Error requesting GPS permissions.');
      return false;
    }
  }, []);

  // Stop watching GPS position
  const stopWatchingPosition = useCallback(async () => {
    if (watchIdRef.current !== null) {
      try {
        if (typeof watchIdRef.current === 'string') {
          await Geolocation.clearWatch({ id: watchIdRef.current });
        } else if ('geolocation' in navigator) {
          navigator.geolocation.clearWatch(watchIdRef.current);
        }
      } catch (e) {
        console.warn('Failed to clear Geolocation watch:', e);
      }
      watchIdRef.current = null;
    }
    releaseWakeLock();
  }, [releaseWakeLock]);

  // Start watching GPS position
  const startWatchingPosition = useCallback(async () => {
    // 1. Ensure permissions are granted on native Android
    if (Capacitor.isNativePlatform()) {
      try {
        const check = await Geolocation.checkPermissions();
        if (check.location !== 'granted') {
          const req = await Geolocation.requestPermissions({ permissions: ['location', 'coarseLocation'] });
          if (req.location !== 'granted') {
            setTrackingStatus('permission-denied');
            setErrorMessage(
              "Location permission was denied. Please allow Location in Android Settings > Apps > Captain's Logger > Permissions."
            );
            return;
          }
        }
      } catch (permErr) {
        console.warn('Native permission check failed:', permErr);
      }
    } else if (!('geolocation' in navigator)) {
      setTrackingStatus('error');
      setErrorMessage('Geolocation is not supported by your browser or device.');
      return;
    }

    if (watchIdRef.current !== null) {
      await stopWatchingPosition();
    }

    requestWakeLock();

    try {
      const id = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          maximumAge: 1000,
          timeout: 25000,
        },
        (pos: Position | null, err: any) => {
          if (err) {
            console.warn('GPS AutoLeg watch error:', err);
            const msg = (err?.message || '').toLowerCase();
            if (msg.includes('denied') || err?.code === 1) {
              setTrackingStatus('permission-denied');
              setErrorMessage(
                "Location permission was denied. Please allow Location in Android Settings > Apps > Captain's Logger > Permissions."
              );
            } else if (msg.includes('unavailable') || err?.code === 2) {
              setErrorMessage('GPS position currently unavailable. Waiting for satellite fix...');
            } else {
              setErrorMessage(err?.message || 'GPS location error.');
            }
            return;
          }

          if (!pos || !pos.coords) return;
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
          setTrackingStatus((prev) => (prev === 'permission-denied' || prev === 'error' ? 'tracking' : prev));

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
        }
      );
      watchIdRef.current = id;
    } catch (watchErr: any) {
      console.warn('Geolocation.watchPosition failed:', watchErr);
      const msg = (watchErr?.message || '').toLowerCase();
      if (msg.includes('denied')) {
        setTrackingStatus('permission-denied');
        setErrorMessage(
          "Location permission was denied. Please allow Location in Android Settings > Apps > Captain's Logger > Permissions."
        );
      } else {
        setErrorMessage(watchErr?.message || 'Failed to start GPS tracking.');
      }
    }
  }, [persistActiveLeg, requestWakeLock, stopWatchingPosition]);

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
    async (tripId: string) => {
      if (Capacitor.isNativePlatform()) {
        const granted = await requestGpsPermission();
        if (!granted) return;
      }

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
    [currentFix, persistActiveLeg, requestGpsPermission, startWatchingPosition]
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
    requestGpsPermission,
    startAutoLeg,
    pauseAutoLeg,
    resumeAutoLeg,
    finishAutoLeg,
    cancelAutoLeg,
  };
}
