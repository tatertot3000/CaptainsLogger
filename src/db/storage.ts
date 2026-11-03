import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { CaptainsDatabase, PartItem, MaintenanceSchedule, VesselManual, SailTrip } from '../types';
import { IS_DEMO_MODE } from '../utils/demoMode';

const STORAGE_KEY = 'captains_logger_snapshot_v1';
const IDB_NAME = 'CaptainsLoggerDB';
const IDB_STORE = 'snapshots';

export const DEFAULT_CONSUMABLE_ITEMS: PartItem[] = [
  {
    id: 'part-biobor',
    name: 'Biobor JF Diesel Microbicide & Lubricity Additive',
    itemType: 'consumable',
    unit: 'oz',
    containerSize: 16,
    containers: [
      {
        id: 'cont-biobor-1',
        datePurchased: '2026-03-14',
        containerSize: 8,
        quantityRemaining: 2.5,
        pricePaid: 13.5,
      },
      {
        id: 'cont-biobor-2',
        datePurchased: '2026-08-18',
        containerSize: 16,
        quantityRemaining: 16.0,
        pricePaid: 21.99,
      },
    ],
    dosageHint: '0.5 oz per 15 gal diesel (shock: 1 oz / 15 gal)',
    category: 'Fuel',
    equipmentModel: 'Diesel Fuel Tank Treatment',
    oemPartNumber: 'BIOBOR-JF-16OZ',
    crossRefNumbers: ['Biobor JF 16oz', 'Star brite Bio Diesel Treat'],
    quantityOnBoard: 18.5,
    minQuantity: 4,
    datePurchased: '2026-08-18',
    lastPricePaid: 21.99,
    locationOnBoat: 'Lazarette Fuel Locker',
    notes: 'Prevents diesel algae/sludge growth and lubricates fuel injection pump.',
  },
  {
    id: 'part-startron',
    name: 'Star Tron Enzyme Fuel Treatment & Cetane Improver',
    itemType: 'consumable',
    unit: 'oz',
    containerSize: 16,
    containers: [
      {
        id: 'cont-startron-1',
        datePurchased: '2026-04-02',
        containerSize: 16,
        quantityRemaining: 3.0,
        pricePaid: 16.95,
      },
    ],
    dosageHint: '1 oz per 16 gal diesel',
    category: 'Fuel',
    equipmentModel: 'Diesel Fuel Tank Treatment',
    oemPartNumber: '093016',
    crossRefNumbers: ['Star brite 93016', 'Stanadyne Performance Formula'],
    quantityOnBoard: 3.0,
    minQuantity: 4,
    datePurchased: '2026-04-02',
    lastPricePaid: 16.95,
    locationOnBoat: 'Lazarette Fuel Locker',
    notes: 'Disperses water and stabilizes diesel fuel during storage.',
  },
  {
    id: 'part-water-freshener',
    name: 'Star brite Aqua Water Tank & System Freshener',
    itemType: 'consumable',
    unit: 'oz',
    containerSize: 16,
    containers: [
      {
        id: 'cont-water-1',
        datePurchased: '2026-05-10',
        containerSize: 16,
        quantityRemaining: 4.0,
        pricePaid: 12.49,
      },
      {
        id: 'cont-water-2',
        datePurchased: '2026-09-12',
        containerSize: 32,
        quantityRemaining: 32.0,
        pricePaid: 21.95,
      },
    ],
    dosageHint: '1 oz per 20 gal fresh water (2 oz for 40 gal tank)',
    category: 'Plumbing & Water',
    equipmentModel: 'Freshwater Tanks (Port & Starboard)',
    oemPartNumber: '032316',
    crossRefNumbers: ['Star brite 32316', 'Aquabon Water Tank Tasteless'],
    quantityOnBoard: 36.0,
    minQuantity: 4,
    datePurchased: '2026-09-12',
    lastPricePaid: 21.95,
    locationOnBoat: 'Galley Sink Locker',
    notes: 'Keeps drinking water tasting fresh and prevents chlorine/plastic taste.',
  },
  {
    id: 'part-rotella-oil',
    name: 'Shell Rotella T4 15W-40 Heavy Duty Diesel Engine Oil',
    itemType: 'consumable',
    unit: 'liters',
    containerSize: 4,
    containers: [
      {
        id: 'cont-rotella-1',
        datePurchased: '2026-04-10',
        containerSize: 4,
        quantityRemaining: 1.2,
        pricePaid: 24.99,
      },
      {
        id: 'cont-rotella-2',
        datePurchased: '2026-09-25',
        containerSize: 5,
        quantityRemaining: 5.0,
        pricePaid: 29.99,
      },
    ],
    dosageHint: '2.8 liters per oil & filter change',
    category: 'Lubrication',
    equipmentModel: 'Yanmar 3YM30',
    oemPartNumber: 'ROTELLA-T4-15W40',
    crossRefNumbers: ['Yanmar 15W-40 Marine Oil', 'Chevron Delo 400 15W-40'],
    quantityOnBoard: 6.2,
    minQuantity: 3,
    datePurchased: '2026-09-25',
    lastPricePaid: 29.99,
    locationOnBoat: 'Port Settee Engine Spares Bin',
    notes: 'API CK-4 15W-40. Engine Sump + Filter takes ~2.8L.',
  },
];

export const DEFAULT_WATER_TASK: MaintenanceSchedule = {
  id: 'sched-water-refill',
  title: 'Refill Freshwater Tank & Add Water Freshener',
  category: 'Plumbing & Water',
  intervalDays: 21,
  lastCompletedDate: '2026-10-10',
  linkedParts: [{ partId: 'part-water-freshener', quantityNeeded: 2.0 }],
  wrenchOrSpecNotes: 'Deck fill key • 40 Gal Freshwater Tank (Add 2 oz Aqua Freshener)',
  procedureNotes:
    'Flush dock hose for 30 seconds before inserting into deck fill. Add 2 oz water freshener before topping off so inflow mixes treatment.',
};

