import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Clock,
  Compass,
  Fuel,
  Gauge,
  Plus,
  Trash2,
  TrendingUp,
  Wrench,
  X,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { CaptainsDatabase, EngineHoursEntry } from '../types';
import { evaluateSchedule } from '../utils/vendors';

interface EngineHoursModalProps {
  db: CaptainsDatabase;
  onClose: () => void;
  onUpdateDb: (updated: CaptainsDatabase) => void;
}

interface UnifiedTimelineEvent {
  id: string;
  date: string;
  engineHours: number;
  type: 'manual' | 'fuel' | 'service';
  title: string;
  details?: string;
  note?: string;
  deltaHours?: number;
  deltaDays?: number;
  manualLogId?: string;
}

interface UpcomingServiceMilestone {
  scheduleTitle: string;
  hoursRemaining: number;
  nextDueHours: number;
  isOverdue: boolean;
}

export const EngineHoursModal: React.FC<EngineHoursModalProps> = ({
  db,
  onClose,
  onUpdateDb,
}) => {
  const currentHours = db.vessel.currentEngineHours;
  const todayStr = new Date().toISOString().slice(0, 10);

  // New check-in form state
  const [newDate, setNewDate] = useState(todayStr);
  const [newHours, setNewHours] = useState(String(currentHours));
  const [newNote, setNewNote] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Direct vessel hour meter adjustment state
  const [calibratingHourMeter, setCalibratingHourMeter] = useState(false);
  const [hourMeterInput, setHourMeterInput] = useState(String(currentHours));

  // Compute unified timeline combining engineHoursLogs, fuelLogs, and serviceLogs
  const { timeline, stats, nextServiceMilestone } = useMemo<{
    timeline: UnifiedTimelineEvent[];
    stats: {
      hoursThisYear: number;
      hoursPast30: number;
      nextMajorMilestone: number;
      hoursToMajorMilestone: number;
    };
    nextServiceMilestone: UpcomingServiceMilestone | null;
  }>(() => {
    const rawEvents: Array<{
      id: string;
      date: string;
      engineHours: number;
      type: 'manual' | 'fuel' | 'service';
      title: string;
      details?: string;
      note?: string;
      manualLogId?: string;
    }> = [];

    // 1. Manual check-ins
    (db.engineHoursLogs || []).forEach((entry) => {
      rawEvents.push({
        id: `manual-${entry.id}`,
        date: entry.date,
        engineHours: entry.engineHours,
        type: 'manual',
        title: 'Hour Meter Check-in',
        note: entry.note,
        manualLogId: entry.id,
      });
    });

    // 2. Fuel fill-ups
    (db.fuelLogs || []).forEach((fuel) => {
      const detailsArr: string[] = [`${fuel.gallonsAdded.toFixed(1)} gal`];
      if (fuel.pricePerGallon) {
        detailsArr.push(`$${fuel.pricePerGallon.toFixed(2)}/gal`);
      }
      if (fuel.isFullTank) {
        detailsArr.push('Full Tank');
      }
      if (fuel.additivesUsed && fuel.additivesUsed.length > 0) {
        detailsArr.push(`${fuel.additivesUsed.length} additive(s)`);
      }

      rawEvents.push({
        id: `fuel-${fuel.id}`,
        date: fuel.date,
        engineHours: fuel.engineHours,
        type: 'fuel',
        title: 'Fuel Dock Fill-up',
        details: detailsArr.join(' • '),
        note: fuel.notes,
      });
    });

    // 3. Service logs
    (db.serviceLogs || []).forEach((svc) => {
      const partsSummary = svc.partsUsed?.length
        ? `${svc.partsUsed.length} part(s) replaced`
        : undefined;

      rawEvents.push({
        id: `svc-${svc.id}`,
        date: svc.date,
        engineHours: svc.engineHours,
        type: 'service',
        title: svc.title,
        details: [svc.category, partsSummary, svc.cost > 0 ? `$${svc.cost.toFixed(2)}` : null]
          .filter(Boolean)
          .join(' • '),
        note: svc.notes,
      });
    });

    // Sort chronologically ascending to compute deltas, then reverse to descending
    rawEvents.sort((a, b) => {
      if (a.engineHours !== b.engineHours) {
        return a.engineHours - b.engineHours;
      }
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    const computedTimeline: UnifiedTimelineEvent[] = rawEvents.map((evt, idx) => {
      let deltaHours: number | undefined;
      let deltaDays: number | undefined;

      if (idx > 0) {
        const prev = rawEvents[idx - 1];
        deltaHours = Number((evt.engineHours - prev.engineHours).toFixed(1));
        const diffMs = new Date(evt.date).getTime() - new Date(prev.date).getTime();
        deltaDays = Math.max(0, Math.round(diffMs / 86400000));
      }

      return {
        ...evt,
        deltaHours,
        deltaDays,
      };
    });

    // Reverse so latest is first
    computedTimeline.reverse();

    // Calculate cruising velocity and milestone stats
    const currentYear = new Date().getFullYear();
    const now = new Date().getTime();
    const thirtyDaysAgo = now - 30 * 86400000;

    // Filter events by timeframes
    const eventsThisYear = rawEvents.filter(
      (e) => new Date(e.date).getFullYear() === currentYear
    );
    const eventsPast30Days = rawEvents.filter(
      (e) => new Date(e.date).getTime() >= thirtyDaysAgo
    );

    // Hours this season/year
    let hoursThisYear = 0;
    if (eventsThisYear.length > 0) {
      const minHoursThisYear = eventsThisYear[0].engineHours;
      hoursThisYear = Math.max(0, Number((currentHours - minHoursThisYear).toFixed(1)));
    }

    // Hours past 30 days
    let hoursPast30 = 0;
    if (eventsPast30Days.length > 0) {
      const minHoursPast30 = eventsPast30Days[0].engineHours;
      hoursPast30 = Math.max(0, Number((currentHours - minHoursPast30).toFixed(1)));
    }

    // Next 100-hour major milestone
    const nextMajorMilestone = Math.ceil((currentHours + 0.1) / 100) * 100;
    const hoursToMajorMilestone = Math.max(
      0,
      Number((nextMajorMilestone - currentHours).toFixed(1))
    );

    // Find next upcoming service milestone
    let nearestService: UpcomingServiceMilestone | null = null;

    for (const sched of db.schedules || []) {
      if (sched.intervalHours && sched.intervalHours > 0) {
        const evalResult = evaluateSchedule(sched, currentHours);
        if (evalResult.hoursRemaining !== undefined) {
          const isOverdue = evalResult.hoursRemaining <= 0;
          const currentNearest: UpcomingServiceMilestone | null = nearestService;
          if (
            !currentNearest ||
            (isOverdue && !currentNearest.isOverdue) ||
            (!isOverdue && !currentNearest.isOverdue && evalResult.hoursRemaining < currentNearest.hoursRemaining)
          ) {
            nearestService = {
              scheduleTitle: sched.title,
              hoursRemaining: evalResult.hoursRemaining,
              nextDueHours: evalResult.nextDueHours ?? (sched.lastCompletedHours ?? 0) + sched.intervalHours,
              isOverdue,
            };
          }
        }
      }
    }

    return {
      timeline: computedTimeline,
      stats: {
        hoursThisYear,
        hoursPast30,
        nextMajorMilestone,
        hoursToMajorMilestone,
      },
      nextServiceMilestone: nearestService,
    };
  }, [db, currentHours]);

  // Handle logging a new reading
  const handleSaveReading = (e: React.FormEvent) => {
    e.preventDefault();
    const hoursNum = parseFloat(newHours);
    if (isNaN(hoursNum) || hoursNum < 0) return;

    const newEntry: EngineHoursEntry = {
      id: `hours-${Date.now()}`,
      date: newDate,
      engineHours: hoursNum,
      note: newNote.trim() || undefined,
    };

    const updatedHoursLogs = [...(db.engineHoursLogs || []), newEntry];
    // Automatically advance vessel currentEngineHours if this reading is higher
    const updatedVesselHours = Math.max(db.vessel.currentEngineHours, hoursNum);

    const updatedDb: CaptainsDatabase = {
      ...db,
      vessel: {
        ...db.vessel,
        currentEngineHours: updatedVesselHours,
        lastUpdated: todayStr,
      },
      engineHoursLogs: updatedHoursLogs,
    };

    onUpdateDb(updatedDb);
    setNewNote('');
    setShowAddForm(false);
  };

  // Handle direct calibration of primary vessel hour meter
  const handleCalibrateHourMeter = (e: React.FormEvent) => {
    e.preventDefault();
    const hoursNum = parseFloat(hourMeterInput);
    if (isNaN(hoursNum) || hoursNum < 0) return;

    const updatedDb: CaptainsDatabase = {
      ...db,
      vessel: {
        ...db.vessel,
        currentEngineHours: hoursNum,
        lastUpdated: todayStr,
      },
    };

    onUpdateDb(updatedDb);
    setCalibratingHourMeter(false);
  };

  // Handle deleting a manual engine hours entry
  const handleDeleteManualLog = (manualId: string) => {
    if (!window.confirm('Delete this hour meter milestone entry?')) return;

    const updatedHoursLogs = (db.engineHoursLogs || []).filter((l) => l.id !== manualId);
    onUpdateDb({
      ...db,
      engineHoursLogs: updatedHoursLogs,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
      style={{
        paddingTop: 'max(1.5rem, calc(env(safe-area-inset-top, 0px) + 1rem))',
        paddingBottom: 'max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))',
      }}
    >
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-amber-500/20 to-sky-500/20 border border-amber-500/30 rounded-2xl">
              <Gauge className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  Engine Hours & Cruising Milestones
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                  {db.vessel.engineMakeModel || 'Main Propulsion'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Track running hours progression, cruising velocity, and scheduled service intervals.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Primary Gauge Bar & Action Buttons */}
          <div className="bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Current Master Hour Meter
                </span>
                {calibratingHourMeter ? (
                  <form onSubmit={handleCalibrateHourMeter} className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      step="0.1"
                      autoFocus
                      value={hourMeterInput}
                      onChange={(e) => setHourMeterInput(e.target.value)}
                      className="w-36 bg-slate-900 border border-amber-500 rounded-xl px-3 py-1.5 text-xl font-bold font-mono text-white focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalibratingHourMeter(false)}
                      className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-xl hover:bg-slate-700 transition"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <div className="flex items-baseline gap-3 mt-0.5">
                    <span className="text-4xl font-black font-mono tracking-tight text-white">
                      {currentHours.toFixed(1)}
                    </span>
                    <span className="text-lg font-bold text-amber-400">HOURS</span>
                    <button
                      onClick={() => {
                        setHourMeterInput(String(currentHours));
                        setCalibratingHourMeter(true);
                      }}
                      className="text-xs text-sky-400 hover:text-sky-300 underline underline-offset-2 ml-1"
                    >
                      Calibrate
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 font-medium">
                  <span>Vessel: {db.vessel.name}</span>
                  {db.vessel.engineSerial && <span>• S/N: {db.vessel.engineSerial}</span>}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setNewHours(String(currentHours));
                    setShowAddForm((prev) => !prev);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>{showAddForm ? 'Close Check-in' : 'Log Hour Meter Reading'}</span>
                </button>
              </div>
            </div>

            {/* Quick Check-in Inline Drawer */}
            {showAddForm && (
              <form
                onSubmit={handleSaveReading}
                className="mt-5 pt-4 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800 animate-in fade-in duration-150"
              >
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Check-in Date
                  </label>
                  <input
                    type="date"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Hour Meter Reading (hrs)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={newHours}
                    onChange={(e) => setNewHours(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Milestone / Log Note (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Passage arrival, Season opening"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-lg shadow transition"
                  >
                    Save Milestone
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* 4 Cruising Velocity & Service Countdown Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Stat 1: Season Run Hours */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-semibold">This Season</span>
                <Compass className="w-4 h-4 text-sky-400" />
              </div>
              <div>
                <span className="text-xl font-black font-mono text-white">
                  +{stats.hoursThisYear.toFixed(1)}
                </span>
                <span className="text-xs text-slate-400 ml-1">hrs</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1">Logged in {new Date().getFullYear()}</span>
            </div>

            {/* Stat 2: 30-Day Usage */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-semibold">30-Day Usage</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <span className="text-xl font-black font-mono text-white">
                  +{stats.hoursPast30.toFixed(1)}
                </span>
                <span className="text-xs text-slate-400 ml-1">hrs</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1">Past 30 days underway</span>
            </div>

            {/* Stat 3: Next 100h Major Milestone */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-semibold">Next 100h Mark</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <span className="text-xl font-black font-mono text-amber-300">
                  {stats.hoursToMajorMilestone.toFixed(1)}
                </span>
                <span className="text-xs text-slate-400 ml-1">hrs to go</span>
              </div>
              <span className="text-[10px] text-slate-500 mt-1">Milestone @ {stats.nextMajorMilestone}h</span>
            </div>

            {/* Stat 4: Upcoming Scheduled Service */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[11px] font-semibold">Next Scheduled Task</span>
                {nextServiceMilestone?.isOverdue ? (
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                ) : (
                  <Wrench className="w-4 h-4 text-teal-400" />
                )}
              </div>
              {nextServiceMilestone ? (
                <div>
                  <div className="flex items-baseline gap-1">
                    <span
                      className={`text-xl font-black font-mono ${
                        nextServiceMilestone.isOverdue ? 'text-rose-400' : 'text-teal-300'
                      }`}
                    >
                      {nextServiceMilestone.isOverdue
                        ? `${Math.abs(nextServiceMilestone.hoursRemaining).toFixed(1)}h over`
                        : `${nextServiceMilestone.hoursRemaining.toFixed(1)}h`}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block truncate mt-1" title={nextServiceMilestone.scheduleTitle}>
                    {nextServiceMilestone.scheduleTitle}
                  </span>
                </div>
              ) : (
                <div>
                  <span className="text-sm font-bold text-slate-400">No hour tasks</span>
                  <span className="text-[10px] text-slate-500 block mt-1">All intervals clear</span>
                </div>
              )}
            </div>
          </div>

          {/* Unified Chronological Progression Timeline */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Chronological Engine Timeline
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  {timeline.length} event{timeline.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-400"></span> Hour Meter
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span> Fuel Dock
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Service
                </span>
              </div>
            </div>

            {timeline.length === 0 ? (
              <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-8 text-center text-slate-500">
                <Gauge className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs font-semibold">No engine progression logs recorded yet.</p>
                <p className="text-[11px] text-slate-600 mt-1">
                  Click "Log Hour Meter Reading" or log fuel fill-ups and maintenance tasks to build your engine history.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {timeline.map((event) => {
                  const isHourMeter = event.type === 'manual';
                  const isFuel = event.type === 'fuel';
                  const isService = event.type === 'service';

                  return (
                    <div
                      key={event.id}
                      className="relative flex items-center justify-between p-3.5 bg-slate-950/60 hover:bg-slate-950 border border-slate-800/80 rounded-2xl transition group"
                    >
                      <div className="flex items-start gap-3.5">
                        {/* Event Type Icon Badge */}
                        <div
                          className={`p-2 rounded-xl mt-0.5 border ${
                            isHourMeter
                              ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                              : isFuel
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          }`}
                        >
                          {isHourMeter && <Gauge className="w-4 h-4" />}
                          {isFuel && <Fuel className="w-4 h-4" />}
                          {isService && <Wrench className="w-4 h-4" />}
                        </div>

                        {/* Event Details */}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white tracking-wide">
                              {event.title}
                            </span>
                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-500" />
                              {event.date}
                            </span>
                          </div>

                          {event.details && (
                            <p className="text-xs text-slate-400 mt-0.5">{event.details}</p>
                          )}
                          {event.note && (
                            <p className="text-xs text-slate-300 italic mt-0.5">"{event.note}"</p>
                          )}
                        </div>
                      </div>

                      {/* Right Side: Hour Meter Value and Interval Delta */}
                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <span className="text-sm font-extrabold font-mono text-white tracking-tight">
                            {event.engineHours.toFixed(1)}h
                          </span>
                          {event.deltaHours !== undefined && (
                            <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                              {event.deltaHours > 0 ? (
                                <span className="text-emerald-400">+{event.deltaHours.toFixed(1)}h run</span>
                              ) : (
                                <span>0.0h</span>
                              )}
                              {event.deltaDays !== undefined && event.deltaDays > 0 && (
                                <span className="text-slate-500 ml-1">over {event.deltaDays}d</span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Delete manual check-in entry if applicable */}
                        {isHourMeter && event.manualLogId && (
                          <button
                            onClick={() => handleDeleteManualLog(event.manualLogId!)}
                            title="Delete manual hour meter milestone"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-sky-400" />
            <span>Chronological deltas calculated automatically across logbook, fuel, and service records.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
