import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Compass,
  X,
  Maximize2,
  Minimize2,
  Radio,
  Eye,
  EyeOff,
  DownloadCloud,
  AlertTriangle,
  Crosshair,
} from 'lucide-react';
import type { GpsFix } from '../types';
import { toMarineCoordinates } from '../utils/geo';
import { createOfflineTileLayer } from '../utils/offlineMapTiles';
import { OfflineChartManagerModal } from './OfflineChartManagerModal';

export interface MapLegData {
  id: string;
  title?: string;
  legNumber?: number;
  departurePort: string;
  arrivalPort: string;
  departureCoordinates?: { lat: number; lon: number };
  arrivalCoordinates?: { lat: number; lon: number };
  trackPoints?: GpsFix[];
  distanceNm?: number;
  avgSpeedKts?: number;
  maxSpeedKts?: number;
  departureTime?: string;
  arrivalTime?: string;
}

export interface LegTrackMapProps {
  legs: MapLegData[];
  activeVesselFix?: GpsFix | null;
  liveTrackPoints?: GpsFix[];
  title?: string;
  subtitle?: string;
  onClose?: () => void;
  isModal?: boolean;
  className?: string;
  anchorWatch?: {
    anchorCoordinates: { lat: number; lon: number };
    swingRadiusMeters: number;
    isArmed?: boolean;
    isBreached?: boolean;
    swingHistory?: GpsFix[];
  } | null;
}

type MapLayerType = 'dark' | 'osm' | 'satellite';

const LEG_COLORS = [
  '#06b6d4', // cyan-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#3b82f6', // blue-500
];

