/**
 * Marine Geolocation & Navigation Utilities for Captain's Logger
 * Handles Haversine distance calculations in Nautical Miles (NM),
 * Speed Over Ground (SOG in knots), Course Over Ground (COG compass rose),
 * and standard marine coordinate formatting (Degrees & Decimal Minutes).
 */

import type { GpsPollingProfile, GpsProfileConfig } from '../types';

export const METERS_PER_NAUTICAL_MILE = 1852;
export const MPS_TO_KNOTS = 1.94384449;
export const EARTH_RADIUS_METERS = 6371000;

/**
 * Calculates Great-Circle distance between two coordinates in meters
 * using the Haversine formula.
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(rLat1) * Math.cos(rLat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculates Great-Circle distance between two coordinates in Nautical Miles (NM).
 */
export function haversineDistanceNm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const meters = haversineDistanceMeters(lat1, lon1, lat2, lon2);
  return Number((meters / METERS_PER_NAUTICAL_MILE).toFixed(2));
}

export function metersToFeet(meters: number): number {
  return Math.round(meters * 3.28084);
}

export function feetToMeters(feet: number): number {
  return Number((feet / 3.28084).toFixed(1));
}

/**
 * Calculates initial true bearing in degrees (0-360) from point 1 to point 2.
 */
export function calculateBearingDegrees(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));

  const bearing = toDeg(Math.atan2(y, x));
  return Math.round((bearing + 360) % 360);
}

/**
 * Converts meters per second (browser GPS API output) to Nautical Knots.
 */
export function mpsToKnots(mps: number | null | undefined): number {
  if (mps == null || isNaN(mps) || mps < 0) return 0;
  return Number((mps * MPS_TO_KNOTS).toFixed(1));
}

/**
 * Formats a decimal latitude and longitude into standard marine notation:
 * Degrees and Decimal Minutes (DD° MM.mm' N/S, DDD° MM.mm' E/W).
 * E.g., 37.8044, -122.4072 -> "37°48.26' N, 122°24.43' W"
 */
export function toMarineCoordinates(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const absLat = Math.abs(lat);
  const latDeg = Math.floor(absLat);
  const latMin = ((absLat - latDeg) * 60).toFixed(2).padStart(5, '0');

  const lonDir = lon >= 0 ? 'E' : 'W';
  const absLon = Math.abs(lon);
  const lonDeg = Math.floor(absLon);
  const lonMin = ((absLon - lonDeg) * 60).toFixed(2).padStart(5, '0');

  return `${latDeg}°${latMin}' ${latDir}, ${lonDeg}°${lonMin}' ${lonDir}`;
}

const COMPASS_POINTS_16 = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
] as const;

/**
 * Converts a true heading (0-360 degrees) to a 16-point nautical compass point.
 * E.g., 245 -> "WSW"
 */
export function degreesToCompass(degrees: number | null | undefined): string {
  if (degrees == null || isNaN(degrees)) return '---';
  const normalized = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalized / 22.5) % 16;
  return COMPASS_POINTS_16[index];
}

/**
 * Converts a true heading to a compass point with degrees label.
 * E.g., 245 -> "WSW (245°)"
 */
export function degreesToCompassWithDegrees(degrees: number | null | undefined): string {
  if (degrees == null || isNaN(degrees)) return '---';
  const rounded = Math.round(((degrees % 360) + 360) % 360);
  return `${degreesToCompass(rounded)} (${rounded}°)`;
}

/**
 * Evaluates whether a new GPS fix should be considered stationary jitter / drift
 * rather than real boat travel.
 *
 * Prevents stationary drift at the slip or anchorage from falsely accumulating miles.
 * If distance is < 6 meters and reported speed is < 0.4 knots, it is classified as jitter.
 */
export function isGpsJitter(
  prevFix: { lat: number; lon: number; speedKts?: number },
  nextLat: number,
  nextLon: number,
  accuracyMeters?: number
): boolean {
  const distMeters = haversineDistanceMeters(prevFix.lat, prevFix.lon, nextLat, nextLon);

  // If GPS accuracy radius is exceptionally poor (> 70 meters), only treat as jitter if stationary/drift
  if (accuracyMeters && accuracyMeters > 70 && distMeters < 30) {
    return true;
  }

  // Tiny position shift (< 6 meters) while stationary/drifting
  if (distMeters < 6 && (prevFix.speedKts == null || prevFix.speedKts < 0.4)) {
    return true;
  }

  return false;
}

/**
 * Formats elapsed seconds into HH:MM:SS or Hh Mm string
 */
export function formatElapsedDuration(totalSeconds: number): string {
  const safeSec = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(safeSec / 3600);
  const mins = Math.floor((safeSec % 3600) / 60);
  const secs = safeSec % 60;

  const pad = (n: number) => String(n).padStart(2, '0');
  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

export const GPS_POLLING_PROFILES: Record<GpsPollingProfile, GpsProfileConfig> = {
  high: {
    id: 'high',
    label: 'Real-Time (1s)',
    intervalSeconds: 1,
    distanceFilterMeters: 0,
    batteryHint: 'High Battery',
    description: 'Continuous satellite stream for tight channels, docking, & racing',
  },
  balanced: {
    id: 'balanced',
    label: 'Balanced (5s)',
    intervalSeconds: 5,
    distanceFilterMeters: 10,
    batteryHint: 'Moderate Battery',
    description: 'Smooth tracking with moderate battery savings for day sailing',
  },
  cruising: {
    id: 'cruising',
    label: 'Cruising (15s)',
    intervalSeconds: 15,
    distanceFilterMeters: 25,
    batteryHint: 'Recommended / Low Battery',
    description: 'Standard coastal cruising and motoring with low battery consumption',
  },
  offshore: {
    id: 'offshore',
    label: 'Offshore (30s)',
    intervalSeconds: 30,
    distanceFilterMeters: 50,
    batteryHint: 'Very Low Battery',
    description: 'Preserves phone battery on long offshore legs and anchor watches',
  },
  ocean: {
    id: 'ocean',
    label: 'Ocean (60s)',
    intervalSeconds: 60,
    distanceFilterMeters: 100,
    batteryHint: 'Minimal Battery',
    description: 'Multi-day ocean passages running on battery power',
  },
};

export function getGpsProfileConfig(profile?: GpsPollingProfile | null): GpsProfileConfig {
  if (profile && GPS_POLLING_PROFILES[profile]) {
    return GPS_POLLING_PROFILES[profile];
  }
  return GPS_POLLING_PROFILES.cruising;
}