export const DEFAULT_SAMPLE_MANUALS: VesselManual[] = [
  {
    id: 'manual-yanmar-3ym30',
    title: 'Yanmar 3YM30 / 3YM20 Operation & Service Manual',
    category: 'Engine',
    equipmentModel: 'Yanmar 3YM30 (29 HP Diesel)',
    fileName: 'Yanmar-3YM30-Service-Manual.pdf',
    pageHints:
      'Oil & Filter Change p. 28 • Fuel Filter Bleeding p. 34 • Raw Water Impeller p. 42 • V-Belt Tension p. 36 • Heat Exchanger p. 64 • Kanzaki KM2P-1 Gearbox p. 52',
    notes:
      'Engine Sump Capacity: 2.8 Liters (API CK-4 15W-40) • Gearbox: 0.30L SAE 30 • Valve Clearance (Cold): 0.20mm Intake / Exhaust.',
    addedAt: '2026-04-10',
  },
  {
    id: 'manual-racor-500fg',
    title: 'Parker Racor 500FG / 500MA Turbine Series Filter Manual',
    category: 'Fuel',
    equipmentModel: 'Racor 500FG / 500MA',
    fileName: 'Racor-500FG-Turbine-Manual.pdf',
    pageHints: 'Element Replacement (2010TM-OR) p. 4 • T-Handle O-Ring & Bowl Drain p. 6 • Troubleshooting Air Leaks p. 9',
    notes: 'Uses 2010TM-OR (10 micron) element. Hand-tighten T-handle only; do not over-torque.',
    addedAt: '2026-04-10',
  },
];

export const SAMPLE_DB_EPOCH = '1970-01-01T00:00:00.000Z';

export function isInitialSampleDatabase(db: CaptainsDatabase): boolean {
  if (!db) return true;
  if (!db.exportedAt || db.exportedAt === SAMPLE_DB_EPOCH) return true;
  if (
    db.vessel?.name === 'S/V Windward Spirit' &&
    (db.vessel?.boatMakeModel === 'Hunter 33' || db.vessel?.boatMakeModel === 'Catalina 36 MkII')
  ) {
    return true;
  }
  return false;
}

