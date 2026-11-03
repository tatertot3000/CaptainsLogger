export type SystemCategory =
  | 'Engine'
  | 'Cooling'
  | 'Fuel'
  | 'Lubrication'
  | 'Electrical'
  | 'Transmission'
  | 'Plumbing & Water'
  | 'Rigging / Deck'
  | 'Safety'
  // Legacy aliases for backward compatibility
  | 'Engine - Fuel'
  | 'Engine - Cooling'
  | 'Engine - Lubrication'
  | 'Engine - Electrical'
  | 'Fuel System'
  | 'Plumbing / Head'
  | (string & {});

export type InventoryItemType = 'part' | 'consumable';
export type FuelType = 'diesel' | 'gasoline';

export interface VesselProfile {
  name: string;
  boatMakeModel: string;
  year: number;
  engineMakeModel: string;
  engineSerial: string;
  currentEngineHours: number;
  fuelCapacityGallons: number;
  defaultBurnRateGph: number;
  lastUpdated: string;
  wallpaperUrl?: string;
  wallpaperEnabled?: boolean;
  wallpaperOpacity?: number;
  insignia?: string;
  fuelType?: FuelType;
}

export interface ConsumableContainer {
  id: string;
  datePurchased: string; // YYYY-MM-DD for this specific bottle/jug
  containerSize: number; // e.g., 16 (oz) or 32 (oz)
  quantityRemaining: number; // e.g., 6.5 (oz) left in this bottle
  pricePaid?: number;
}

export interface PartItem {
  id: string;
  name: string;
  itemType?: InventoryItemType; // 'part' (discrete) or 'consumable' (measured fluid/additive)
  trackQuantity?: boolean; // When false, item is catalog reference only and excluded from low-stock checks
  unit?: string; // e.g., 'each', 'oz', 'liters', 'quarts', 'gal'
  containerSize?: number; // default/standard container size (e.g., 16 for a 16 oz bottle)
  containers?: ConsumableContainer[]; // individual bottles/containers grouped under this consumable card
  dosageHint?: string; // e.g., '1 oz per 20 gal water' or '0.5 oz per 15 gal diesel'
  category: SystemCategory;
  equipmentModel: string;
  oemPartNumber: string;
  crossRefNumbers: string[];
  quantityOnBoard: number;
  minQuantity: number;
  datePurchased?: string; // YYYY-MM-DD item tag for identifying when the item/bottle was bought
  lastPricePaid?: number;
  preferredVendorUrl?: string;
  locationOnBoat?: string;
  notes?: string;
  photos?: MaintenancePhoto[];
  manualId?: string;
  manualPage?: string;
}

export interface LinkedPartRequirement {
  partId: string;
  quantityNeeded: number;
  nameSnapshot?: string;
  unitSnapshot?: string;
}

export interface MaintenancePhoto {
  id: string;
  dataUrl: string; // Compressed JPEG/WebP Data URL
  caption?: string;
  addedAt: string; // YYYY-MM-DD
}

export interface MaintenanceSchedule {
  id: string;
  title: string;
  category: SystemCategory;
  intervalHours?: number; // e.g., 100 engine hours (optional for operational tasks like water refill)
  intervalDays?: number;  // e.g., 365 days
  lastCompletedHours?: number;
  lastCompletedDate?: string; // YYYY-MM-DD
  linkedParts: LinkedPartRequirement[];
  wrenchOrSpecNotes?: string; // e.g., "17mm drain plug, 2.8L 15W-40 oil"
  procedureNotes?: string;
  photos?: MaintenancePhoto[];
  manualId?: string;
  manualPage?: string;
}

export interface VesselManual {
  id: string;
  title: string;
  category: SystemCategory;
  equipmentModel: string;
  fileName?: string;
  fileSizeBytes?: number;
  hasLocalPdf?: boolean;
  externalUrl?: string;
  pageHints?: string; // e.g., "Impeller p. 42 • Oil & Filter p. 28 • Torque Specs p. 88"
  notes?: string;
  addedAt: string; // YYYY-MM-DD
}