export const LegTrackMap: React.FC<LegTrackMapProps> = ({
  legs,
  activeVesselFix,
  liveTrackPoints,
  title,
  subtitle,
  onClose,
  isModal = false,
  className = '',
  anchorWatch,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const baseLayerRef = useRef<L.TileLayer | null>(null);
  const seaMapLayerRef = useRef<L.TileLayer | null>(null);
  const vectorsLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const liveLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const hasInitialFitRef = useRef<boolean>(false);

  const [activeLayer, setActiveLayer] = useState<MapLayerType>('osm');
  const [showSeaMarks, setShowSeaMarks] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showOfflineModal, setShowOfflineModal] = useState(false);

  // Compute total passage metrics
  const totalStats = useMemo(() => {
    let totalNm = 0;
    let maxSpeed = 0;
    let pointsCount = 0;

    legs.forEach((leg) => {
      if (leg.distanceNm) totalNm += leg.distanceNm;
      if (leg.maxSpeedKts && leg.maxSpeedKts > maxSpeed) maxSpeed = leg.maxSpeedKts;
      if (leg.trackPoints) pointsCount += leg.trackPoints.length;
    });

    if (liveTrackPoints) {
      pointsCount += liveTrackPoints.length;
    }

    return {
      distanceNm: Number(totalNm.toFixed(2)),
      maxSpeedKts: Number(maxSpeed.toFixed(1)),
      totalPoints: pointsCount,
    };
  }, [legs, liveTrackPoints]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
        maxZoom: 18,
        minZoom: 3,
      });

      L.control
        .zoom({
          position: 'bottomright',
        })
        .addTo(map);

      // Attribution
      L.control
        .attribution({
          position: 'bottomleft',
          prefix: false,
        })
        .addAttribution('© OpenStreetMap, OpenSeaMap')
        .addTo(map);

      mapInstanceRef.current = map;
      vectorsLayerGroupRef.current = L.layerGroup().addTo(map);
      liveLayerGroupRef.current = L.layerGroup().addTo(map);
    }

    const map = mapInstanceRef.current;

    // Base Tile Layers
    if (baseLayerRef.current) {
      map.removeLayer(baseLayerRef.current);
    }

    let tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    let maxZoom = 19;
    let className = '';

    if (activeLayer === 'dark') {
      tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      className = 'map-tiles-dark';
    } else if (activeLayer === 'osm') {
      tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      className = '';
    } else if (activeLayer === 'satellite') {
      tileUrl =
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      maxZoom = 18;
      className = '';
    }

    const baseLayer = createOfflineTileLayer(tileUrl, {
      maxZoom,
      subdomains: 'abc',
      className,
    }).addTo(map);
    baseLayerRef.current = baseLayer;

    // OpenSeaMap Marine Seamarks Overlay
    if (seaMapLayerRef.current) {
      map.removeLayer(seaMapLayerRef.current);
      seaMapLayerRef.current = null;
    }

    if (showSeaMarks) {
      const seaMarks = createOfflineTileLayer(
        'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',
        {
          maxZoom: 18,
          opacity: 0.9,
        }
      ).addTo(map);
      seaMapLayerRef.current = seaMarks;
    }

    // Force map size refresh
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      // Don't destroy map here to avoid flash on state change
    };
  }, [activeLayer, showSeaMarks]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update vectors, tracks, and markers whenever legs or live fixes change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = vectorsLayerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    const bounds = L.latLngBounds([]);

    legs.forEach((leg, idx) => {
      const color = LEG_COLORS[idx % LEG_COLORS.length];
      const points: L.LatLngTuple[] = [];

      if (leg.trackPoints && leg.trackPoints.length > 0) {
        leg.trackPoints.forEach((pt) => {
          points.push([pt.lat, pt.lon]);
          bounds.extend([pt.lat, pt.lon]);
        });
      } else if (leg.departureCoordinates && leg.arrivalCoordinates) {
        // Direct route course line if only waypoints are logged
        points.push([leg.departureCoordinates.lat, leg.departureCoordinates.lon]);
        points.push([leg.arrivalCoordinates.lat, leg.arrivalCoordinates.lon]);
        bounds.extend([leg.departureCoordinates.lat, leg.departureCoordinates.lon]);
        bounds.extend([leg.arrivalCoordinates.lat, leg.arrivalCoordinates.lon]);
      }

      if (points.length >= 2) {
        // Draw track shadow/glow
        const glowLine = L.polyline(points, {
          color,
          weight: 7,
          opacity: 0.25,
          lineCap: 'round',
          lineJoin: 'round',
        });
        layerGroup.addLayer(glowLine);

        // Draw main route track
        const mainLine = L.polyline(points, {
          color,
          weight: 3.5,
          opacity: 0.95,
          dashArray: leg.trackPoints && leg.trackPoints.length > 0 ? undefined : '6, 8',
          lineCap: 'round',
          lineJoin: 'round',
        });

        mainLine.bindPopup(`
          <div style="font-family: sans-serif; min-width: 170px; color: #0f172a;">
            <div style="font-weight: bold; font-size: 13px; color: #0284c7; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin-bottom: 4px;">
              ${leg.title || `Leg #${leg.legNumber || idx + 1}`}
            </div>
            <div style="font-size: 11px; margin-bottom: 2px;">
              <strong>From:</strong> ${leg.departurePort}
            </div>
            <div style="font-size: 11px; margin-bottom: 4px;">
              <strong>To:</strong> ${leg.arrivalPort}
            </div>
            <div style="font-size: 11px; color: #475569;">
              ${leg.distanceNm ? `<strong>Distance:</strong> ${leg.distanceNm} NM<br/>` : ''}
              ${leg.avgSpeedKts ? `<strong>Avg Speed:</strong> ${leg.avgSpeedKts} kts<br/>` : ''}
              ${leg.maxSpeedKts ? `<strong>Max Speed:</strong> ${leg.maxSpeedKts} kts` : ''}
            </div>
          </div>
        `);
        layerGroup.addLayer(mainLine);
      }

      // Add departure waypoint marker
      const depCoord = leg.departureCoordinates || (leg.trackPoints && leg.trackPoints[0]);
      if (depCoord) {
        const depIcon = L.divIcon({
          className: 'custom-map-marker',
          html: `
            <div style="
              display: flex;
              align-items: center;
              justify-content: center;
              width: 28px;
              height: 28px;
              background: #064e3b;
              border: 2px solid #34d399;
              border-radius: 50%;
              box-shadow: 0 0 10px rgba(52, 211, 153, 0.5);
              color: white;
            ">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="5" r="3"></circle>
                <line x1="12" y1="22" x2="12" y2="8"></line>
                <path d="M5 12H2a10 10 0 0 0 20 0h-3"></path>
              </svg>
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const depMarker = L.marker([depCoord.lat, depCoord.lon], { icon: depIcon });
        depMarker.bindPopup(`
          <div style="font-family: sans-serif; color: #0f172a;">
            <div style="font-weight: bold; color: #059669; font-size: 12px;">⚓ Departure</div>
            <div style="font-size: 13px; font-weight: bold;">${leg.departurePort}</div>
            <div style="font-size: 11px; color: #64748b; font-family: monospace; margin-top: 2px;">
              ${toMarineCoordinates(depCoord.lat, depCoord.lon)}
            </div>
            ${leg.departureTime ? `<div style="font-size: 11px; color: #475569; margin-top: 2px;">Departure: ${leg.departureTime.replace('T', ' ')}</div>` : ''}
          </div>
        `);
        layerGroup.addLayer(depMarker);
      }

      // Add arrival waypoint marker
      const arrCoord =
        leg.arrivalCoordinates ||
        (leg.trackPoints && leg.trackPoints.length > 0
          ? leg.trackPoints[leg.trackPoints.length - 1]
          : undefined);
      if (arrCoord) {
        const arrIcon = L.divIcon({
          className: 'custom-map-marker',
          html: `
            <div style="
              display: flex;
              align-items: center;
              justify-content: center;
              width: 28px;
              height: 28px;
              background: #881337;
              border: 2px solid #fb7185;
              border-radius: 50%;
              box-shadow: 0 0 10px rgba(251, 113, 133, 0.5);
              color: white;
            ">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                <line x1="4" y1="22" x2="4" y2="15"></line>
              </svg>
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const arrMarker = L.marker([arrCoord.lat, arrCoord.lon], { icon: arrIcon });
        arrMarker.bindPopup(`
          <div style="font-family: sans-serif; color: #0f172a;">
            <div style="font-weight: bold; color: #e11d48; font-size: 12px;">🏁 Arrival Port</div>
            <div style="font-size: 13px; font-weight: bold;">${leg.arrivalPort}</div>
            <div style="font-size: 11px; color: #64748b; font-family: monospace; margin-top: 2px;">
              ${toMarineCoordinates(arrCoord.lat, arrCoord.lon)}
            </div>
            ${leg.arrivalTime ? `<div style="font-size: 11px; color: #475569; margin-top: 2px;">Arrival: ${leg.arrivalTime.replace('T', ' ')}</div>` : ''}
          </div>
        `);
        layerGroup.addLayer(arrMarker);
      }
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [30, 30],
        maxZoom: 14,
      });
      hasInitialFitRef.current = true;
    }
  }, [legs]);

  // Update live vessel marker and live breadcrumb track without resetting static legs or camera zoom
  useEffect(() => {
    const map = mapInstanceRef.current;
    const liveGroup = liveLayerGroupRef.current;
    if (!map || !liveGroup) return;

    liveGroup.clearLayers();
    const bounds = L.latLngBounds([]);

    // Render live track points if underway
    if (liveTrackPoints && liveTrackPoints.length >= 2) {
      const livePoints: L.LatLngTuple[] = liveTrackPoints.map((pt) => [pt.lat, pt.lon]);
      liveTrackPoints.forEach((pt) => bounds.extend([pt.lat, pt.lon]));

      const liveGlow = L.polyline(livePoints, {
        color: '#38bdf8',
        weight: 8,
        opacity: 0.35,
        lineCap: 'round',
      });
      const liveLine = L.polyline(livePoints, {
        color: '#0284c7',
        weight: 4,
        opacity: 1,
        lineCap: 'round',
      });
      liveGroup.addLayer(liveGlow);
      liveGroup.addLayer(liveLine);
    }

    // Render Anchor Watch circle and drop marker if provided
    if (anchorWatch) {
      const { anchorCoordinates, swingRadiusMeters, isBreached, isArmed, swingHistory } = anchorWatch;
      bounds.extend([anchorCoordinates.lat, anchorCoordinates.lon]);

      // 1. Swing zone circle
      const swingCircle = L.circle([anchorCoordinates.lat, anchorCoordinates.lon], {
        radius: swingRadiusMeters,
        color: isBreached ? '#ef4444' : isArmed ? '#10b981' : '#f59e0b',
        weight: 2,
        dashArray: '5, 5',
        fillColor: isBreached ? '#ef4444' : isArmed ? '#10b981' : '#f59e0b',
        fillOpacity: isBreached ? 0.25 : 0.15,
      });
      liveGroup.addLayer(swingCircle);

      // 2. Anchor Drop Point Marker
      const anchorIcon = L.divIcon({
        className: 'custom-anchor-marker',
        html: `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            width: 30px;
            height: 30px;
            background: #0f172a;
            border: 2px solid ${isBreached ? '#ef4444' : '#f59e0b'};
            border-radius: 50%;
            box-shadow: 0 0 10px rgba(245, 158, 11, 0.6);
            color: #f59e0b;
            font-size: 15px;
          ">
            ⚓
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      const anchorMarker = L.marker([anchorCoordinates.lat, anchorCoordinates.lon], {
        icon: anchorIcon,
      });
      anchorMarker.bindPopup(`
        <div style="font-family: sans-serif; color: #0f172a;">
          <div style="font-weight: bold; color: #d97706; font-size: 12px;">⚓ Anchor Drop Point</div>
          <div style="font-size: 11px; color: #64748b; font-family: monospace; margin-top: 2px;">
            ${toMarineCoordinates(anchorCoordinates.lat, anchorCoordinates.lon)}
          </div>
          <div style="font-size: 11px; margin-top: 2px;">
            Allowed Radius: <strong>${Math.round(swingRadiusMeters * 3.28084)} ft</strong> (${swingRadiusMeters}m)
          </div>
        </div>
      `);
      liveGroup.addLayer(anchorMarker);

      // 3. Render swing history breadcrumbs if present
      if (swingHistory && swingHistory.length >= 2) {
        const swingPoints: L.LatLngTuple[] = swingHistory.map((pt: GpsFix) => [pt.lat, pt.lon]);
        const swingLine = L.polyline(swingPoints, {
          color: '#fbbf24',
          weight: 2.5,
          opacity: 0.75,
          dashArray: '3, 4',
          lineCap: 'round',
        });
        liveGroup.addLayer(swingLine);
      }
    }

    // Render live vessel icon at current active fix
    if (activeVesselFix) {
      bounds.extend([activeVesselFix.lat, activeVesselFix.lon]);

      const heading = activeVesselFix.headingDeg || 0;
      const vesselIcon = L.divIcon({
        className: 'vessel-marker',
        html: `
          <div style="
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
          ">
            <div style="
              position: absolute;
              width: 32px;
              height: 32px;
              border-radius: 50%;
              background: rgba(14, 165, 233, 0.25);
              animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
            "></div>
            <div style="
              transform: rotate(${heading}deg);
              width: 30px;
              height: 30px;
              background: #0284c7;
              border: 2px solid #bae6fd;
              border-radius: 50% 50% 40% 40%;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 0 12px #38bdf8;
              color: white;
            ">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="12 2 19 21 12 17 5 21 12 2"></polygon>
              </svg>
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const vesselMarker = L.marker([activeVesselFix.lat, activeVesselFix.lon], {
        icon: vesselIcon,
        zIndexOffset: 1000,
      });

      vesselMarker.bindPopup(`
        <div style="font-family: sans-serif; color: #0f172a; min-width: 140px;">
          <div style="font-weight: bold; color: #0284c7; font-size: 12px; display: flex; align-items: center; gap: 4px;">
            <span>⛵ Current Position</span>
          </div>
          <div style="font-family: monospace; font-size: 11px; margin-top: 3px; color: #334155;">
            ${toMarineCoordinates(activeVesselFix.lat, activeVesselFix.lon)}
          </div>
          <div style="font-size: 11px; margin-top: 3px; color: #475569;">
            <strong>SOG:</strong> ${activeVesselFix.speedKts?.toFixed(1) || '0.0'} kts<br/>
            <strong>COG:</strong> ${activeVesselFix.headingDeg != null ? `${activeVesselFix.headingDeg}°` : 'N/A'}<br/>
            ${activeVesselFix.accuracyMeters != null ? `<strong>Fix:</strong> ±${activeVesselFix.accuracyMeters}m` : ''}
          </div>
        </div>
      `);
      liveGroup.addLayer(vesselMarker);
    }

    // Only auto-fit bounds on first live fix if no static leg bounds were fitted yet
    if (!hasInitialFitRef.current && bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [30, 30],
        maxZoom: 14,
      });
      hasInitialFitRef.current = true;
    }
  }, [activeVesselFix, liveTrackPoints, anchorWatch]);

  // Re-synchronize Leaflet container viewport and pan to active vessel upon unlocking phone
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const map = mapInstanceRef.current;
        if (map) {
          setTimeout(() => {
            map.invalidateSize();
            if (activeVesselFix) {
              map.panTo([activeVesselFix.lat, activeVesselFix.lon], { animate: true });
            }
          }, 150);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeVesselFix]);

  // Handle fullscreen resizing & Escape key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Invalidate map size across render frames to ensure tiles fill full screen
    const t1 = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 100);
    const t2 = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 350);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isFullscreen]);

  // Recenter map on active vessel GPS position
  const handleRecenterBoat = useCallback(() => {
    if (!mapInstanceRef.current || !activeVesselFix) return;
    const currentZoom = mapInstanceRef.current.getZoom();
    const targetZoom = Math.max(currentZoom, 14);
    mapInstanceRef.current.flyTo(
      [activeVesselFix.lat, activeVesselFix.lon],
      targetZoom,
      { animate: true, duration: 0.75 }
    );
  }, [activeVesselFix]);

  // Zoom map out to fit all recorded legs and live track points
  const handleFitRoute = useCallback(() => {
    if (!mapInstanceRef.current) return;
    const bounds = L.latLngBounds([]);

    legs.forEach((leg) => {
      if (leg.departureCoordinates) {
        bounds.extend([leg.departureCoordinates.lat, leg.departureCoordinates.lon]);
      }
      if (leg.arrivalCoordinates) {
        bounds.extend([leg.arrivalCoordinates.lat, leg.arrivalCoordinates.lon]);
      }
      if (leg.trackPoints) {
        leg.trackPoints.forEach((pt) => bounds.extend([pt.lat, pt.lon]));
      }
    });

    if (liveTrackPoints) {
      liveTrackPoints.forEach((pt) => bounds.extend([pt.lat, pt.lon]));
    }
    if (activeVesselFix) {
      bounds.extend([activeVesselFix.lat, activeVesselFix.lon]);
    }

    if (bounds.isValid()) {
      mapInstanceRef.current.fitBounds(bounds, {
        padding: [35, 35],
        maxZoom: 15,
        animate: true,
      });
    }
  }, [legs, liveTrackPoints, activeVesselFix]);

  return (
    <div
      className={`relative flex flex-col bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl transition-all ${
        isFullscreen
          ? 'fixed inset-0 z-[130] rounded-none w-screen h-screen'
          : isModal
            ? 'w-full max-w-4xl max-h-[90vh] h-[650px]'
            : className || 'w-full h-80'
      }`}
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 backdrop-blur border-b border-slate-800 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center shrink-0">
            <Compass className="w-4 h-4 text-sky-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-100 truncate">
              {title || 'Passage Navigation Chart'}
            </h3>
            {subtitle && (
              <p className="text-[11px] text-slate-400 truncate">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Stats Pill & Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {totalStats.distanceNm > 0 && (
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono bg-slate-800/80 border border-slate-700/60 rounded-lg px-2.5 py-1 text-slate-300">
              <span>{totalStats.distanceNm} NM</span>
              {totalStats.maxSpeedKts > 0 && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="text-sky-400">Max {totalStats.maxSpeedKts} kts</span>
                </>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowOfflineModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-sky-300 bg-sky-950/70 hover:bg-sky-900 border border-sky-500/40 rounded-lg transition shadow cursor-pointer"
            title="Download offline chart pack for cruising with no cell service"
          >
            <DownloadCloud className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Offline Charts</span>
          </button>

          {/* Maximize / Fullscreen Map Button (Available in both live cockpit tracking and modals) */}
          <button
            type="button"
            onClick={() => {
              setIsFullscreen(!isFullscreen);
              setTimeout(() => mapInstanceRef.current?.invalidateSize(), 200);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer shadow ${
              isFullscreen
                ? 'bg-sky-500 text-slate-950 hover:bg-sky-400 font-extrabold'
                : 'text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60'
            }`}
            title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Maximize Fullscreen Chart'}
            aria-label={isFullscreen ? 'Exit Fullscreen' : 'Maximize Fullscreen Chart'}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Exit Fullscreen</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Maximize</span>
              </>
            )}
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 rounded-lg transition cursor-pointer"
              title="Close Map"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Map Surface */}
      <div className="relative flex-1 w-full h-full min-h-[300px]">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Floating Layer Selector Bar */}
        <div className="absolute top-3 left-3 z-[400] flex items-center gap-1 bg-slate-900/90 backdrop-blur border border-slate-700/70 rounded-xl p-1 shadow-lg text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setActiveLayer('osm')}
            className={`px-2 py-1 rounded-lg transition ${
              activeLayer === 'osm'
                ? 'bg-sky-500 text-slate-950 font-bold shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            Ocean Chart
          </button>
          <button
            type="button"
            onClick={() => setActiveLayer('satellite')}
            className={`px-2 py-1 rounded-lg transition ${
              activeLayer === 'satellite'
                ? 'bg-sky-500 text-slate-950 font-bold shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            Satellite
          </button>
          <button
            type="button"
            onClick={() => setActiveLayer('dark')}
            className={`px-2 py-1 rounded-lg transition ${
              activeLayer === 'dark'
                ? 'bg-sky-500 text-slate-950 font-bold shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            Night Cockpit
          </button>

          <div className="w-[1px] h-4 bg-slate-700 mx-1" />

          {/* OpenSeaMap Marine Seamarks Toggle */}
          <button
            type="button"
            onClick={() => setShowSeaMarks(!showSeaMarks)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg transition ${
              showSeaMarks
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-600/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title="Toggle OpenSeaMap Buoys, Beacons & Seamarks"
          >
            {showSeaMarks ? (
              <Eye className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <EyeOff className="w-3.5 h-3.5" />
            )}
            <span>Seamarks</span>
          </button>
        </div>

        {/* Floating Controls Bar (Bottom Right): Recenter Boat & Fit Route */}
        <div className="absolute bottom-3 right-3 z-[400] flex items-center gap-2">
          {legs.length > 0 && (
            <button
              type="button"
              onClick={handleFitRoute}
              className="flex items-center gap-1.5 bg-slate-900/90 hover:bg-slate-800 active:bg-slate-950 text-slate-200 hover:text-white text-xs font-semibold px-2.5 py-1.5 rounded-xl shadow-lg border border-slate-700/80 transition cursor-pointer backdrop-blur"
              title="Zoom out to fit entire voyage route"
            >
              <Compass className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Fit Route</span>
            </button>
          )}

          {activeVesselFix && (
            <button
              type="button"
              onClick={handleRecenterBoat}
              className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-xl transition border border-sky-400/50 cursor-pointer backdrop-blur"
              title="Recenter chart onto current vessel GPS position"
            >
              <Crosshair className="w-3.5 h-3.5 text-white" />
              <span>Recenter Boat</span>
            </button>
          )}
        </div>

        {/* Live Underway Beacon Pill (Bottom Left): Clickable to recenter on boat */}
        {activeVesselFix && (
          <button
            type="button"
            onClick={handleRecenterBoat}
            className="absolute bottom-3 left-3 z-[400] flex items-center gap-2.5 bg-slate-900/90 hover:bg-slate-800 backdrop-blur border border-sky-500/50 text-sky-200 text-xs px-3 py-1.5 rounded-xl shadow-xl transition cursor-pointer group text-left"
            title="Click to recenter map on vessel position"
          >
            <Radio className="w-3.5 h-3.5 text-sky-400 animate-pulse group-hover:scale-110 transition shrink-0" />
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-white">Live Tracking</span>
              <span className="font-mono text-emerald-400 font-extrabold">
                {activeVesselFix.speedKts != null ? activeVesselFix.speedKts.toFixed(1) : '0.0'} kts
              </span>
              {activeVesselFix.headingDeg != null && (
                <span className="font-mono text-sky-300">
                  {Math.round(activeVesselFix.headingDeg)}°
                </span>
              )}
              {totalStats.distanceNm > 0 && (
                <span className="font-mono text-amber-300 hidden sm:inline">
                  {totalStats.distanceNm} NM
                </span>
              )}
            </div>
          </button>
        )}
      </div>

      {/* Bottom Route Legend Bar (if multiple legs or ports) */}
      <div className="px-4 py-2 bg-slate-900/95 border-t border-slate-800/90 flex items-center justify-between gap-3 text-xs flex-wrap z-10">
        <div className="flex items-center gap-3 overflow-x-auto py-0.5">
          {legs.map((leg, i) => (
            <div key={leg.id} className="flex items-center gap-1.5 shrink-0">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: LEG_COLORS[i % LEG_COLORS.length] }}
              />
              <span className="text-slate-300 font-medium">
                {leg.departurePort.split(',')[0]} → {leg.arrivalPort.split(',')[0]}
              </span>
              {leg.distanceNm ? (
                <span className="text-slate-500 font-mono text-[11px]">
                  ({leg.distanceNm} NM)
                </span>
              ) : null}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-400 shrink-0">
          <div className="hidden sm:flex items-center gap-1 text-amber-400/80 text-[10.5px]">
            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
            <span>Supplemental aid only • Not for primary navigation</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <span>Departure</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
            <span>Arrival</span>
          </div>
        </div>
      </div>

      {/* Offline Chart Pack Manager Modal */}
      {showOfflineModal && (
        <OfflineChartManagerModal
          centerLat={
            activeVesselFix?.lat ||
            legs[0]?.departureCoordinates?.lat ||
            48.65
          }
          centerLon={
            activeVesselFix?.lon ||
            legs[0]?.departureCoordinates?.lon ||
            -122.87
          }
          centerLabel={
            activeVesselFix
              ? 'Current Vessel GPS Position'
              : legs[0]?.departurePort || 'Cruising Area'
          }
          onClose={() => setShowOfflineModal(false)}
          onDownloaded={() => {
            mapInstanceRef.current?.invalidateSize();
          }}
        />
      )}
    </div>
  );
};