export function getInitialSampleDatabase(): CaptainsDatabase {
  return {
    version: 3,
    exportedAt: SAMPLE_DB_EPOCH,
    vessel: {
      name: 'S/V Windward Spirit',
      boatMakeModel: 'Hunter 33',
      year: 2006,
      engineMakeModel: 'Yanmar 3YM30 (29 HP Diesel)',
      engineSerial: 'YAN-3YM30-SAMPLE',
      currentEngineHours: 1442.5,
      fuelCapacityGallons: 25,
      defaultBurnRateGph: 0.65,
      fuelType: 'diesel',
      insignia: 'hunter-emblem',
      lastUpdated: '2026-10-25',
    },
    parts: [
      ...DEFAULT_CONSUMABLE_ITEMS,
      {
        id: 'part-oil-filter',
        name: 'Engine Spin-On Oil Filter',
        itemType: 'part',
        unit: 'each',
        category: 'Lubrication',
        equipmentModel: 'Yanmar 3YM30',
        oemPartNumber: '119305-35170',
        crossRefNumbers: ['Sierra 18-7916', 'Fram PH6607', 'Wix 51358', 'Baldwin B1400'],
        quantityOnBoard: 2,
        minQuantity: 2,
        datePurchased: '2026-04-10',
        lastPricePaid: 16.49,
        preferredVendorUrl: 'https://www.defender.com/search.html?q=119305-35170',
        locationOnBoat: 'Port Settee Engine Spares Bin',
        notes: 'Apply thin film of clean 15W-40 oil to gasket before hand-tightening + 3/4 turn.',
        manualId: 'manual-yanmar-3ym30',
        manualPage: 'p. 28',
      },
      {
        id: 'part-secondary-fuel',
        name: 'Secondary Engine Fuel Filter Element',
        itemType: 'part',
        unit: 'each',
        category: 'Fuel',
        equipmentModel: 'Yanmar 3YM30',
        oemPartNumber: '129470-55703',
        crossRefNumbers: ['Sierra 18-79960', 'Baldwin PF7930'],
        quantityOnBoard: 1,
        minQuantity: 2,
        datePurchased: '2025-09-12',
        lastPricePaid: 22.95,
        locationOnBoat: 'Port Settee Engine Spares Bin',
        notes: 'Includes O-ring for filter cup. Bleed air screw on top of housing after install.',
        manualId: 'manual-yanmar-3ym30',
        manualPage: 'p. 34',
      },
      {
        id: 'part-racor-element',
        name: 'Primary Fuel/Water Separator Filter (10 Micron)',
        itemType: 'part',
        unit: 'each',
        category: 'Fuel',
        equipmentModel: 'Racor 500FG / 500MA',
        oemPartNumber: '2010TM-OR',
        crossRefNumbers: ['Racor 2010TM', 'Sierra 18-7937', 'Baldwin PF598-10'],
        quantityOnBoard: 3,
        minQuantity: 2,
        datePurchased: '2026-03-22',
        lastPricePaid: 14.5,
        locationOnBoat: 'Lazarette Fuel Locker',
        notes: '10-micron blue cap element with T-handle O-ring.',
        manualId: 'manual-racor-500fg',
        manualPage: 'p. 4',
      },
      {
        id: 'part-impeller',
        name: 'Raw Water Pump Impeller & O-Ring Kit',
        itemType: 'part',
        unit: 'kit',
        category: 'Cooling',
        equipmentModel: 'Yanmar 3YM30 / Johnson Pump',
        oemPartNumber: '128990-42570',
        crossRefNumbers: ['Johnson 09-810B-1', 'Sierra 18-3089', 'Jabsco 653-0001'],
        quantityOnBoard: 1,
        minQuantity: 2,
        datePurchased: '2025-11-01',
        lastPricePaid: 34.99,
        locationOnBoat: 'Nav Station Tool Drawer',
        notes: '6-blade neoprene impeller. Lubricate blades with glycerin or silicone grease.',
        manualId: 'manual-yanmar-3ym30',
        manualPage: 'p. 42',
        photos: [
          {
            id: 'photo-part-impeller-1',
            dataUrl: './demo/part-impeller-kit.jpg',
            caption: 'Yanmar / Johnson 6-blade neoprene impeller, O-ring & cover gasket kit',
            addedAt: '2025-11-01',
          },
        ],
      },
      {
        id: 'part-belt',
        name: 'Alternator & Water Pump V-Belt',
        itemType: 'part',
        unit: 'each',
        category: 'Electrical',
        equipmentModel: 'Yanmar 3YM30 (80A Alternator)',
        oemPartNumber: '128990-77350',
        crossRefNumbers: ['Gates 9375', 'Dayco 15375'],
        quantityOnBoard: 1,
        minQuantity: 1,
        datePurchased: '2025-08-19',
        lastPricePaid: 28.0,
        locationOnBoat: 'Port Settee Engine Spares Bin',
        notes: 'Check belt deflection (approx 8-10mm under thumb pressure).',
      },
      {
        id: 'part-shaft-zinc',
        name: 'Propeller Shaft Streamlined Anode (1" Shaft)',
        itemType: 'part',
        unit: 'each',
        category: 'Transmission',
        equipmentModel: '1-Inch Stainless Prop Shaft',
        oemPartNumber: 'CMX-03',
        crossRefNumbers: ['Martyr CMX03Z', 'Camp X-3'],
        quantityOnBoard: 0,
        minQuantity: 2,
        datePurchased: '2026-03-05',
        lastPricePaid: 13.75,
        locationOnBoat: 'Forepeak Locker',
        notes: 'Tap with hammer after tightening Allen bolts, then re-torque.',
      },
    ],
    schedules: [
      {
        id: 'sched-oil-change',
        title: 'Engine Oil & Filter Change (15W-40)',
        category: 'Lubrication',
        intervalHours: 100,
        intervalDays: 365,
        lastCompletedHours: 1350,
        lastCompletedDate: '2026-04-12',
        linkedParts: [
          { partId: 'part-oil-filter', quantityNeeded: 1 },
          { partId: 'part-rotella-oil', quantityNeeded: 2.8 },
        ],
        wrenchOrSpecNotes: '2.8 Liters Shell Rotella T4 15W-40 • Filter strap wrench',
        procedureNotes:
          'Warm engine for 10 mins, extract oil via dipstick tube, swap spin-on filter, run and inspect for leaks.',
        manualId: 'manual-yanmar-3ym30',
        manualPage: 'p. 28',
      },
      DEFAULT_WATER_TASK,
      {
        id: 'sched-fuel-filters',
        title: 'Primary (Racor) & Secondary Fuel Filters',
        category: 'Fuel',
        intervalHours: 250,
        intervalDays: 365,
        lastCompletedHours: 1185,
        lastCompletedDate: '2025-09-18',
        linkedParts: [
          { partId: 'part-racor-element', quantityNeeded: 1 },
          { partId: 'part-secondary-fuel', quantityNeeded: 1 },
        ],
        wrenchOrSpecNotes: '10mm bleed screw on secondary filter header',
        procedureNotes:
          'Close fuel tank shutoff valve, swap Racor 2010TM element, replace Yanmar secondary element, open valve & bleed air.',
        manualId: 'manual-racor-500fg',
        manualPage: 'p. 4',
      },
      {
        id: 'sched-impeller',
        title: 'Raw Water Pump Impeller Replacement',
        category: 'Cooling',
        intervalHours: 250,
        intervalDays: 365,
        lastCompletedHours: 1210,
        lastCompletedDate: '2025-11-05',
        linkedParts: [{ partId: 'part-impeller', quantityNeeded: 1 }],
        wrenchOrSpecNotes: '8mm cover bolts • Close raw water thru-hull seacock FIRST!',
        procedureNotes:
          'Close raw water intake seacock. Remove 6 cover screws, extract old impeller, check that all 6 blades are intact.',
        manualId: 'manual-yanmar-3ym30',
        manualPage: 'p. 42',
        photos: [
          {
            id: 'photo-sched-impeller-1',
            dataUrl: './demo/part-impeller-kit.jpg',
            caption: 'Replacement 6-blade neoprene impeller & gasket kit',
            addedAt: '2025-11-05',
          },
        ],
      },
      {
        id: 'sched-heat-exchanger',
        title: 'Heat Exchanger Tube Bundle Overhaul',
        category: 'Cooling',
        intervalHours: 500,
        intervalDays: 730,
        lastCompletedHours: 1410,
        lastCompletedDate: '2026-09-14',
        linkedParts: [],
        wrenchOrSpecNotes: '12mm manifold bolts • New end-cap O-rings & exhaust flange gasket',
        procedureNotes:
          'Drain coolant, remove heat exchanger housing, soak brass tube bundle in descaling solution, inspect tubes & reassemble with fresh gaskets.',
        photos: [
          {
            id: 'photo-sched-hx-1',
            dataUrl: './demo/heat-exchanger-housing.jpg',
            caption: 'Heat exchanger housing & exhaust flange gasket alignment',
            addedAt: '2026-09-14',
          },
          {
            id: 'photo-sched-hx-2',
            dataUrl: './demo/heat-exchanger-soak.jpg',
            caption: 'Brass tube bundle soaking in descaling bath',
            addedAt: '2026-09-14',
          },
        ],
      },
      {
        id: 'sched-shaft-zinc',
        title: 'Inspect & Replace Prop Shaft Zinc Anodes',
        category: 'Transmission',
        intervalDays: 180,
        lastCompletedDate: '2026-03-10',
        linkedParts: [{ partId: 'part-shaft-zinc', quantityNeeded: 2 }],
        wrenchOrSpecNotes: '3/16" Hex Allen key (underwater / diver)',
        procedureNotes:
          'Replace when anode is 50% wasted. Clean shaft contact area to bright metal before clamping.',
      },
      {
        id: 'sched-trans-fluid',
        title: 'Transmission Fluid Change (Kanzaki KM2P-1)',
        category: 'Transmission',
        intervalHours: 250,
        intervalDays: 365,
        lastCompletedHours: 1350,
        lastCompletedDate: '2026-04-12',
        linkedParts: [],
        wrenchOrSpecNotes: '0.30 Liters SAE 30 HD or Dexron ATF (check gearbox plate)',
        procedureNotes:
          'Suction out old fluid from dipstick hole and refill to upper mark on dipstick (resting, not screwed in).',
      },
    ],
    serviceLogs: [
      {
        id: 'log-water-1',
        scheduleId: 'sched-water-refill',
        title: 'Refill Freshwater Tank & Add Water Freshener',
        category: 'Plumbing / Head',
        date: '2026-10-10',
        engineHours: 1435.0,
        cost: 0,
        partsUsed: [
          {
            partId: 'part-water-freshener',
            quantityNeeded: 2.0,
            nameSnapshot: 'Star brite Aqua Water Tank & System Freshener',
            unitSnapshot: 'oz',
          },
        ],
        notes: 'Topped off 40 gal port & starboard tanks at marina dock and added 2 oz Aqua Freshener.',
      },
      {
        id: 'log-1',
        scheduleId: 'sched-oil-change',
        title: 'Engine Oil & Filter Change (15W-40)',
        category: 'Lubrication',
        date: '2026-04-12',
        engineHours: 1350.0,
        cost: 38.5,
        partsUsed: [
          { partId: 'part-oil-filter', quantityNeeded: 1, nameSnapshot: 'Engine Spin-On Oil Filter', unitSnapshot: 'each' },
          { partId: 'part-rotella-oil', quantityNeeded: 2.8, nameSnapshot: 'Shell Rotella T4 15W-40', unitSnapshot: 'liters' },
        ],
        notes: 'Spring commissioning oil & filter change + transmission fluid check. No metal shavings.',
      },
      {
        id: 'log-2',
        scheduleId: 'sched-shaft-zinc',
        title: 'Inspect & Replace Prop Shaft Zinc Anodes',
        category: 'Cooling',
        date: '2026-03-10',
        engineHours: 1338.0,
        cost: 27.5,
        partsUsed: [{ partId: 'part-shaft-zinc', quantityNeeded: 2 }],
        notes: 'Diver installed two fresh 1" streamlined shaft anodes and scrubbed prop.',
      },
      {
        id: 'log-heat-exchanger',
        scheduleId: 'sched-heat-exchanger',
        title: 'Heat Exchanger Tube Bundle Overhaul',
        category: 'Cooling',
        date: '2026-09-14',
        engineHours: 1410.0,
        cost: 42.0,
        partsUsed: [],
        notes: 'Removed heat exchanger housing, soaked brass tube bundle in descaling bath, and reassembled with new gaskets and end-cap O-rings.',
        photos: [
          {
            id: 'photo-log-hx-1',
            dataUrl: './demo/heat-exchanger-housing.jpg',
            caption: 'Cast housing cleaned & manifold gasket prepped',
            addedAt: '2026-09-14',
          },
          {
            id: 'photo-log-hx-2',
            dataUrl: './demo/heat-exchanger-soak.jpg',
            caption: 'Tube bundle descaling soak',
            addedAt: '2026-09-14',
          },
          {
            id: 'photo-log-hx-3',
            dataUrl: './demo/heat-exchanger-bundle.jpg',
            caption: 'Descaled brass tube bundle & end cap ready for reassembly',
            addedAt: '2026-09-14',
          },
        ],
      },
      {
        id: 'log-3',
        scheduleId: 'sched-impeller',
        title: 'Raw Water Pump Impeller Replacement',
        category: 'Cooling',
        date: '2025-11-05',
        engineHours: 1210.0,
        cost: 34.99,
        partsUsed: [{ partId: 'part-impeller', quantityNeeded: 1 }],
        notes: 'Old impeller looked great (kept as emergency backup). Strong water flow at exhaust.',
        photos: [
          {
            id: 'photo-log-impeller-1',
            dataUrl: './demo/part-impeller-kit.jpg',
            caption: 'New 6-blade impeller & gasket installed',
            addedAt: '2025-11-05',
          },
        ],
      },
    ],
    fuelLogs: [
      {
        id: 'fuel-1',
        date: '2026-06-14',
        engineHours: 1368.0,
        gallonsAdded: 14.2,
        pricePerGallon: 4.85,
        totalCost: 68.87,
        isFullTank: true,
        biocideAdded: true,
        additivesUsed: [
          {
            partId: 'part-biobor',
            quantityNeeded: 0.5,
            nameSnapshot: 'Biobor JF Diesel Microbicide',
            unitSnapshot: 'oz',
          },
        ],
        notes: 'Harbor Fuel Dock — topped off before coastal cruise.',
      },
      {
        id: 'fuel-2',
        date: '2026-08-02',
        engineHours: 1396.5,
        gallonsAdded: 18.4,
        pricePerGallon: 4.95,
        totalCost: 91.08,
        isFullTank: true,
        biocideAdded: true,
        additivesUsed: [
          {
            partId: 'part-biobor',
            quantityNeeded: 0.6,
            nameSnapshot: 'Biobor JF Diesel Microbicide',
            unitSnapshot: 'oz',
          },
        ],
        notes: 'Motored 28.5 hrs against light chop @ 2400 RPM (0.65 GPH). Racor bowl clean.',
      },
      {
        id: 'fuel-3',
        date: '2026-09-29',
        engineHours: 1425.0,
        gallonsAdded: 19.1,
        pricePerGallon: 4.79,
        totalCost: 91.49,
        isFullTank: true,
        biocideAdded: true,
        additivesUsed: [
          {
            partId: 'part-biobor',
            quantityNeeded: 0.7,
            nameSnapshot: 'Biobor JF Diesel Microbicide',
            unitSnapshot: 'oz',
          },
          {
            partId: 'part-startron',
            quantityNeeded: 1.2,
            nameSnapshot: 'Star Tron Enzyme Fuel Treatment',
            unitSnapshot: 'oz',
          },
        ],
        notes: 'Topped off at marina fuel dock. Treated with Biobor JF + Star Tron.',
      },
    ],
    customCategories: [],
    engineHoursLogs: [
      {
        id: 'hours-sample-1',
        date: '2026-04-10',
        engineHours: 1350.0,
        note: 'Spring Commissioning & Launch',
      },
      {
        id: 'hours-sample-2',
        date: '2026-07-04',
        engineHours: 1395.5,
        note: 'Independence Day Island Cruise',
      },
    ],
    sailTrips: [
      {
        id: 'trip-sample-1',
        title: 'San Juan Islands Summer Cruise',
        startDate: '2026-08-15',
        endDate: '2026-08-17',
        status: 'completed',
        captain: 'Capt. Jack',
        tripNotes: 'Cruised through Thatcher Pass and Obstruction Pass. Excellent wind and clear skies.',
        photos: [
          {
            id: 'photo-trip-sample-1',
            dataUrl: './demo/cruise-san-juan-sailing.jpg',
            caption: 'Beam reach under full genoa through the San Juan Islands',
            addedAt: '2026-08-15',
          },
          {
            id: 'photo-trip-sample-2',
            dataUrl: './demo/cruise-orcas-anchorage.jpg',
            caption: 'Golden hour at anchor in sheltered Orcas Island cove',
            addedAt: '2026-08-16',
          },
        ],
        legs: [
          {
            id: 'leg-sample-1',
            tripId: 'trip-sample-1',
            legNumber: 1,
            title: 'Anacortes to Rosario Resort (Orcas Island)',
            departurePort: 'Cap Sante Marina, Anacortes',
            arrivalPort: 'Rosario Resort, Orcas Island',
            departureTime: '2026-08-15T09:30',
            arrivalTime: '2026-08-15T13:45',
            distanceNm: 18.5,
            propulsionMode: 'motor-sail',
            startEngineHours: 1400.0,
            endEngineHours: 1402.5,
            startFuelLevelPercent: 95,
            endFuelLevelPercent: 88,
            windSpeedKts: 14,
            windGustKts: 18,
            windDirection: 'WSW',
            seaState: 'slight',
            weather: 'partly-cloudy',
            pointOfSail: 'Beam Reach',
            sailsUsed: 'Full Main + 110% Genoa',
            barometerHpa: 1018,
            captain: 'Capt. Jack',
            crew: ['Sarah M.', 'Dave K.'],
            notes: 'Strong ebb current through Guemes Channel. Motor-sailed until clearing Thatcher Pass, then had a fantastic beam reach up East Sound. Orcas spotted near Peavine Pass.',
            anchorageDetails: 'Moored at Rosario Resort Marina slip C-14.',
            departureCoordinates: { lat: 48.5173, lon: -122.6045 },
            arrivalCoordinates: { lat: 48.6472, lon: -122.8717 },
            maxSpeedKts: 7.8,
            avgSpeedKts: 4.4,
            trackPoints: [
              { lat: 48.5173, lon: -122.6045, speedKts: 0.0, headingDeg: 340, timestamp: 1786780800000 },
              { lat: 48.5255, lon: -122.6105, speedKts: 5.2, headingDeg: 330, timestamp: 1786781700000 },
              { lat: 48.5340, lon: -122.6450, speedKts: 6.8, headingDeg: 295, timestamp: 1786783500000 },
              { lat: 48.5410, lon: -122.6900, speedKts: 7.2, headingDeg: 285, timestamp: 1786785300000 },
              { lat: 48.5480, lon: -122.7500, speedKts: 7.4, headingDeg: 280, timestamp: 1786787100000 },
              { lat: 48.5360, lon: -122.8050, speedKts: 6.9, headingDeg: 250, timestamp: 1786788900000 },
              { lat: 48.5400, lon: -122.8350, speedKts: 7.8, headingDeg: 310, timestamp: 1786790700000 },
              { lat: 48.6010, lon: -122.8250, speedKts: 7.5, headingDeg: 355, timestamp: 1786793400000 },
              { lat: 48.6180, lon: -122.8450, speedKts: 6.2, headingDeg: 320, timestamp: 1786795200000 },
              { lat: 48.6350, lon: -122.8620, speedKts: 5.4, headingDeg: 335, timestamp: 1786797000000 },
              { lat: 48.6440, lon: -122.8700, speedKts: 3.8, headingDeg: 345, timestamp: 1786798200000 },
              { lat: 48.6472, lon: -122.8717, speedKts: 0.0, headingDeg: 350, timestamp: 1786798800000 },
            ],
            photos: [
              {
                id: 'photo-leg-sample-1',
                dataUrl: './demo/cruise-san-juan-sailing.jpg',
                caption: 'Clearing Thatcher Pass on a 14-kt beam reach up East Sound',
                addedAt: '2026-08-15',
              },
            ],
          },
          {
            id: 'leg-sample-2',
            tripId: 'trip-sample-1',
            legNumber: 2,
            title: 'Rosario Resort to Friday Harbor',
            departurePort: 'Rosario Resort, Orcas Island',
            arrivalPort: 'Friday Harbor Marina, San Juan Island',
            departureTime: '2026-08-16T10:15',
            arrivalTime: '2026-08-16T13:00',
            distanceNm: 12.0,
            propulsionMode: 'sail',
            startEngineHours: 1402.5,
            endEngineHours: 1403.0,
            startFuelLevelPercent: 88,
            endFuelLevelPercent: 86,
            windSpeedKts: 16,
            windGustKts: 20,
            windDirection: 'S',
            seaState: 'slight',
            weather: 'clear',
            pointOfSail: 'Broad Reach',
            sailsUsed: 'Full Main & Genoa',
            barometerHpa: 1020,
            captain: 'Capt. Jack',
            crew: ['Sarah M.', 'Dave K.'],
            notes: 'Only motored for 0.5h out of Rosario and into Friday Harbor marina. Broad reach sailing all the way across. Mooring ball at Friday Harbor.',
            anchorageDetails: 'Friday Harbor Marina mooring ball #8.',
            departureCoordinates: { lat: 48.6472, lon: -122.8717 },
            arrivalCoordinates: { lat: 48.5361, lon: -123.0139 },
            maxSpeedKts: 8.2,
            avgSpeedKts: 4.4,
            trackPoints: [
              { lat: 48.6472, lon: -122.8717, speedKts: 0.0, headingDeg: 170, timestamp: 1786856100000 },
              { lat: 48.6250, lon: -122.8550, speedKts: 6.1, headingDeg: 155, timestamp: 1786857900000 },
              { lat: 48.5950, lon: -122.8200, speedKts: 7.0, headingDeg: 200, timestamp: 1786859700000 },
              { lat: 48.5850, lon: -122.9000, speedKts: 7.8, headingDeg: 260, timestamp: 1786862400000 },
              { lat: 48.5920, lon: -122.9750, speedKts: 8.2, headingDeg: 275, timestamp: 1786864200000 },
              { lat: 48.5600, lon: -123.0050, speedKts: 7.1, headingDeg: 195, timestamp: 1786865100000 },
              { lat: 48.5390, lon: -123.0080, speedKts: 4.5, headingDeg: 215, timestamp: 1786865700000 },
              { lat: 48.5361, lon: -123.0139, speedKts: 0.0, headingDeg: 240, timestamp: 1786866000000 },
            ],
            photos: [
              {
                id: 'photo-leg-sample-2',
                dataUrl: './demo/cruise-orcas-anchorage.jpg',
                caption: 'Peaceful evening anchorage reflection before Friday Harbor arrival',
                addedAt: '2026-08-16',
              },
            ],
          },
        ],
      },
      ...(IS_DEMO_MODE ? [
        {
          id: 'trip-sample-2',
          title: 'Bellingham Bay to Sucia Island Passage',
        startDate: '2026-10-31',
        status: 'underway',
        captain: 'Capt. Jack',
        tripNotes: 'Heading out from Squalicum Harbor through Hale Passage towards Sucia Island Marine Park.',
        legs: [
          {
            id: 'leg-sample-3',
            tripId: 'trip-sample-2',
            legNumber: 1,
            title: 'Squalicum Harbor to Inati Bay (Lummi Island)',
            departurePort: 'Squalicum Harbor, Bellingham',
            arrivalPort: 'Inati Bay, Lummi Island',
            departureTime: '2026-10-31T08:00',
            arrivalTime: '2026-10-31T10:15',
            distanceNm: 9.4,
            propulsionMode: 'sail',
            startEngineHours: 1441.5,
            endEngineHours: 1442.0,
            startFuelLevelPercent: 86,
            endFuelLevelPercent: 84,
            windSpeedKts: 12,
            windGustKts: 15,
            windDirection: 'NW',
            seaState: 'calm',
            weather: 'clear',
            pointOfSail: 'Close Hauled',
            sailsUsed: 'Full Main & 110% Genoa',
            barometerHpa: 1022,
            captain: 'Capt. Jack',
            crew: ['Sarah M.'],
            notes: 'Gorgeous morning sail across Bellingham Bay with brisk morning breeze off Chuckanut Mountain. Anchored for lunch in Inati Bay.',
            anchorageDetails: 'Anchored in 25ft mud, 4:1 scope.',
            departureCoordinates: { lat: 48.7561, lon: -122.5083 },
            arrivalCoordinates: { lat: 48.6756, lon: -122.6158 },
            maxSpeedKts: 6.9,
            avgSpeedKts: 4.2,
            trackPoints: [
              { lat: 48.7561, lon: -122.5083, speedKts: 0.0, headingDeg: 220, timestamp: 1793433600000 },
              { lat: 48.7450, lon: -122.5200, speedKts: 5.5, headingDeg: 215, timestamp: 1793435400000 },
              { lat: 48.7200, lon: -122.5450, speedKts: 6.4, headingDeg: 210, timestamp: 1793437200000 },
              { lat: 48.7000, lon: -122.5750, speedKts: 6.9, headingDeg: 215, timestamp: 1793439000000 },
              { lat: 48.6820, lon: -122.6050, speedKts: 5.1, headingDeg: 225, timestamp: 1793440800000 },
              { lat: 48.6756, lon: -122.6158, speedKts: 0.0, headingDeg: 235, timestamp: 1793441700000 },
            ],
          },
        ],
      } as SailTrip,
    ] : []),
    ],
    manuals: DEFAULT_SAMPLE_MANUALS,
  };
}

