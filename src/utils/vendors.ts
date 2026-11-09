import { FuelLogEntry, MaintenanceSchedule, PartItem, VesselProfile } from '../types';

export interface VendorSearchLink {
  id: string;
  name: string;
  shortLabel: string;
  badgeColor: string;
  url: string;
  description: string;
}

export function getVendorSearchLinks(part: PartItem, customQuery?: string): VendorSearchLink[] {
  const queryRaw = customQuery?.trim() || part.oemPartNumber.trim() || part.name.trim();
  const q = encodeURIComponent(queryRaw);
  const fullQuery = encodeURIComponent(`${part.equipmentModel} ${queryRaw}`.trim());

  return [
    {
      id: 'defender',
      name: 'Defender Marine',
      shortLabel: 'Defender',
      badgeColor: 'bg-blue-600/20 text-blue-300 border-blue-500/40 hover:bg-blue-600/30',
      url: `https://www.defender.com/search.html?q=${q}`,
      description: 'Discount marine hardware, engine filters & impellers',
    },
    {
      id: 'westmarine',
      name: 'West Marine',
      shortLabel: 'West Marine',
      badgeColor: 'bg-sky-600/20 text-sky-300 border-sky-500/40 hover:bg-sky-600/30',
      url: `https://www.westmarine.com/search?q=${q}`,
      description: 'Local store pickup & marine parts catalog',
    },
    {
      id: 'fisheries',
      name: 'Fisheries Supply',
      shortLabel: 'Fisheries Supply',
      badgeColor: 'bg-teal-600/20 text-teal-300 border-teal-500/40 hover:bg-teal-600/30',
      url: `https://www.fisheriessupply.com/sitesearch.aspx?keyword=${q}`,
      description: 'Cruising sailboat systems, Yanmar/Racor & rigging parts',
    },
    {
      id: 'google-shopping',
      name: 'Google Price Compare',
      shortLabel: 'Compare Prices',
      badgeColor: 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-600/30',
      url: `https://www.google.com/search?tbm=shop&q=${fullQuery}`,
      description: 'Compare live online prices across all marine dealers',
    },
    {
      id: 'amazon',
      name: 'Amazon Marine',
      shortLabel: 'Amazon',
      badgeColor: 'bg-amber-600/20 text-amber-300 border-amber-500/40 hover:bg-amber-600/30',
      url: `https://www.amazon.com/s?k=${q}`,
      description: 'Fast shipping on cross-referenced filters, belts & anodes',
    },
    {
      id: 'marineengine',
      name: 'MarineEngine / OEM Lookup',
      shortLabel: 'OEM Search',
      badgeColor: 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 hover:bg-indigo-600/30',
      url: `https://www.google.com/search?q=${encodeURIComponent(`"${queryRaw}" marine part price`)}`,
      description: 'Exact OEM part number web search',
    },
  ];
}

export type ScheduleStatus = 'overdue' | 'due-soon' | 'good' | 'as-needed';

export interface EvaluatedSchedule {
  schedule: MaintenanceSchedule;
  status: ScheduleStatus;
  nextDueHours?: number;
  hoursRemaining?: number;
  nextDueDate?: string;
  daysRemaining?: number;
  progressPercent: number;
  summaryText: string;
}

