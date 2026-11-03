import React, { useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Compass,
  DollarSign,
  Droplets,
  Flame,
  FlaskConical,
  Fuel,
  Gauge,
  Pencil,
  Plus,
  ShoppingCart,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  CaptainsDatabase,
  FuelLogEntry,
  LinkedPartRequirement,
  PartItem,
} from '../types';
import {
  calculateFuelStats,
  deductFromPartInventory,
  getConsumableTotals,
} from '../utils/vendors';

interface FuelLogViewProps {
  db: CaptainsDatabase;
  onUpdateDb: (updater: (prev: CaptainsDatabase) => CaptainsDatabase) => void;
  onJumpToPart?: (partId: string) => void;
}

export const FuelLogView: React.FC<FuelLogViewProps> = ({
  db,
  onUpdateDb,
  onJumpToPart,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingFuelLog, setEditingFuelLog] = useState<FuelLogEntry | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [engineHours, setEngineHours] = useState(String(db.vessel.currentEngineHours));
  const [gallonsAdded, setGallonsAdded] = useState('');
  const [pricePerGallon, setPricePerGallon] = useState('4.85');
  const [isFullTank, setIsFullTank] = useState(true);
  const [notes, setNotes] = useState('');

  // Multi-additive selection state: map of partId -> amount string (e.g. "0.5")
  const [selectedAdditives, setSelectedAdditives] = useState<Record<string, string>>({});

  // Quick inline new additive creation inside Fuel modal
  const [showNewAdditiveForm, setShowNewAdditiveForm] = useState(false);
  const [newAddName, setNewAddName] = useState('');
  const [newAddPartNum, setNewAddPartNum] = useState('');
  const [newAddUnit, setNewAddUnit] = useState('oz');
  const [newAddBottleSize, setNewAddBottleSize] = useState('16');
  const [newAddMinQty, setNewAddMinQty] = useState('4');
  const [newAddDosageHint, setNewAddDosageHint] = useState('');

  // Collapsible card state (cards start minimized by default and expand when title is clicked)
  const [expandedFuelLogIds, setExpandedFuelLogIds] = useState<Record<string, boolean>>({});

  const toggleFuelLogExpanded = (id: string) => {
    setExpandedFuelLogIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const stats = calculateFuelStats(db.fuelLogs, db.vessel);

  // Only items that are both consumable and Fuel should show up during fuel entry
  const isEngineFuel = (cat?: string) => {
    if (!cat) return false;
    const normalized = cat.trim().toLowerCase().replace(/[\s-_]/g, '');
    return normalized === 'fuel' || normalized === 'enginefuel' || normalized === 'fuelsystem';
  };
  const fuelConsumables = db.parts.filter(
    (p) => p.itemType === 'consumable' && isEngineFuel(p.category)
  );

  const openFillUpModal = () => {
    setEditingFuelLog(null);
    setDate(new Date().toISOString().slice(0, 10));
    setEngineHours(String(db.vessel.currentEngineHours));
    setGallonsAdded('');
    setPricePerGallon('4.85');
    setIsFullTank(true);
    setNotes('');
    const initialMap: Record<string, string> = {};
    fuelConsumables.forEach((fc) => {
      if (fc.quantityOnBoard > 0) {
        initialMap[fc.id] = '1.0';
      }
    });
    setSelectedAdditives(initialMap);
    setShowNewAdditiveForm(false);
    setShowAddModal(true);
  };

  const openEditFuelLogModal = (entry: FuelLogEntry) => {
    setEditingFuelLog(entry);
    setDate(entry.date);
    setEngineHours(String(entry.engineHours));
    setGallonsAdded(String(entry.gallonsAdded));
    setPricePerGallon(entry.pricePerGallon !== undefined ? String(entry.pricePerGallon) : '');
    setIsFullTank(entry.isFullTank);
    setNotes(entry.notes || '');

    const initialMap: Record<string, string> = {};
    if (entry.additivesUsed) {
      entry.additivesUsed.forEach((a) => {
        initialMap[a.partId] = String(a.quantityNeeded);
      });
    }
    setSelectedAdditives(initialMap);
    setShowNewAdditiveForm(false);
    setShowAddModal(true);
  };

  const toggleAdditive = (part: PartItem) => {
    setSelectedAdditives((prev) => {
      const next = { ...prev };
      if (next[part.id] !== undefined) {
        delete next[part.id];
      } else {
        next[part.id] = '1.0';
      }
      return next;
    });
  };

  const updateAdditiveAmount = (partId: string, val: string) => {
    setSelectedAdditives((prev) => ({
      ...prev,
      [partId]: val,
    }));
  };

  const handleCreateQuickAdditive = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddName.trim()) return;
    const bottleSize = parseFloat(newAddBottleSize) || 16;
    const minQty = parseFloat(newAddMinQty) || 4;
    const newId = 'part-add-' + Date.now();

    const today = new Date().toISOString().slice(0, 10);
    const created: PartItem = {
      id: newId,
      name: newAddName.trim(),
      itemType: 'consumable',
      unit: newAddUnit.trim() || 'oz',
      containerSize: bottleSize,
      containers: [
        {
          id: `cont-${newId}-1`,
          datePurchased: today,
          containerSize: bottleSize,
          quantityRemaining: bottleSize,
        },
      ],
      dosageHint: newAddDosageHint.trim() || undefined,
      category: 'Fuel',
      equipmentModel: db.vessel.fuelType === 'gasoline' ? 'Gasoline Fuel Tank Treatment' : 'Diesel Fuel Tank Treatment',
      oemPartNumber: newAddPartNum.trim() || newAddName.trim().toUpperCase().replace(/\s+/g, '-'),
      crossRefNumbers: [],
      quantityOnBoard: bottleSize,
      minQuantity: minQty,
      datePurchased: today,
      locationOnBoat: 'Lazarette Fuel Locker',
    };

    onUpdateDb((prev) => ({
      ...prev,
      parts: [created, ...prev.parts],
    }));

    setSelectedAdditives((prev) => ({
      ...prev,
      [newId]: '1.0',
    }));

    setNewAddName('');
    setNewAddPartNum('');
    setNewAddDosageHint('');
    setShowNewAdditiveForm(false);
  };

  const handleSaveFuelLog = (e: React.FormEvent) => {
    e.preventDefault();
    const gals = parseFloat(gallonsAdded);
    const hrs = parseFloat(engineHours);
    if (!gals || gals <= 0 || isNaN(hrs)) return;
    const ppg = parseFloat(pricePerGallon) || undefined;
    const totalCost = ppg ? Number((gals * ppg).toFixed(2)) : undefined;

    const additivesUsed: LinkedPartRequirement[] = [];
    for (const [partId, amtStr] of Object.entries(selectedAdditives)) {
      const qty = parseFloat(amtStr);
      const part = db.parts.find((p) => p.id === partId);
      if (qty && qty > 0 && part) {
        additivesUsed.push({
          partId,
          quantityNeeded: Number(qty.toFixed(2)),
          nameSnapshot: part.name,
          unitSnapshot: part.unit || 'oz',
        });
      }
    }

    if (editingFuelLog) {
      onUpdateDb((prev) => ({
        ...prev,
        vessel: {
          ...prev.vessel,
          currentEngineHours: Math.max(prev.vessel.currentEngineHours, hrs),
          lastUpdated: date,
        },
        fuelLogs: prev.fuelLogs.map((f) =>
          f.id === editingFuelLog.id
            ? {
                ...f,
                date,
                engineHours: hrs,
                gallonsAdded: gals,
                pricePerGallon: ppg,
                totalCost,
                isFullTank,
                biocideAdded: additivesUsed.length > 0,
                additivesUsed,
                notes: notes.trim() || 'Fuel dock fill-up',
              }
            : f
        ),
      }));
    } else {
      const entry: FuelLogEntry = {
        id: 'fuel-' + Date.now(),
        date,
        engineHours: hrs,
        gallonsAdded: gals,
        pricePerGallon: ppg,
        totalCost,
        isFullTank,
        biocideAdded: additivesUsed.length > 0,
        additivesUsed,
        notes: notes.trim() || 'Fuel dock fill-up',
      };

      onUpdateDb((prev) => {
        // Deduct used additives from on-board inventory (FIFO across containers)
        const updatedParts = prev.parts.map((part) => {
          const used = additivesUsed.find((a) => a.partId === part.id);
          if (!used) return part;
          return deductFromPartInventory(part, used.quantityNeeded);
        });

        return {
          ...prev,
          vessel: {
            ...prev.vessel,
            currentEngineHours: Math.max(prev.vessel.currentEngineHours, hrs),
            lastUpdated: date,
          },
          fuelLogs: [...prev.fuelLogs, entry],
          parts: updatedParts,
        };
      });
    }

    setEditingFuelLog(null);
    setGallonsAdded('');
    setNotes('');
    setShowAddModal(false);
  };

  const handleDeleteFuel = (id: string) => {
    onUpdateDb((prev) => ({
      ...prev,
      fuelLogs: prev.fuelLogs.filter((f) => f.id !== id),
    }));
  };

  const isGasoline = db.vessel.fuelType === 'gasoline';
  const fuelTypeFullLabel = isGasoline ? 'Gasoline' : 'Diesel';

  const tankColor =
    stats.estimatedTankPercent <= 25
      ? 'bg-rose-500'
      : stats.estimatedTankPercent <= 45
      ? 'bg-amber-500'
      : 'bg-sky-500';

  return (
    <div className="space-y-4">
      {/* Live Fuel Tank & Burn Rate Estimator Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
              <Fuel className="w-3.5 h-3.5" />
              Estimated {fuelTypeFullLabel} Tank Level
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-extrabold text-white">
                {stats.estimatedGallonsRemaining} gal
              </span>
              <span className="text-sm text-slate-400">
                / {db.vessel.fuelCapacityGallons} gal ({stats.estimatedTankPercent}%)
              </span>
            </div>
          </div>

          <button
            onClick={openFillUpModal}
            className="flex items-center gap-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs px-3.5 py-2.5 rounded-xl transition shadow"
          >
            <Plus className="w-4 h-4" />
            Log Fill-Up
          </button>
        </div>

        {/* Visual Tank Gauge */}
        <div className="space-y-1">
          <div className="w-full h-4 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
            <div
              className={`h-full rounded-full transition-all ${tankColor}`}
              style={{ width: `${Math.max(4, stats.estimatedTankPercent)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 font-mono">
            <span>Empty (0 gal)</span>
            <span>1/4 Reserve</span>
            <span>1/2 Tank</span>
            <span>3/4</span>
            <span>Full ({db.vessel.fuelCapacityGallons}g)</span>
          </div>
        </div>

        {/* 4 Fuel Efficiency & Range Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 space-y-0.5">
            <div className="text-[11px] text-slate-400 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              Avg Burn Rate
            </div>
            <div className="text-base font-bold text-slate-100 font-mono">
              {stats.averageBurnRateGph}{' '}
              <span className="text-xs font-normal text-slate-400">GPH</span>
            </div>
            <div className="text-[10px] font-medium flex items-center gap-0.5">
              {stats.burnRateVarianceGph > 0 ? (
                <span className="text-amber-400 flex items-center">
                  <TrendingUp className="w-3 h-3 mr-0.5" />
                  +{stats.burnRateVarianceGph} vs spec
                </span>
              ) : stats.burnRateVarianceGph < 0 ? (
                <span className="text-emerald-400 flex items-center">
                  <TrendingDown className="w-3 h-3 mr-0.5" />
                  {stats.burnRateVarianceGph} vs spec
                </span>
              ) : (
                <span className="text-slate-400">On spec ({stats.baselineBurnRateGph})</span>
              )}
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 space-y-0.5">
            <div className="text-[11px] text-slate-400 flex items-center gap-1">
              <Gauge className="w-3.5 h-3.5 text-emerald-400" />
              Est. Range Left
            </div>
            <div className="text-base font-bold text-emerald-300 font-mono">
              ~{stats.estimatedMotoringHoursLeft}{' '}
              <span className="text-xs font-normal text-slate-400">hrs</span>
            </div>
            <div className="text-[10px] text-emerald-400/80 flex items-center gap-0.5">
              <Compass className="w-3 h-3 text-emerald-400" />
              <span>~{stats.estimatedNauticalMilesRange} NM @ 5.8 kts</span>
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 space-y-0.5">
            <div className="text-[11px] text-slate-400 flex items-center gap-1">
              <Droplets className="w-3.5 h-3.5 text-sky-400" />
              Since Last Fill
            </div>
            <div className="text-base font-bold text-slate-100 font-mono">
              {stats.hoursSinceLastFill}{' '}
              <span className="text-xs font-normal text-slate-400">hrs</span>
            </div>
            <div className="text-[10px] text-slate-400">
              ~{(stats.hoursSinceLastFill * stats.averageBurnRateGph).toFixed(1)} gal burned
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 space-y-0.5">
            <div className="text-[11px] text-slate-400 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              Operating Cost
            </div>
            <div className="text-base font-bold text-emerald-400 font-mono">
              ${stats.costPerEngineHour}{' '}
              <span className="text-xs font-normal text-slate-400">/ hr</span>
            </div>
            <div className="text-[10px] text-slate-400">
              ${stats.totalFuelSpend.toFixed(0)} total logged
            </div>
          </div>
        </div>
      </div>

      {/* Fuel Additives On-Board Inventory Strip */}
      {fuelConsumables.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-3.5 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
              <FlaskConical className="w-3.5 h-3.5 shrink-0" />
              <span>Fuel Additives On Board</span>
            </span>
            <span className="text-[11px] text-slate-400">
              Tap item to view prices / reorder
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {fuelConsumables.map((item) => {
              const totals = getConsumableTotals(item);
              const isTracked = item.trackQuantity !== false;
              const isLow = isTracked && totals.totalRemaining <= item.minQuantity;
              const pct = totals.fillPercent;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onJumpToPart && onJumpToPart(item.id)}
                  className={`text-left p-2.5 rounded-xl border transition space-y-1.5 ${
                    isLow
                      ? 'bg-rose-950/30 border-rose-700/60 hover:border-rose-500'
                      : 'bg-slate-950/80 border-slate-800 hover:border-sky-500/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-slate-100 leading-snug">
                      {item.name}
                    </span>
                    <span
                      className={`text-xs font-extrabold font-mono shrink-0 ${
                        isLow ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {item.quantityOnBoard} {item.unit || 'oz'}
                    </span>
                  </div>

                  <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${isLow ? 'bg-rose-500' : 'bg-teal-500'}`}
                      style={{ width: `${Math.max(5, pct)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>{item.dosageHint || `Min: ${item.minQuantity} ${item.unit || 'oz'}`}</span>
                    {isLow && (
                      <span className="text-rose-300 font-bold flex items-center gap-1">
                        <ShoppingCart className="w-3 h-3" />
                        Buy More
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Lifetime Fuel Additives Consumed Breakdown */}
      {Object.keys(stats.totalAdditivesUsed).length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
            <FlaskConical className="w-3.5 h-3.5" />
            Lifetime Additives Consumed:
          </span>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.totalAdditivesUsed).map(([partId, item]) => (
              <span
                key={partId}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-300 font-medium"
              >
                {item.name}: <strong className="font-mono text-teal-300">{item.quantity} {item.unit}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Fuel Log History List */}
      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Fuel Dock Logbook ({stats.logsWithStats.length} entries • {stats.totalGallonsLogged} gal total)
          </h3>
          <span className="text-xs text-slate-400">
            Total Spend:{' '}
            <strong className="text-emerald-400">${stats.totalFuelSpend.toFixed(2)}</strong>
          </span>
        </div>

        {stats.logsWithStats.map(({ entry, hoursSincePrev, calculatedGph }) => {
          const isFuelLogExpanded = Boolean(expandedFuelLogIds[entry.id]);
          return (
          <div
            key={entry.id}
            className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2.5"
          >
            <div className="flex items-start justify-between gap-2">
              <button
                type="button"
                onClick={() => toggleFuelLogExpanded(entry.id)}
                className="text-left flex-1 min-w-0 group cursor-pointer"
                title={isFuelLogExpanded ? 'Click to collapse fuel entry' : 'Click to expand fuel entry'}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-white group-hover:text-sky-300 transition flex items-center gap-1.5">
                    {isFuelLogExpanded ? (
                      <ChevronDown className="w-4 h-4 text-sky-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-sky-400 shrink-0" />
                    )}
                    <span>{entry.date}</span>
                  </span>
                  <span className="text-xs font-mono bg-slate-800 text-sky-300 px-2 py-0.5 rounded">
                    @ {entry.engineHours} hrs
                  </span>
                </div>
              </button>

              <div className="text-right shrink-0">
                <div className="text-base font-extrabold text-sky-400 font-mono">
                  +{entry.gallonsAdded} gal
                </div>
                {entry.totalCost !== undefined && (
                  <div className="text-xs text-emerald-400 font-semibold">
                    ${entry.totalCost.toFixed(2)}{' '}
                    {entry.pricePerGallon ? `($${entry.pricePerGallon}/g)` : ''}
                  </div>
                )}
              </div>
            </div>

            {isFuelLogExpanded && (
              <>
            <p className="text-xs text-slate-300">{entry.notes}</p>

            {/* Display all user-defined additives used in this fill-up */}
            {entry.additivesUsed && entry.additivesUsed.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {entry.additivesUsed.map((add, idx) => {
                  const part = db.parts.find((p) => p.id === add.partId);
                  const label = add.nameSnapshot || part?.name || add.partId;
                  const unit = add.unitSnapshot || part?.unit || 'oz';
                  return (
                    <button
                      key={`${add.partId}-${idx}`}
                      type="button"
                      onClick={() => part && onJumpToPart && onJumpToPart(part.id)}
                      className="text-[11px] bg-teal-500/15 hover:bg-teal-500/25 text-teal-200 border border-teal-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 transition"
                    >
                      <FlaskConical className="w-3 h-3 text-teal-400" />
                      <span>{label}:</span>
                      <strong className="font-mono text-white">
                        {add.quantityNeeded} {unit}
                      </strong>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs text-slate-400">
              <div className="flex items-center gap-3">
                {hoursSincePrev !== undefined && (
                  <span>
                    Run Interval: <strong className="text-slate-200">{hoursSincePrev} hrs</strong>
                  </span>
                )}
                {calculatedGph !== undefined && (
                  <span>
                    Measured Burn:{' '}
                    <strong className="text-amber-300 font-mono">{calculatedGph} GPH</strong>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => openEditFuelLogModal(entry)}
                  className="p-1.5 text-slate-400 hover:text-sky-300 rounded hover:bg-slate-800 transition"
                  title="Edit fuel entry"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteFuel(entry.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-400 rounded hover:bg-rose-500/10 transition"
                  title="Delete fuel entry"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
              </>
            )}
          </div>
          );
        })}
      </div>

      {/* Modal: Log / Edit Fuel Fill-Up with Multi-Additive Consumable Selector */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl my-auto">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Fuel className="w-5 h-5 text-sky-400" />
              {editingFuelLog ? 'Edit Fuel Fill-Up' : `Log ${fuelTypeFullLabel} Fill-Up`}
            </h3>

            <form onSubmit={handleSaveFuelLog} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Engine Hours</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={engineHours}
                    onChange={(e) => setEngineHours(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Gallons Added</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="e.g., 16.0"
                    value={gallonsAdded}
                    onChange={(e) => setGallonsAdded(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Price / Gallon ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="4.85"
                    value={pricePerGallon}
                    onChange={(e) => setPricePerGallon(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-200 bg-slate-950 p-2.5 rounded-lg border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFullTank}
                  onChange={(e) => setIsFullTank(e.target.checked)}
                  className="rounded text-sky-500"
                />
                <span>Tank Topped Off (Full — calculates exact GPH burn rate)</span>
              </label>

              {/* Multi-Consumable / Fuel Additive Picker */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-400 flex items-center gap-1.5">
                    <FlaskConical className="w-3.5 h-3.5" />
                    Additives & Consumables Used
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowNewAdditiveForm((v) => !v)}
                    className="text-[11px] font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    {showNewAdditiveForm ? 'Close' : 'New Additive'}
                  </button>
                </div>

                {/* Inline Quick-Add New Additive Subform */}
                {showNewAdditiveForm && (
                  <div className="bg-slate-900 border border-sky-500/40 rounded-lg p-3 space-y-2">
                    <div className="text-xs font-bold text-sky-300">
                      Create New Tracked Fuel Additive
                    </div>
                    <input
                      type="text"
                      placeholder={
                        isGasoline
                          ? 'Additive Name (e.g., Sta-Bil Marine, Star Tron)'
                          : 'Additive Name (e.g., Stanadyne Performance Formula, Biobor)'
                      }
                      value={newAddName}
                      onChange={(e) => setNewAddName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-400">Bottle Qty</label>
                        <input
                          type="number"
                          step="0.5"
                          value={newAddBottleSize}
                          onChange={(e) => setNewAddBottleSize(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400">Unit</label>
                        <input
                          type="text"
                          value={newAddUnit}
                          onChange={(e) => setNewAddUnit(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400">Reorder At</label>
                        <input
                          type="number"
                          step="0.5"
                          value={newAddMinQty}
                          onChange={(e) => setNewAddMinQty(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Part # (for price lookup)"
                        value={newAddPartNum}
                        onChange={(e) => setNewAddPartNum(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
                      />
                      <input
                        type="text"
                        placeholder="Dosage (e.g. 1 oz / 15 gal)"
                        value={newAddDosageHint}
                        onChange={(e) => setNewAddDosageHint(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleCreateQuickAdditive}
                      className="w-full bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs py-1.5 rounded transition"
                    >
                      Add to Inventory & Select
                    </button>
                  </div>
                )}

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {fuelConsumables.length === 0 ? (
                    <div className="text-center py-4 px-3 text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
                      <p className="font-semibold text-slate-400">No Fuel consumables on board</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Use "+ Quick Add Treatment" above or add fuel additives in the Parts Catalog.
                      </p>
                    </div>
                  ) : (
                    fuelConsumables.map((item) => {
                      const isChecked = selectedAdditives[item.id] !== undefined;
                      const unit = item.unit || 'oz';
                      const isTracked = item.trackQuantity !== false;
                      const isLow = isTracked && item.quantityOnBoard <= item.minQuantity;

                      return (
                        <div
                          key={item.id}
                          className={`p-2 rounded-lg border transition ${
                            isChecked
                              ? 'bg-teal-950/30 border-teal-500/50'
                              : 'bg-slate-900/70 border-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <label className="flex items-center gap-2 text-xs text-slate-100 cursor-pointer flex-1">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleAdditive(item)}
                                className="rounded text-teal-500"
                              />
                            <div>
                              <div className="font-semibold leading-tight">{item.name}</div>
                              <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                <span>
                                  {isTracked ? (
                                    <>
                                      On board:{' '}
                                      <strong
                                        className={isLow ? 'text-rose-400' : 'text-emerald-400'}
                                      >
                                        {item.quantityOnBoard} {unit}
                                      </strong>
                                    </>
                                  ) : (
                                    <span className="text-slate-400">Untracked reference</span>
                                  )}
                                </span>
                                {item.dosageHint && <span>• {item.dosageHint}</span>}
                              </div>
                            </div>
                          </label>

                          {isChecked && (
                            <div className="flex items-center gap-1 shrink-0">
                              <input
                                type="number"
                                step="0.1"
                                min="0.1"
                                value={selectedAdditives[item.id]}
                                onChange={(e) => updateAdditiveAmount(item.id, e.target.value)}
                                className="w-16 bg-slate-950 border border-teal-500 rounded px-2 py-1 text-xs font-mono text-white text-right"
                              />
                              <span className="text-xs text-teal-300 font-mono">{unit}</span>
                            </div>
                          )}
                        </div>

                        {isChecked &&
                          isTracked &&
                          parseFloat(selectedAdditives[item.id] || '0') > item.quantityOnBoard && (
                            <div className="text-[10px] text-amber-300 flex items-center gap-1 mt-1">
                              <AlertTriangle className="w-3 h-3" />
                              Exceeds current on-board stock ({item.quantityOnBoard} {unit}) — stock will hit 0.
                            </div>
                          )}
                      </div>
                    );
                  })
                )}
              </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Location / Sea State / Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g., Marina fuel dock, Racor bowl clean"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingFuelLog(null);
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950"
                >
                  {editingFuelLog ? 'Save Changes' : 'Save & Deduct Additives'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