export function upgradeDatabaseSchema(db: CaptainsDatabase): CaptainsDatabase {
  let changed = false;
  const parts = [...(db.parts || [])];
  const schedules = [...(db.schedules || [])];

  const mapCategory = (cat: string): any => {
    switch (cat) {
      case 'Engine - Fuel':
      case 'Fuel System':
        return 'Fuel';
      case 'Engine - Cooling':
        return 'Cooling';
      case 'Engine - Lubrication':
        return 'Lubrication';
      case 'Engine - Electrical':
        return 'Electrical';
      case 'Plumbing / Head':
        return 'Plumbing & Water';
      default:
        return cat;
    }
  };

  // Ensure existing parts have itemType, unit defaults, datePurchased, containers, and normalized system categories
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const newCat = mapCategory(p.category);
    const sampleMatch = DEFAULT_CONSUMABLE_ITEMS.find((c) => c.id === p.id);
    const defaultDate = sampleMatch?.datePurchased || '2026-04-10';
    const isConsumable = (p.itemType || sampleMatch?.itemType) === 'consumable';

    let containers = p.containers;
    let quantityOnBoard = p.quantityOnBoard;

    if (isConsumable && (!containers || containers.length === 0)) {
      if (sampleMatch?.containers) {
        containers = sampleMatch.containers;
      } else {
        containers = [
          {
            id: `cont-${p.id}-1`,
            datePurchased: p.datePurchased || defaultDate,
            containerSize: p.containerSize || Math.max(p.quantityOnBoard, 16),
            quantityRemaining: p.quantityOnBoard,
            pricePaid: p.lastPricePaid,
          },
        ];
      }
      quantityOnBoard = Number(
        containers.reduce((sum, c) => sum + c.quantityRemaining, 0).toFixed(2)
      );
      changed = true;
    }

    if (!p.itemType || p.category !== newCat || !p.datePurchased || containers !== p.containers) {
      parts[i] = {
        ...p,
        itemType: p.itemType || 'part',
        unit: p.unit || (isConsumable ? 'oz' : 'each'),
        category: newCat,
        datePurchased: p.datePurchased || defaultDate,
        containers,
        quantityOnBoard,
      };
      changed = true;
    }
  }

  // Normalize schedule categories
  for (let i = 0; i < schedules.length; i++) {
    const s = schedules[i];
    const newCat = mapCategory(s.category);
    if (s.category !== newCat) {
      schedules[i] = { ...s, category: newCat };
      changed = true;
    }
  }

  // If upgrading from v1 without consumables, inject the default consumables & water refill task
  if ((db.version || 1) < 2) {
    for (const c of DEFAULT_CONSUMABLE_ITEMS) {
      if (!parts.some((p) => p.id === c.id)) {
        parts.unshift(c);
      }
    }
    if (!schedules.some((s) => s.id === DEFAULT_WATER_TASK.id)) {
      schedules.splice(1, 0, DEFAULT_WATER_TASK);
    }
    const oilIdx = schedules.findIndex((s) => s.id === 'sched-oil-change');
    if (
      oilIdx >= 0 &&
      !schedules[oilIdx].linkedParts.some((lp) => lp.partId === 'part-rotella-oil')
    ) {
      schedules[oilIdx] = {
        ...schedules[oilIdx],
        linkedParts: [
          ...schedules[oilIdx].linkedParts,
          { partId: 'part-rotella-oil', quantityNeeded: 2.8 },
        ],
      };
    }
    changed = true;
  }

  const customCategories = Array.isArray(db.customCategories) ? db.customCategories : [];
  if (!db.customCategories) {
    changed = true;
  }

  const engineHoursLogs = Array.isArray(db.engineHoursLogs) ? db.engineHoursLogs : [];
  if (!db.engineHoursLogs) {
    changed = true;
  }

  const sampleDb = getInitialSampleDatabase();
  let sailTrips = [...(db.sailTrips || [])];

  if (sailTrips.length === 0) {
    sailTrips = sampleDb.sailTrips || [];
    changed = true;
  } else {
    // Enrich sample legs with GPS coordinates if missing
    sailTrips = sailTrips.map((trip) => {
      if (trip.id === 'trip-sample-1') {
        const updatedLegs = (trip.legs || []).map((leg) => {
          if (leg.id === 'leg-sample-1' && (!leg.departureCoordinates || !leg.trackPoints)) {
            changed = true;
            const sampleLeg1 = sampleDb.sailTrips?.[0]?.legs?.find((l) => l.id === 'leg-sample-1');
            return {
              ...leg,
              departureCoordinates: { lat: 48.5173, lon: -122.6045 },
              arrivalCoordinates: { lat: 48.6472, lon: -122.8717 },
              maxSpeedKts: 7.8,
              avgSpeedKts: 4.4,
              trackPoints: sampleLeg1?.trackPoints,
            };
          }
          if (leg.id === 'leg-sample-2' && (!leg.departureCoordinates || !leg.trackPoints)) {
            changed = true;
            const sampleLeg2 = sampleDb.sailTrips?.[0]?.legs?.find((l) => l.id === 'leg-sample-2');
            return {
              ...leg,
              departureCoordinates: { lat: 48.6472, lon: -122.8717 },
              arrivalCoordinates: { lat: 48.5361, lon: -123.0139 },
              maxSpeedKts: 8.2,
              avgSpeedKts: 4.4,
              trackPoints: sampleLeg2?.trackPoints,
            };
          }
          return leg;
        });
        return { ...trip, legs: updatedLegs };
      }
      return trip;
    });

    // Ensure demo underway trip is only present in Demo Mode
    if (!IS_DEMO_MODE) {
      const cleaned = sailTrips.filter((t) => t.id !== 'trip-sample-2');
      if (cleaned.length !== sailTrips.length) {
        sailTrips = cleaned;
        changed = true;
      }
    } else {
      // In demo mode, ensure sample underway trip is present
      if (!sailTrips.some((t: SailTrip) => t.id === 'trip-sample-2')) {
        const sampleTrip2 = (sampleDb.sailTrips || []).find((t: SailTrip) => t.id === 'trip-sample-2');
        if (sampleTrip2) {
          sailTrips = [sampleTrip2, ...sailTrips];
          changed = true;
        }
      }
    }
  }

  const manuals = Array.isArray(db.manuals) ? db.manuals : DEFAULT_SAMPLE_MANUALS;
  if (!db.manuals) {
    changed = true;
  }

  if (!changed && db.version >= 5 && db.sailTrips && db.manuals) return db;

  return {
    ...db,
    version: 5,
    parts,
    schedules,
    customCategories,
    engineHoursLogs,
    sailTrips,
    manuals,
  };
}