export function evaluateSchedule(
  schedule: MaintenanceSchedule,
  currentEngineHours: number,
  nowDate: Date = new Date()
): EvaluatedSchedule {
  let nextDueHours: number | undefined;
  let hoursRemaining: number | undefined;
  let hoursProgress = 0;

  if (schedule.intervalHours && schedule.intervalHours > 0) {
    const baseHours = schedule.lastCompletedHours ?? 0;
    nextDueHours = Number((baseHours + schedule.intervalHours).toFixed(1));
    hoursRemaining = Number((nextDueHours - currentEngineHours).toFixed(1));
    const elapsed = Math.max(0, currentEngineHours - baseHours);
    hoursProgress = Math.min(100, Math.round((elapsed / schedule.intervalHours) * 100));
  }

  let nextDueDate: string | undefined;
  let daysRemaining: number | undefined;
  let daysProgress = 0;

  if (schedule.intervalDays && schedule.intervalDays > 0 && schedule.lastCompletedDate) {
    const lastDate = new Date(schedule.lastCompletedDate + 'T00:00:00');
    const due = new Date(lastDate.getTime() + schedule.intervalDays * 86400000);
    nextDueDate = due.toISOString().slice(0, 10);
    const diffMs = due.getTime() - nowDate.getTime();
    daysRemaining = Math.ceil(diffMs / 86400000);
    const elapsedDays = Math.max(0, schedule.intervalDays - daysRemaining);
    daysProgress = Math.min(100, Math.round((elapsedDays / schedule.intervalDays) * 100));
  }

  const hasInterval =
    (schedule.intervalHours && schedule.intervalHours > 0) ||
    (schedule.intervalDays && schedule.intervalDays > 0);

  let status: ScheduleStatus = hasInterval ? 'good' : 'as-needed';
  const isHoursOverdue = hoursRemaining !== undefined && hoursRemaining <= 0;
  const isDaysOverdue = daysRemaining !== undefined && daysRemaining <= 0;

  const isHoursDueSoon =
    hoursRemaining !== undefined &&
    hoursRemaining > 0 &&
    (hoursRemaining <= 15 || hoursProgress >= 85);
  const dueSoonDaysThreshold = schedule.intervalDays
    ? Math.min(30, Math.max(2, Math.round(schedule.intervalDays * 0.2)))
    : 30;
  const isDaysDueSoon =
    daysRemaining !== undefined &&
    daysRemaining > 0 &&
    (daysRemaining <= dueSoonDaysThreshold || daysProgress >= 85);

  if (isHoursOverdue || isDaysOverdue) {
    status = 'overdue';
  } else if (isHoursDueSoon || isDaysDueSoon) {
    status = 'due-soon';
  } else if (!hasInterval) {
    status = 'as-needed';
  }

  const progressPercent = Math.max(hoursProgress, daysProgress);

  const parts: string[] = [];
  if (hoursRemaining !== undefined) {
    if (hoursRemaining < 0) {
      parts.push(`${Math.abs(hoursRemaining)} hrs overdue (due @ ${nextDueHours}h)`);
    } else {
      parts.push(`In ${hoursRemaining} hrs (due @ ${nextDueHours}h)`);
    }
  }
  if (daysRemaining !== undefined) {
    if (daysRemaining < 0) {
      parts.push(`${Math.abs(daysRemaining)}d overdue (${nextDueDate})`);
    } else {
      parts.push(`In ${daysRemaining}d (${nextDueDate})`);
    }
  }

  return {
    schedule,
    status,
    nextDueHours,
    hoursRemaining,
    nextDueDate,
    daysRemaining,
    progressPercent,
    summaryText:
      parts.join(' • ') ||
      (hasInterval
        ? 'No prior completion date'
        : schedule.lastCompletedDate
        ? `Completed ${schedule.lastCompletedDate}${schedule.lastCompletedHours !== undefined ? ` @ ${schedule.lastCompletedHours}h` : ''}`
        : 'As-Needed / Event-Driven (N/A Interval)'),
  };
}

export interface FuelLogWithStats {
  entry: FuelLogEntry;
  hoursSincePrev?: number;
  calculatedGph?: number;
}

export interface FuelSummaryStats {
  logsWithStats: FuelLogWithStats[];
  averageBurnRateGph: number;
  baselineBurnRateGph: number;
  burnRateVarianceGph: number;
  burnRateVariancePercent: number;
  estimatedGallonsRemaining: number;
  estimatedTankPercent: number;
  estimatedMotoringHoursLeft: number;
  estimatedNauticalMilesRange: number;
  costPerEngineHour: number;
  hoursSinceLastFill: number;
  totalGallonsLogged: number;
  totalFuelSpend: number;
  totalAdditivesUsed: Record<string, { name: string; quantity: number; unit: string }>;
}

