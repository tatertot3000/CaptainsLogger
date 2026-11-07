import React, { useState } from 'react';
import {
  Anchor,
  AlertTriangle,
  Bell,
  BellOff,

  MapPin,

  Radio,
  Sliders,
  Volume2,
  X,
  Shield,
} from 'lucide-react';
import type { GpsFix, AnchorWatchState } from '../types';
import {
  toMarineCoordinates,
  metersToFeet,
  feetToMeters,
} from '../utils/geo';
import { marineAlarm } from '../utils/audioAlarm';
import { LegTrackMap } from './LegTrackMap';

interface AnchorWatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFix: GpsFix | null;
  anchorWatch: AnchorWatchState | null;
  isArmed: boolean;
  distanceFromAnchorFeet: number | null;
  distanceFromAnchorMeters: number | null;
  swingRadiusFeet: number;
  bearingCompass: string;
  isBreached: boolean;
  radiusPercentage: number;
  isAlarmSilenced: boolean;
  swingHistory: GpsFix[];
  onArm: (
    coords: { lat: number; lon: number },
    radiusMeters: number,
    depthFeet?: number,
    freeboardFeet?: number,
    rodeLengthFeet?: number,
    notes?: string
  ) => void;
  onDisarm: () => void;
  onUpdateRadius: (radiusMeters: number) => void;
  onSilenceAlarm: () => void;
  onResumeAlarm: () => void;
  onRequestGps?: () => void;
}

const PRESET_RADII_FEET = [50, 75, 100, 125, 150, 200, 250, 300];