function saveToIndexedDB(db: CaptainsDatabase): void {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return;
  try {
    const request = window.indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const idb = request.result;
      if (!idb.objectStoreNames.contains(IDB_STORE)) {
        idb.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => {
      const idb = request.result;
      const tx = idb.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(db, 'latest');
    };
  } catch {
    // Ignore IDB errors; localStorage is primary synchronous mirror
  }
}

export function loadDatabase(): CaptainsDatabase {
  // In Public Demo Mode, always serve the pristine fictional sample database
  if (IS_DEMO_MODE) {
    return getInitialSampleDatabase();
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CaptainsDatabase;
      if (parsed && parsed.vessel && Array.isArray(parsed.schedules)) {
        const upgraded = upgradeDatabaseSchema(parsed);
        if (upgraded !== parsed) {
          saveDatabase(upgraded, true);
        }
        return upgraded;
      }
    }
  } catch (err) {
    console.error('Failed to read local database:', err);
  }
  const sample = getInitialSampleDatabase();
  saveDatabase(sample, true);
  return sample;
}

export function saveDatabase(db: CaptainsDatabase, preserveTimestamp = false): void {
  // In Public Demo Mode, disable all persistent saving to disk/localStorage/IndexedDB
  if (IS_DEMO_MODE) {
    return;
  }

  const updated: CaptainsDatabase = {
    ...db,
    exportedAt: preserveTimestamp && db.exportedAt ? db.exportedAt : new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save database to localStorage:', err);
  }
  saveToIndexedDB(updated);
}