export type ServiceLogStatus = 'completed' | 'deferred' | 'cancelled';

export interface ServiceLogEntry {
  id: string;
  scheduleId?: string;
  title: string;
  category: SystemCategory;
  date: string; // YYYY-MM-DD
  engineHours: number;
  cost: number;
  partsUsed: LinkedPartRequirement[];
  notes: string;
  status?: ServiceLogStatus; // Defaults to 'completed'
  photos?: MaintenancePhoto[];
}

export interface FuelLogEntry {
  id: string;
  date: string; // YYYY-MM-DD
  engineHours: number;
  gallonsAdded: number;
  pricePerGallon?: number;
  totalCost?: number;
  isFullTank: boolean;
  biocideAdded?: boolean; // legacy flag kept for backward compatibility
  additivesUsed?: LinkedPartRequirement[]; // multiple user-defined consumables deducted on fill-up
  notes: string;
}

export interface EngineHoursEntry {
  id: string;
  date: string; // YYYY-MM-DD
  engineHours: number;
  note?: string; // e.g., "Season opener", "Passage milestone", "Winter layup"
}

export type PropulsionMode = 'sail' | 'motor' | 'motor-sail';
export type SeaState = 'calm' | 'slight' | 'moderate' | 'rough' | 'heavy';
export type WeatherSky = 'clear' | 'partly-cloudy' | 'overcast' | 'rain' | 'fog' | 'squall';

export interface SailLeg {
  id: string;
  tripId: string;
  legNumber: number;
  title?: string;
  departurePort: string;
  arrivalPort: string;
  departureTime: string; // ISO datetime YYYY-MM-DDTHH:mm
  arrivalTime?: string;  // ISO datetime YYYY-MM-DDTHH:mm
  distanceNm?: number;
  propulsionMode: PropulsionMode;

  // Engine & Fuel
  startEngineHours?: number;
  endEngineHours?: number;
  engineHoursRun?: number;
  startFuelLevelPercent?: number;
  endFuelLevelPercent?: number;

  // Marine Conditions
  windSpeedKts?: number;
  windGustKts?: number;
  windDirection?: string; // e.g. "NW", "270°"
  seaState?: SeaState;
  weather?: WeatherSky;
  pointOfSail?: string; // e.g. "Beam Reach", "Broad Reach"
  sailsUsed?: string;   // e.g. "Full Main + 130% Genoa"
  barometerHpa?: number;

  // People & Logbook
  captain?: string;
  crew: string[];
  notes?: string;
  anchorageDetails?: string; // e.g. "Anchored in 22ft mud, 110ft chain 5:1 scope"
  photos?: MaintenancePhoto[];

  // GPS AutoLeg Metadata
  departureCoordinates?: { lat: number; lon: number };
  arrivalCoordinates?: { lat: number; lon: number };
  maxSpeedKts?: number;
  avgSpeedKts?: number;
  trackPoints?: GpsFix[];
}

export interface GpsFix {
  lat: number;
  lon: number;
  timestamp: number; // epoch ms
  accuracyMeters?: number;
  speedKts?: number; // SOG
  headingDeg?: number; // COG (0-360)
}

export interface ActiveAutoLeg {
  tripId: string;
  startTime: string; // ISO datetime
  isPaused: boolean;
  pausedAt?: string;
  totalPausedMs: number;
  fixes: GpsFix[];
  distanceNm: number;
  maxSpeedKts: number;
}

export interface SailTrip {
  id: string;
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  status: 'underway' | 'completed';
  captain?: string;
  legs: SailLeg[];
  tripNotes?: string;
  photos?: MaintenancePhoto[];
}

export interface CaptainsDatabase {
  version: number;
  exportedAt: string;
  vessel: VesselProfile;
  schedules: MaintenanceSchedule[];
  serviceLogs: ServiceLogEntry[];
  fuelLogs: FuelLogEntry[];
  parts: PartItem[];
  customCategories?: string[];
  engineHoursLogs?: EngineHoursEntry[];
  sailTrips?: SailTrip[];
  manuals?: VesselManual[];
}
