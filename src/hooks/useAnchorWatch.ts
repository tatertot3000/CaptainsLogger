import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { AnchorWatchState, GpsFix } from '../types';
import {
  haversineDistanceMeters,
  metersToFeet,
  calculateBearingDegrees,
  degreesToCompassWithDegrees,
} from '../utils/geo';
import { marineAlarm } from '../utils/audioAlarm';

const ANCHOR_STORAGE_KEY = 'captains_logger_anchor_watch_v1';
const SWING_HISTORY_KEY = 'captains_logger_anchor_swing_history_v1';
const MAX_SWING_POINTS = 300;

function loadStoredAnchorWatch(): AnchorWatchState | null {
  try {
    const raw = localStorage.getItem(ANCHOR_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function loadStoredSwingHistory(): GpsFix[] {
  try {
    const raw = localStorage.getItem(SWING_HISTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function useAnchorWatch(currentFix: GpsFix | null) {
  const [anchorWatch, setAnchorWatch] = useState<AnchorWatchState | null>(() =>
    loadStoredAnchorWatch()
  );
  const [isAlarmSilenced, setIsAlarmSilenced] = useState(false);
  const [swingHistory, setSwingHistory] = useState<GpsFix[]>(() =>
    loadStoredSwingHistory()
  );

  const anchorRef = useRef<AnchorWatchState | null>(anchorWatch);
  anchorRef.current = anchorWatch;

  // Persist anchor watch state
  const persistAnchorState = useCallback((state: AnchorWatchState | null) => {
    try {
      if (state) {
        localStorage.setItem(ANCHOR_STORAGE_KEY, JSON.stringify(state));
      } else {
        localStorage.removeItem(ANCHOR_STORAGE_KEY);
      }
    } catch {}
  }, []);

  // Persist swing history
  const persistSwingHistory = useCallback((history: GpsFix[]) => {
    try {
      localStorage.setItem(SWING_HISTORY_KEY, JSON.stringify(history));
    } catch {}
  }, []);

  // Real-time distance and bearing calculations
  const {
    distanceFromAnchorMeters,
    distanceFromAnchorFeet,
    swingRadiusFeet,
    bearingToAnchorDeg,
    bearingCompass,
    isBreached,
    radiusPercentage,
  } = useMemo(() => {
    if (!anchorWatch || !anchorWatch.isArmed || !currentFix) {
      return {
        distanceFromAnchorMeters: null,
        distanceFromAnchorFeet: null,
        swingRadiusFeet: anchorWatch ? metersToFeet(anchorWatch.swingRadiusMeters) : 100,
        bearingToAnchorDeg: null,
        bearingCompass: '---',
        isBreached: false,
        radiusPercentage: 0,
      };
    }

    const distMeters = haversineDistanceMeters(
      currentFix.lat,
      currentFix.lon,
      anchorWatch.anchorCoordinates.lat,
      anchorWatch.anchorCoordinates.lon
    );
    const distFeet = metersToFeet(distMeters);
    const radFeet = metersToFeet(anchorWatch.swingRadiusMeters);
    const bearing = calculateBearingDegrees(
      currentFix.lat,
      currentFix.lon,
      anchorWatch.anchorCoordinates.lat,
      anchorWatch.anchorCoordinates.lon
    );
    const compass = degreesToCompassWithDegrees(bearing);
    const breached = distMeters > anchorWatch.swingRadiusMeters;
    const pct = Math.min(
      200,
      Math.round((distMeters / anchorWatch.swingRadiusMeters) * 100)
    );

    return {
      distanceFromAnchorMeters: Number(distMeters.toFixed(1)),
      distanceFromAnchorFeet: distFeet,
      swingRadiusFeet: radFeet,
      bearingToAnchorDeg: bearing,
      bearingCompass: compass,
      isBreached: breached,
      radiusPercentage: pct,
    };
  }, [anchorWatch, currentFix]);

  // Record swing breadcrumb fixes periodically while armed
  useEffect(() => {
    if (!anchorWatch || !anchorWatch.isArmed || !currentFix) return;

    setSwingHistory((prev) => {
      const last = prev.length > 0 ? prev[prev.length - 1] : null;
      if (last) {
        const moved = haversineDistanceMeters(last.lat, last.lon, currentFix.lat, currentFix.lon);
        const timeDiffSec = (currentFix.timestamp - last.timestamp) / 1000;
        if (moved < 5 && timeDiffSec < 30) {
          return prev; // Ignore stationary jitter
        }
      }

      const next = [...prev, currentFix];
      const trimmed = next.length > MAX_SWING_POINTS ? next.slice(next.length - MAX_SWING_POINTS) : next;
      persistSwingHistory(trimmed);
      return trimmed;
    });
  }, [anchorWatch, currentFix, persistSwingHistory]);

  // Audio Siren Management
  useEffect(() => {
    if (isBreached && !isAlarmSilenced) {
      marineAlarm.startAlarm();
    } else {
      marineAlarm.stopAlarm();
    }
  }, [isBreached, isAlarmSilenced]);

  // Stop alarm on unmount
  useEffect(() => {
    return () => {
      marineAlarm.stopAlarm();
    };
  }, []);

  // Action: Arm Anchor Watch
  const armAnchorWatch = useCallback(
    (
      coords: { lat: number; lon: number },
      radiusMeters: number,
      depthFeet?: number,
      freeboardFeet?: number,
      rodeLengthFeet?: number,
      notes?: string
    ) => {
      const newState: AnchorWatchState = {
        isArmed: true,
        anchorCoordinates: coords,
        dropTime: new Date().toISOString(),
        swingRadiusMeters: radiusMeters,
        depthFeet,
        freeboardFeet,
        rodeLengthFeet,
        notes,
      };
      setAnchorWatch(newState);
      setIsAlarmSilenced(false);
      setSwingHistory(currentFix ? [currentFix] : []);
      persistAnchorState(newState);
      persistSwingHistory(currentFix ? [currentFix] : []);
    },
    [currentFix, persistAnchorState, persistSwingHistory]
  );

  // Action: Disarm Anchor Watch
  const disarmAnchorWatch = useCallback(() => {
    marineAlarm.stopAlarm();
    setAnchorWatch((prev) => (prev ? { ...prev, isArmed: false } : null));
    setIsAlarmSilenced(false);
    persistAnchorState(null);
  }, [persistAnchorState]);

  // Action: Update Swing Radius on an existing watch
  const updateSwingRadius = useCallback(
    (radiusMeters: number) => {
      setAnchorWatch((prev) => {
        if (!prev) return null;
        const updated = { ...prev, swingRadiusMeters: radiusMeters };
        persistAnchorState(updated);
        return updated;
      });
    },
    [persistAnchorState]
  );

  // Action: Silence / Snooze active siren
  const silenceAlarm = useCallback(() => {
    marineAlarm.stopAlarm();
    setIsAlarmSilenced(true);
  }, []);

  // Action: Resume siren monitoring
  const resumeAlarm = useCallback(() => {
    setIsAlarmSilenced(false);
  }, []);

  return {
    anchorWatch,
    isArmed: Boolean(anchorWatch?.isArmed),
    distanceFromAnchorMeters,
    distanceFromAnchorFeet,
    swingRadiusFeet,
    bearingToAnchorDeg,
    bearingCompass,
    isBreached,
    radiusPercentage,
    isAlarmSilenced,
    swingHistory,
    armAnchorWatch,
    disarmAnchorWatch,
    updateSwingRadius,
    silenceAlarm,
    resumeAlarm,
  };
}