export async function exportFileOrShare(
  filename: string,
  content: string,
  mimeType: string,
  title: string
): Promise<void> {
  // 1. Native Android / iOS APK (Capacitor) Bridge: write file to native storage & invoke OS Share Sheet
  if (Capacitor.isNativePlatform()) {
    let savedToDocuments = false;
    try {
      await Filesystem.writeFile({
        path: filename,
        data: content,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
      });
      savedToDocuments = true;
    } catch {
      // Ignore if Documents directory permission is restricted on older Android versions
    }

    try {
      const written = await Filesystem.writeFile({
        path: filename,
        data: content,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });
      await Share.share({
        title,
        files: [written.uri],
        dialogTitle: title,
      });
      return;
    } catch (err) {
      const msg = String((err as Error)?.message || err);
      if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('dismiss')) {
        return;
      }
      if (savedToDocuments) {
        alert(`Backup saved to your phone's Documents folder:\nDocuments/${filename}`);
        return;
      }
      alert(`Native export error: ${msg}`);
    }
  }

  // 2. Mobile Web Browser (Web Share API Level 2)
  const blob = new Blob([content], { type: mimeType });
  const file = new File([blob], filename, { type: mimeType });

  if (
    typeof navigator !== 'undefined' &&
    navigator.canShare &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      // NOTE: Do NOT pass 'text' when sharing files!
      // On Android, Google Drive & Gmail drop the file attachment if 'text' is also passed.
      await navigator.share({
        title,
        files: [file],
      });
      return;
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      console.warn('Web Share failed, falling back to download:', err);
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateFuelCsv(db: CaptainsDatabase): string {
  const headers = [
    'Date',
    'Engine Hours',
    'Gallons Added',
    'Price/Gal ($)',
    'Total Cost ($)',
    'Full Tank',
    'Additives & Consumables Used',
    'Notes',
  ];
  const rows = db.fuelLogs.map((f) => {
    const additivesText =
      f.additivesUsed && f.additivesUsed.length > 0
        ? f.additivesUsed
            .map((a) => {
              const part = db.parts.find((p) => p.id === a.partId);
              const name = a.nameSnapshot || part?.name || a.partId;
              const unit = a.unitSnapshot || part?.unit || 'oz';
              return `${name} (${a.quantityNeeded} ${unit})`;
            })
            .join('; ')
        : f.biocideAdded
        ? 'Biocide Added'
        : 'None';

    return [
      f.date,
      f.engineHours,
      f.gallonsAdded,
      f.pricePerGallon ?? '',
      f.totalCost ?? '',
      f.isFullTank ? 'Yes' : 'No',
      additivesText,
      f.notes,
    ];
  });
  return [headers.join(','), ...rows.map((r) => r.map(escapeCsvCell).join(','))].join('\n');
}

export function generateServiceHistoryCsv(db: CaptainsDatabase): string {
  const headers = [
    'Date',
    'Engine Hours',
    'Category',
    'Task / Repair Title',
    'Parts & Consumables Used',
    'Cost ($)',
    'Notes',
  ];
  const rows = db.serviceLogs.map((s) => {
    const partsText = (s.partsUsed || [])
      .map((u) => {
        const part = db.parts.find((p) => p.id === u.partId);
        const name = u.nameSnapshot || part?.name || u.partId;
        const unit = u.unitSnapshot || part?.unit || 'each';
        return `${name} (${u.quantityNeeded} ${unit})`;
      })
      .join('; ');
    return [s.date, s.engineHours, s.category, s.title, partsText, s.cost, s.notes];
  });
  return [headers.join(','), ...rows.map((r) => r.map(escapeCsvCell).join(','))].join('\n');
}

export function generatePartsCatalogCsv(db: CaptainsDatabase): string {
  const headers = [
    'Part / Consumable Name',
    'Type',
    'Category',
    'Equipment / System',
    'OEM / Product Number',
    'Cross-Ref / Aftermarket Numbers',
    'Qty Remaining On Board',
    'Unit',
    'Min Qty Threshold',
    'Container Size',
    'Dosage / Usage Rule',
    'Date Purchased',
    'Last Price Paid ($)',
    'Location On Boat',
    'Preferred Vendor URL',
    'Notes',
  ];
  const rows = db.parts.map((p) => [
    p.name,
    p.itemType || 'part',
    p.category,
    p.equipmentModel,
    p.oemPartNumber,
    p.crossRefNumbers.join(' | '),
    p.quantityOnBoard,
    p.unit || 'each',
    p.minQuantity,
    p.containerSize ?? '',
    p.dosageHint ?? '',
    p.datePurchased ?? '',
    p.lastPricePaid ?? '',
    p.locationOnBoat ?? '',
    p.preferredVendorUrl ?? '',
    p.notes ?? '',
  ]);
  return [headers.join(','), ...rows.map((r) => r.map(escapeCsvCell).join(','))].join('\n');
}
