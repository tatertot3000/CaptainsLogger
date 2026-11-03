import React, { useState } from 'react';
import {
  AlertTriangle,
  Compass,
  ShieldAlert,
  Anchor,
  X,
  CheckCircle2,
  FileCheck2,
} from 'lucide-react';

export const GPS_DISCLAIMER_KEY_PREFIX = 'captains_logger_gps_disclaimer_ack_';

export function hasAcknowledgedGpsDisclaimer(tripId?: string): boolean {
  if (!tripId) return false;
  try {
    return localStorage.getItem(`${GPS_DISCLAIMER_KEY_PREFIX}${tripId}`) === 'true';
  } catch {
    return false;
  }
}

export function setAcknowledgedGpsDisclaimer(tripId?: string, acknowledged = true): void {
  if (!tripId) return;
  try {
    if (acknowledged) {
      localStorage.setItem(`${GPS_DISCLAIMER_KEY_PREFIX}${tripId}`, 'true');
    } else {
      localStorage.removeItem(`${GPS_DISCLAIMER_KEY_PREFIX}${tripId}`);
    }
  } catch {
    // ignore storage quotas or sandboxing
  }
}

export interface GpsDisclaimerModalProps {
  isOpen: boolean;
  voyageTitle?: string;
  tripId?: string;
  onAccept: (dontShowAgainThisVoyage: boolean) => void;
  onCancel: () => void;
}

export const GpsDisclaimerModal: React.FC<GpsDisclaimerModalProps> = ({
  isOpen,
  voyageTitle,
  tripId,
  onAccept,
  onCancel,
}) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!isOpen) return null;

  const handleAccept = () => {
    if (dontShowAgain && tripId) {
      setAcknowledgedGpsDisclaimer(tripId, true);
    }
    onAccept(dontShowAgain);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gps-disclaimer-title"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-xl bg-slate-900 border border-amber-500/40 ring-1 ring-amber-500/20 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-900 border-b border-amber-500/30 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="gps-disclaimer-title"
                className="text-base font-extrabold text-white flex items-center gap-2"
              >
                <span>GPS & Navigational Safety Notice</span>
              </h3>
              <p className="text-xs text-amber-300/90 font-medium">
                Supplemental Logging Aid Only • Master's Sole Responsibility
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
            title="Cancel and close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Disclaimer Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-300 leading-relaxed">
          {/* Prominent High-Risk Warning Callout */}
          <div className="p-3.5 bg-amber-950/40 border border-amber-500/50 rounded-xl flex items-start gap-3 text-amber-200">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-amber-300 text-[13px]">
                USE AT YOUR OWN RISK — NOT FOR PRIMARY NAVIGATION
              </p>
              <p className="text-[11.5px] leading-relaxed text-amber-200/90">
                Captain's Logger is an informational logbook and cockpit assistant. It is{' '}
                <strong>NOT a certified ECDIS</strong> or approved primary navigation system.
                The developer and contributors cannot guarantee map or GPS accuracy and assume no
                liability for navigational decisions, loss, grounding, or maritime casualties.
              </p>
            </div>
          </div>

          {/* Key Maritime Rules & Limitations */}
          <div className="space-y-2.5">
            <div className="p-3 bg-slate-950/50 border border-slate-800/80 rounded-xl space-y-1">
              <div className="flex items-center gap-2 font-bold text-slate-100">
                <Compass className="w-3.5 h-3.5 text-sky-400" />
                <span>Map Data & GPS Accuracy Limitations</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Marine charts, OpenSeaMap seamarks (buoys, lights, beacons), satellite imagery, and GPS
                telemetry are aggregated from third-party and public sources. Latency, cartographic errors,
                uncharted hazards, tidal variations, and hardware GPS inaccuracies may occur. Do not rely
                upon this map for hazard avoidance or close-quarters maneuvering.
              </p>
            </div>

            <div className="p-3 bg-slate-950/50 border border-slate-800/80 rounded-xl space-y-1">
              <div className="flex items-center gap-2 font-bold text-slate-100">
                <Anchor className="w-3.5 h-3.5 text-teal-400" />
                <span>Master's Sole Responsibility & Prudent Seamanship</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                The vessel master/operator retains full, sole, and unshared responsibility for the safe
                navigation, pilotage, and safety of the vessel, crew, and passengers at all times. You must
                maintain full cognizance of navigation and situational awareness while underway.
              </p>
            </div>

            <div className="p-3 bg-slate-950/50 border border-slate-800/80 rounded-xl space-y-1">
              <div className="flex items-center gap-2 font-bold text-slate-100">
                <FileCheck2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>COLREGS Compliance & Official Government Charts</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Under Rule 5 of the International Regulations for Preventing Collisions at Sea (COLREGS),
                every vessel must maintain a proper look-out at all times by sight and hearing. Always
                cross-reference your position with official, up-to-date government nautical charts
                (e.g., NOAA, UKHO, CHS), depth sounders, radar, and visual navigational aids.
              </p>
            </div>
          </div>

          {/* Do not show again checkbox */}
          <label className="flex items-start gap-3 p-3 bg-slate-950/70 border border-slate-800 rounded-xl cursor-pointer hover:bg-slate-950 transition">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="mt-0.5 rounded border-slate-700 text-amber-500 focus:ring-amber-500/40 cursor-pointer w-4 h-4 bg-slate-900"
            />
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-slate-200">
                Do not prompt again during this voyage
              </span>
              <p className="text-[11px] text-slate-400">
                {voyageTitle ? (
                  <>Acknowledged for passage: <strong className="text-slate-300">{voyageTitle}</strong>.</>
                ) : (
                  'Saves your acknowledgement for this voyage so subsequent leg tracking will not be interrupted.'
                )}
              </p>
            </div>
          </label>
        </div>

        {/* Modal Actions Footer */}
        <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition cursor-pointer"
          >
            Cancel / Abort GPS
          </button>

          <button
            type="button"
            onClick={handleAccept}
            className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs px-5 py-2.5 rounded-lg transition shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>I Understand &amp; Accept</span>
          </button>
        </div>
      </div>
    </div>
  );
};