export function calculateFuelStats(
  fuelLogs: FuelLogEntry[],
  vessel: VesselProfile
): FuelSummaryStats {
  // Sort chronologically ascending (date then engine hours) for delta calculation
  const sortedAsc = [...fuelLogs].sort((a, b) => {
    const dateDiff = (a.date || '').localeCompare(b.date || '');
    if (dateDiff !== 0) return dateDiff;
    if (a.engineHours !== b.engineHours) return a.engineHours - b.engineHours;
    return a.id.localeCompare(b.id);
  });

  const logsWithStatsAsc: FuelLogWithStats[] = [];
  const validGphs: number[] = [];

  for (let i = 0; i < sortedAsc.length; i++) {
    const current = sortedAsc[i];
    if (i === 0) {
      logsWithStatsAsc.push({ entry: current });
      continue;
    }
    const prev = sortedAsc[i - 1];
    const hoursDelta = Number((current.engineHours - prev.engineHours).toFixed(1));
    let calculatedGph: number | undefined;
    if (hoursDelta > 0 && current.gallonsAdded > 0) {
      calculatedGph = Number((current.gallonsAdded / hoursDelta).toFixed(2));
      if (calculatedGph > 0.05 && calculatedGph < 5.0) {
        validGphs.push(calculatedGph);
      }
    }
    logsWithStatsAsc.push({
      entry: current,
      hoursSincePrev: hoursDelta > 0 ? hoursDelta : undefined,
      calculatedGph,
    });
  }

  const averageBurnRateGph =
    validGphs.length > 0
      ? Number((validGphs.reduce((s, v) => s + v, 0) / validGphs.length).toFixed(2))
      : vessel.defaultBurnRateGph || 0.65;

  const baselineBurnRateGph = vessel.defaultBurnRateGph || 0.65;
  const burnRateVarianceGph = Number((averageBurnRateGph - baselineBurnRateGph).toFixed(2));
  const burnRateVariancePercent =
    baselineBurnRateGph > 0
      ? Number(((burnRateVarianceGph / baselineBurnRateGph) * 100).toFixed(1))
      : 0;

  const latestLog = sortedAsc[sortedAsc.length - 1];
  const hoursSinceLastFill = latestLog
    ? Math.max(0, Number((vessel.currentEngineHours - latestLog.engineHours).toFixed(1)))
    : 0;

  const gallonsBurnedSinceFill = hoursSinceLastFill * averageBurnRateGph;
  const estimatedGallonsRemaining = Math.max(
    0,
    Number((vessel.fuelCapacityGallons - gallonsBurnedSinceFill).toFixed(1))
  );
  const estimatedTankPercent =
    vessel.fuelCapacityGallons > 0
      ? Math.min(100, Math.max(0, Math.round((estimatedGallonsRemaining / vessel.fuelCapacityGallons) * 100)))
      : 0;

  const estimatedMotoringHoursLeft =
    averageBurnRateGph > 0
      ? Number((estimatedGallonsRemaining / averageBurnRateGph).toFixed(1))
      : 0;

  const cruisingSpeedKnots = 5.8;
  const estimatedNauticalMilesRange = Math.round(estimatedMotoringHoursLeft * cruisingSpeedKnots);

  const totalGallonsLogged = Number(
    fuelLogs.reduce((sum, item) => sum + (item.gallonsAdded || 0), 0).toFixed(1)
  );
  const totalFuelSpend = Number(
    fuelLogs
      .reduce((sum, item) => sum + (item.totalCost ?? (item.gallonsAdded * (item.pricePerGallon || 0))), 0)
      .toFixed(2)
  );

  const totalEngineHoursCovered =
    sortedAsc.length >= 2
      ? Number((sortedAsc[sortedAsc.length - 1].engineHours - sortedAsc[0].engineHours).toFixed(1))
      : 0;

  const costPerEngineHour =
    totalEngineHoursCovered > 0
      ? Number((totalFuelSpend / totalEngineHoursCovered).toFixed(2))
      : Number((averageBurnRateGph * 4.85).toFixed(2));

  const totalAdditivesUsed: Record<string, { name: string; quantity: number; unit: string }> = {};
  for (const log of fuelLogs) {
    if (log.additivesUsed) {
      for (const a of log.additivesUsed) {
        if (!totalAdditivesUsed[a.partId]) {
          totalAdditivesUsed[a.partId] = {
            name: a.nameSnapshot || a.partId,
            quantity: 0,
            unit: a.unitSnapshot || 'oz',
          };
        }
        totalAdditivesUsed[a.partId].quantity = Number(
          (totalAdditivesUsed[a.partId].quantity + a.quantityNeeded).toFixed(2)
        );
      }
    }
  }

  return {
    logsWithStats: logsWithStatsAsc.reverse(), // most recent first for UI
    averageBurnRateGph,
    baselineBurnRateGph,
    burnRateVarianceGph,
    burnRateVariancePercent,
    estimatedGallonsRemaining,
    estimatedTankPercent,
    estimatedMotoringHoursLeft,
    estimatedNauticalMilesRange,
    costPerEngineHour,
    hoursSinceLastFill,
    totalGallonsLogged,
    totalFuelSpend,
    totalAdditivesUsed,
  };
}