export const AnchorWatchModal: React.FC<AnchorWatchModalProps> = ({
  isOpen,
  onClose,
  currentFix,
  anchorWatch,
  isArmed,
  distanceFromAnchorFeet,
  distanceFromAnchorMeters,
  swingRadiusFeet,
  bearingCompass,
  isBreached,
  radiusPercentage,
  isAlarmSilenced,
  swingHistory,
  onArm,
  onDisarm,
  onUpdateRadius,
  onSilenceAlarm,
  onResumeAlarm,
  onRequestGps,
}) => {
  // Setup form state
  const [selectedRadiusFeet, setSelectedRadiusFeet] = useState<number>(() =>
    anchorWatch ? metersToFeet(anchorWatch.swingRadiusMeters) : 100
  );
  const [waterDepthFeet, setWaterDepthFeet] = useState<string>(
    anchorWatch?.depthFeet ? String(anchorWatch.depthFeet) : '15'
  );
  const [bowFreeboardFeet, setBowFreeboardFeet] = useState<string>(
    anchorWatch?.freeboardFeet ? String(anchorWatch.freeboardFeet) : '5'
  );
  const [scopeRatio, setScopeRatio] = useState<number>(5);
  const [showScopeCalc, setShowScopeCalc] = useState(false);
  const [notes] = useState<string>(anchorWatch?.notes || '');
  const [isPlayingTestSound, setIsPlayingTestSound] = useState(false);

  if (!isOpen) return null;

  const handleCalculateScope = (ratio: number) => {
    setScopeRatio(ratio);
    const depth = parseFloat(waterDepthFeet) || 0;
    const freeboard = parseFloat(bowFreeboardFeet) || 0;
    const totalHeight = depth + freeboard;
    if (totalHeight > 0) {
      // Total rode needed + safety buffer
      const calculatedRode = Math.round(totalHeight * ratio);
      // Swing radius = rode length + 10% safety buffer
      const suggestedRadius = Math.max(40, Math.round(calculatedRode * 0.95));
      setSelectedRadiusFeet(suggestedRadius);
    }
  };

  const handleArmAtCurrentPosition = () => {
    if (!currentFix) {
      alert('Waiting for GPS coordinates. Please ensure GPS is active.');
      return;
    }
    const radiusMeters = feetToMeters(selectedRadiusFeet);
    onArm(
      { lat: currentFix.lat, lon: currentFix.lon },
      radiusMeters,
      parseFloat(waterDepthFeet) || undefined,
      parseFloat(bowFreeboardFeet) || undefined,
      Math.round((parseFloat(waterDepthFeet) || 0 + (parseFloat(bowFreeboardFeet) || 0)) * scopeRatio),
      notes.trim() || undefined
    );
  };



  const handleTestSiren = () => {
    setIsPlayingTestSound(true);
    marineAlarm.playTestBeep();
    setTimeout(() => setIsPlayingTestSound(false), 800);
  };

  return (
    <div
      className="fixed inset-0 z-[130] bg-black/85 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-4 sm:p-5 space-y-4 shadow-2xl my-auto text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                isBreached
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500 animate-pulse'
                  : isArmed
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500'
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
              }`}
            >
              <Anchor className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white">Anchor Watch Alarm</h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    isBreached
                      ? 'bg-rose-500 text-white animate-bounce'
                      : isArmed
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {isBreached ? '🚨 ANCHOR DRAGGING!' : isArmed ? 'ARMED & MONITORING' : 'DISARMED'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Marine swing circle & drift monitor with audible siren
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleTestSiren}
              className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
              title="Test audio siren and vibration"
            >
              <Volume2 className={`w-3.5 h-3.5 ${isPlayingTestSound ? 'text-amber-400 animate-ping' : ''}`} />
              <span className="hidden sm:inline">Test Siren</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Breach Alert Banner if active */}
        {isBreached && (
          <div className="bg-rose-950/80 border-2 border-rose-500 rounded-xl p-3.5 flex items-center justify-between gap-3 text-rose-100 animate-pulse">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0" />
              <div>
                <div className="font-extrabold text-sm text-white">
                  ANCHOR DRAGGING DETECTED!
                </div>
                <div className="text-xs text-rose-200">
                  Vessel is {distanceFromAnchorFeet} ft away (exceeds {swingRadiusFeet} ft allowed radius).
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isAlarmSilenced ? (
                <button
                  type="button"
                  onClick={onResumeAlarm}
                  className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-rose-800 hover:bg-rose-700 text-white transition"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>Resume Siren</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSilenceAlarm}
                  className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-white text-rose-950 hover:bg-rose-100 transition shadow"
                >
                  <BellOff className="w-3.5 h-3.5" />
                  <span>Silence Siren</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Live Gauges (when armed) */}
        {isArmed && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              {/* Gauge 1: Distance to Anchor */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-0.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Distance to Anchor
                </div>
                <div
                  className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
                    isBreached
                      ? 'text-rose-400'
                      : radiusPercentage > 85
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {distanceFromAnchorFeet != null ? distanceFromAnchorFeet : '---'}
                  <span className="text-xs font-semibold text-slate-400 ml-1">ft</span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {distanceFromAnchorMeters != null ? `${distanceFromAnchorMeters}m` : ''}
                </div>
              </div>

              {/* Gauge 2: Safe Swing Radius */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-0.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Allowed Radius
                </div>
                <div className="text-2xl sm:text-3xl font-black font-mono text-sky-300 tracking-tight">
                  {swingRadiusFeet}
                  <span className="text-xs font-semibold text-slate-400 ml-1">ft</span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {anchorWatch ? `${anchorWatch.swingRadiusMeters}m` : ''}
                </div>
              </div>

              {/* Gauge 3: Direction / Bearing */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-0.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Anchor Direction
                </div>
                <div className="text-lg sm:text-xl font-black font-mono text-amber-300 tracking-tight pt-1 truncate">
                  {bearingCompass}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">Bearing to drop</div>
              </div>

              {/* Gauge 4: Status / Battery Watch */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-0.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Swing Capacity
                </div>
                <div
                  className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
                    isBreached ? 'text-rose-400' : 'text-slate-200'
                  }`}
                >
                  {radiusPercentage}%
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {isBreached ? 'Exceeded' : 'Within Swing Zone'}
                </div>
              </div>
            </div>

            {/* Swing Progress Bar */}
            <div className="space-y-1">
              <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
                <div
                  className={`h-full transition-all duration-300 ${
                    isBreached
                      ? 'bg-rose-500'
                      : radiusPercentage > 85
                      ? 'bg-amber-400'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, radiusPercentage)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0 ft (Over Anchor)</span>
                <span>Safe Limit: {swingRadiusFeet} ft</span>
              </div>
            </div>

            {/* Action Bar when armed */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onDisarm}
                  className="bg-slate-800 hover:bg-slate-700 text-rose-300 hover:text-rose-200 font-bold text-xs px-3.5 py-2 rounded-xl transition border border-rose-900/60 cursor-pointer"
                >
                  Disarm Watch &amp; Pull Anchor
                </button>

                {isAlarmSilenced ? (
                  <button
                    type="button"
                    onClick={onResumeAlarm}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition"
                  >
                    <Bell className="w-3.5 h-3.5 text-amber-400" />
                    <span>Resume Siren</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onSilenceAlarm}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-slate-800 text-slate-400 hover:text-slate-200 transition"
                  >
                    <BellOff className="w-3.5 h-3.5" />
                    <span>Mute Siren</span>
                  </button>
                )}
              </div>

              {/* Quick Radius Adjustment while armed */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400 font-semibold">Radius:</span>
                {[75, 100, 150, 200].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => onUpdateRadius(feetToMeters(r))}
                    className={`px-2 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      swingRadiusFeet === r
                        ? 'bg-sky-500 text-slate-950 font-black shadow'
                        : 'bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {r}′
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Live Swing Chart View */}
        <div className="rounded-xl overflow-hidden border border-slate-800">
          <LegTrackMap
            legs={[]}
            activeVesselFix={currentFix}
            anchorWatch={
              anchorWatch && isArmed
                ? {
                    anchorCoordinates: anchorWatch.anchorCoordinates,
                    swingRadiusMeters: anchorWatch.swingRadiusMeters,
                    isArmed: true,
                    isBreached,
                    swingHistory,
                  }
                : currentFix
                ? {
                    anchorCoordinates: { lat: currentFix.lat, lon: currentFix.lon },
                    swingRadiusMeters: feetToMeters(selectedRadiusFeet),
                    isArmed: false,
                  }
                : null
            }
            title={isArmed ? 'Live Anchor Swing Zone' : 'Drop Anchor Preview'}
            subtitle={
              isArmed
                ? `${swingHistory.length} swing fixes recorded`
                : 'Click "Drop Anchor" to set circle'
            }
            className="w-full h-56 sm:h-64"
          />
        </div>

        {/* Arming Controls (when disarmed) */}
        {!isArmed && (
          <div className="space-y-3.5 bg-slate-950/70 p-3.5 sm:p-4 rounded-xl border border-slate-800">
            {/* Allowed Swing Radius Selector */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-sky-400" />
                  Allowed Swing Radius: <span className="text-sky-300 font-mono text-sm">{selectedRadiusFeet} ft</span>
                  <span className="text-[10px] text-slate-500 font-mono">({feetToMeters(selectedRadiusFeet)}m)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowScopeCalc(!showScopeCalc)}
                  className="text-[11px] text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Sliders className="w-3 h-3" />
                  <span>{showScopeCalc ? 'Hide Scope Calc' : 'Scope Calc'}</span>
                </button>
              </div>

              {/* Quick Preset Buttons */}
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                {PRESET_RADII_FEET.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setSelectedRadiusFeet(r)}
                    className={`py-1.5 rounded-lg text-xs font-bold transition cursor-pointer text-center ${
                      selectedRadiusFeet === r
                        ? 'bg-sky-500 text-slate-950 font-black shadow'
                        : 'bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {r} ft
                  </button>
                ))}
              </div>
            </div>

            {/* Scope Calculator Accordion */}
            {showScopeCalc && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2.5 animate-in fade-in">
                <div className="text-xs font-bold text-slate-300">
                  Rode Scope &amp; Swing Radius Helper
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Water Depth (ft)</label>
                    <input
                      type="number"
                      value={waterDepthFeet}
                      onChange={(e) => setWaterDepthFeet(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Bow Freeboard (ft)</label>
                    <input
                      type="number"
                      value={bowFreeboardFeet}
                      onChange={(e) => setBowFreeboardFeet(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1 flex items-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleCalculateScope(5)}
                      className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
                    >
                      5:1 Scope
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCalculateScope(7)}
                      className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
                    >
                      7:1 Scope
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Drop Anchor Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5 font-mono">
                <MapPin className={`w-3.5 h-3.5 ${currentFix ? 'text-teal-400' : 'text-amber-400 animate-pulse'} shrink-0`} />
                <span>
                  {currentFix
                    ? `${toMarineCoordinates(currentFix.lat, currentFix.lon)}${
                        currentFix.accuracyMeters ? ` (±${currentFix.accuracyMeters}m)` : ''
                      }`
                    : 'Acquiring satellite GPS fix...'}
                </span>
                {!currentFix && onRequestGps && (
                  <button
                    type="button"
                    onClick={onRequestGps}
                    className="ml-2 text-xs text-sky-400 hover:text-sky-300 underline font-sans cursor-pointer"
                  >
                    Retry GPS
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleArmAtCurrentPosition}
                disabled={!currentFix}
                className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-extrabold text-xs px-5 py-2.5 rounded-xl transition shadow cursor-pointer"
              >
                <Anchor className="w-4 h-4" />
                <span>{currentFix ? 'Drop Anchor & Arm Alarm' : 'Waiting for GPS...'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1 text-[11px]">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Monitors background position with Android foreground service</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-1.5 rounded-xl transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