/**
 * Computes combined totals across all containers of a consumable item,
 * or falls back to top-level quantityOnBoard / containerSize.
 */
export function getConsumableTotals(part: PartItem): {
  totalRemaining: number;
  totalCapacity: number;
  fillPercent: number;
} {
  if (part.containers && part.containers.length > 0) {
    const totalRemaining = Number(
      part.containers.reduce((sum, c) => sum + (c.quantityRemaining || 0), 0).toFixed(2)
    );
    const totalCapacity = Number(
      part.containers.reduce((sum, c) => sum + (c.containerSize || 0), 0).toFixed(2)
    );
    const fillPercent =
      totalCapacity > 0
        ? Math.min(100, Math.round((totalRemaining / totalCapacity) * 100))
        : 0;
    return { totalRemaining, totalCapacity, fillPercent };
  }

  const totalRemaining = Number((part.quantityOnBoard || 0).toFixed(2));
  const totalCapacity = part.containerSize || Math.max(totalRemaining, part.minQuantity * 2, 1);
  const fillPercent =
    totalCapacity > 0
      ? Math.min(100, Math.round((totalRemaining / totalCapacity) * 100))
      : 0;
  return { totalRemaining, totalCapacity, fillPercent };
}

/**
 * Deducts `amountToDeduct` from a part or multi-container consumable using FIFO
 * (oldest `datePurchased` container first) and keeps `quantityOnBoard` synchronized
 * as the sum of all container quantities.
 */
export function deductFromPartInventory(part: PartItem, amountToDeduct: number): PartItem {
  if (amountToDeduct <= 0) return part;

  if (part.itemType === 'consumable' && part.containers && part.containers.length > 0) {
    let remainingToDeduct = amountToDeduct;
    // Sort oldest purchase date first so active/oldest bottles are drained first
    const sorted = [...part.containers].sort((a, b) =>
      (a.datePurchased || '').localeCompare(b.datePurchased || '')
    );

    const updatedContainers = sorted.map((c) => {
      if (remainingToDeduct <= 0 || c.quantityRemaining <= 0) return c;
      const take = Math.min(c.quantityRemaining, remainingToDeduct);
      remainingToDeduct = Number((remainingToDeduct - take).toFixed(2));
      return {
        ...c,
        quantityRemaining: Math.max(0, Number((c.quantityRemaining - take).toFixed(2))),
      };
    });

    const newTotal = Number(
      updatedContainers.reduce((sum, c) => sum + c.quantityRemaining, 0).toFixed(2)
    );

    return {
      ...part,
      containers: updatedContainers,
      quantityOnBoard: newTotal,
    };
  }

  return {
    ...part,
    quantityOnBoard: Math.max(0, Number((part.quantityOnBoard - amountToDeduct).toFixed(2))),
  };
}

/**
 * Resizes and compresses an uploaded image file to a compact JPEG data URL
 * so photos store cleanly in IndexedDB, JSON disk backups, and Supabase sync.
 */
export function compressImageFile(
  file: File,
  maxDimension = 1024,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const rawDataUrl = reader.result as string;
      const img = new Image();
      img.onerror = () => resolve(rawDataUrl);
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width >= height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(rawDataUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        } catch {
          resolve(rawDataUrl);
        }
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}



