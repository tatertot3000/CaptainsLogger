import React, { useState, useMemo } from 'react';
import {
  Compass,
  Navigation,
  Wind,
  Clock,
  Calendar,
  Plus,
  Search,
  Sailboat,
  Gauge,
  CheckCircle2,
  Anchor,
  User,
  Pencil,
  Trash2,
  X,
  ChevronDown,
  ChevronRight,
  MapPin,
  Waves,
  Fuel,
  Camera,
  FileText,
  Users,
  Play,
  Pause,
  Flag,
  Sun,
  AlertTriangle,
  Radio,
} from 'lucide-react';
import {
  CaptainsDatabase,
  EngineHoursEntry,
  MaintenancePhoto,
  PropulsionMode,
  SailLeg,
  SailTrip,
  SeaState,
  WeatherSky,
} from '../types';
import { compressImageFile } from '../utils/vendors';
import { IS_DEMO_MODE } from '../utils/demoMode';
import { useGpsAutoLeg, CompletedLegSummary } from '../hooks/useGpsAutoLeg';
import {
  toMarineCoordinates,
  degreesToCompassWithDegrees,
  formatElapsedDuration,
} from '../utils/geo';

interface SailLogViewProps {
  db: CaptainsDatabase;
  onUpdateDb: (updater: (prev: CaptainsDatabase) => CaptainsDatabase) => void;
}

export const SailLogView: React.FC<SailLogViewProps> = ({
  db,
  onUpdateDb,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'underway' | 'completed'>('all');

  // Voyage (Trip) Modal State
  const [showTripModal, setShowTripModal] = useState(false);
  const [editingTrip, setEditingTrip] = useState<SailTrip | null>(null);
  const [tripTitle, setTripTitle] = useState('');
  const [tripStartDate, setTripStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [tripEndDate, setTripEndDate] = useState('');
  const [tripCaptain, setTripCaptain] = useState('');
  const [tripStatusVal, setTripStatusVal] = useState<'underway' | 'completed'>('underway');
  const [tripNotesVal, setTripNotesVal] = useState('');
  const [tripPhotos, setTripPhotos] = useState<MaintenancePhoto[]>([]);
  const [isUploadingTripPhoto, setIsUploadingTripPhoto] = useState(false);

  // GPS AutoLeg Tracker Hook
  const {
    activeLeg,
    currentFix,
    trackingStatus,
    errorMessage: gpsErrorMessage,
    isWakeLockActive,
    elapsedSeconds,
    avgSpeedKts,
    requestGpsPermission,
    startAutoLeg,
    pauseAutoLeg,
    resumeAutoLeg,
    finishAutoLeg,
    cancelAutoLeg,
  } = useGpsAutoLeg();

  // GPS Leg coordinates state for saving with legs
  const [legDepartureCoords, setLegDepartureCoords] = useState<{ lat: number; lon: number } | undefined>();
  const [legArrivalCoords, setLegArrivalCoords] = useState<{ lat: number; lon: number } | undefined>();
  const [legMaxSpeedKts, setLegMaxSpeedKts] = useState<number | undefined>();
  const [legAvgSpeedKts, setLegAvgSpeedKts] = useState<number | undefined>();

  // Expandable trip card state (trips start collapsed/minimized by default)
  const [expandedTripIds, setExpandedTripIds] = useState<Record<string, boolean>>({});

  const toggleTripExpanded = (tripId: string) => {
    setExpandedTripIds((prev) => ({
      ...prev,
      [tripId]: !prev[tripId],
    }));
  };

  const trips = useMemo(() => db.sailTrips || [], [db.sailTrips]);

  const openCreateTripModal = () => {
    setEditingTrip(null);
    setTripTitle('');
    setTripStartDate(new Date().toISOString().slice(0, 10));
    setTripEndDate('');
    setTripCaptain(db.vessel?.name ? `Capt. ${db.vessel.name.split(' ')[0]}` : '');
    setTripStatusVal('underway');
    setTripNotesVal('');
    setTripPhotos([]);
    setShowTripModal(true);
  };

  const openEditTripModal = (trip: SailTrip) => {
    setEditingTrip(trip);
    setTripTitle(trip.title);
    setTripStartDate(trip.startDate);
    setTripEndDate(trip.endDate || '');
    setTripCaptain(trip.captain || '');
    setTripStatusVal(trip.status);
    setTripNotesVal(trip.tripNotes || '');
    setTripPhotos(trip.photos || []);
    setShowTripModal(true);
  };

  const handleSaveTrip = (e: React.FormEvent) => {
    e.preventDefault();
    const finalTitle = tripTitle.trim();
    if (!finalTitle || !tripStartDate) return;

    onUpdateDb((prev) => {
      const existingTrips = prev.sailTrips || [];
      if (editingTrip) {
        return {
          ...prev,
          sailTrips: existingTrips.map((t) =>
            t.id === editingTrip.id
              ? {
                  ...t,
                  title: finalTitle,
                  startDate: tripStartDate,
                  endDate: tripEndDate || undefined,
                  captain: tripCaptain.trim() || undefined,
                  status: tripStatusVal,
                  tripNotes: tripNotesVal.trim() || undefined,
                  photos: tripPhotos.length > 0 ? tripPhotos : undefined,
                }
              : t
          ),
        };
      } else {
        const newTrip: SailTrip = {
          id: 'trip-' + Date.now(),
          title: finalTitle,
          startDate: tripStartDate,
          endDate: tripEndDate || undefined,
          captain: tripCaptain.trim() || undefined,
          status: tripStatusVal,
          legs: [],
          tripNotes: tripNotesVal.trim() || undefined,
          photos: tripPhotos.length > 0 ? tripPhotos : undefined,
        };
        return {
          ...prev,
          sailTrips: [newTrip, ...existingTrips],
        };
      }
    });

    setShowTripModal(false);
    setEditingTrip(null);
  };

  const handleDeleteTrip = (tripId: string) => {
    if (!window.confirm('Are you sure you want to delete this voyage and all its logged legs?')) {
      return;
    }
    onUpdateDb((prev) => ({
      ...prev,
      sailTrips: (prev.sailTrips || []).filter((t) => t.id !== tripId),
    }));
  };

  // Leg Modal State (Step 1B.1 core route inputs)
  const [showLegModal, setShowLegModal] = useState(false);
  const [editingLeg, setEditingLeg] = useState<SailLeg | null>(null);
  const [activeTripForLeg, setActiveTripForLeg] = useState<SailTrip | null>(null);
  const [legTitle, setLegTitle] = useState('');
  const [legDeparturePort, setLegDeparturePort] = useState('');
  const [legArrivalPort, setLegArrivalPort] = useState('');
  const [legDepartureTime, setLegDepartureTime] = useState('');
  const [legArrivalTime, setLegArrivalTime] = useState('');
  const [legDistanceNm, setLegDistanceNm] = useState('');
  const [legPropulsionMode, setLegPropulsionMode] = useState<PropulsionMode>('sail');

  // Step 1B.2 Marine Conditions & Sail Trim
  const [legWindSpeed, setLegWindSpeed] = useState('');
  const [legWindGust, setLegWindGust] = useState('');
  const [legWindDirection, setLegWindDirection] = useState('');
  const [legSeaState, setLegSeaState] = useState<SeaState | ''>('');
  const [legWeather, setLegWeather] = useState<WeatherSky | ''>('');
  const [legBarometer, setLegBarometer] = useState('');
  const [legPointOfSail, setLegPointOfSail] = useState('');
  const [legSailsUsed, setLegSailsUsed] = useState('');

  // Step 1B.3 Engine Hours & Fuel Tracking
  const [legStartEngineHours, setLegStartEngineHours] = useState('');
  const [legEndEngineHours, setLegEndEngineHours] = useState('');
  const [legStartFuelPercent, setLegStartFuelPercent] = useState('');
  const [legEndFuelPercent, setLegEndFuelPercent] = useState('');
  const [syncVesselEngineHours, setSyncVesselEngineHours] = useState(true);

  // Step 1B.4 Crew Manifest, Anchorage & Passage Journal Notes, Photos
  const [legCrewText, setLegCrewText] = useState('');
  const [legAnchorageDetails, setLegAnchorageDetails] = useState('');
  const [legNotes, setLegNotes] = useState('');
  const [legPhotos, setLegPhotos] = useState<MaintenancePhoto[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [expandedLegIds, setExpandedLegIds] = useState<Record<string, boolean>>({});
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  const toggleLegExpanded = (legId: string) => {
    setExpandedLegIds((prev) => ({
      ...prev,
      [legId]: !prev[legId],
    }));
  };

  const compressSelectedPhotos = async (files: FileList | null): Promise<MaintenancePhoto[]> => {
    if (!files || files.length === 0) return [];
    try {
      const fileArray = Array.from(files);
      const promises = fileArray.map(async (file) => {
        const isImage =
          file.type.startsWith('image/') ||
          /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i.test(file.name);
        if (!isImage) return null;
        return await compressImageFile(file, 1024, 0.75);
      });
      const settled = await Promise.allSettled(promises);
      const newUrls: string[] = settled
        .filter(
          (r): r is PromiseFulfilledResult<string | null> =>
            r.status === 'fulfilled' && r.value !== null
        )
        .map((r) => r.value as string);

      if (newUrls.length > 0) {
        const today = new Date().toISOString().slice(0, 10);
        return newUrls.map((url, idx) => ({
          id: `sail-photo-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          dataUrl: url,
          addedAt: today,
        }));
      }
      return [];
    } catch (err) {
      console.error('Failed to compress passage photo:', err);
      return [];
    }
  };

  const handlePhotoFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploadingPhoto(true);
    try {
      const added = await compressSelectedPhotos(files);
      if (added.length > 0) {
        setLegPhotos((prev) => [...prev, ...added]);
      }
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const removeLegPhoto = (indexToRemove: number) => {
    setLegPhotos((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleTripModalPhotosSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploadingTripPhoto(true);
    try {
      const added = await compressSelectedPhotos(files);
      if (added.length > 0) {
        setTripPhotos((prev) => [...prev, ...added]);
      }
    } finally {
      setIsUploadingTripPhoto(false);
    }
  };

  const removeTripModalPhoto = (indexToRemove: number) => {
    setTripPhotos((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleDirectUploadTripPhotos = async (tripId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploadingPhoto(true);
    try {
      const added = await compressSelectedPhotos(files);
      if (added.length > 0) {
        onUpdateDb((prev) => ({
          ...prev,
          sailTrips: (prev.sailTrips || []).map((t) =>
            t.id === tripId
              ? { ...t, photos: [...(t.photos || []), ...added] }
              : t
          ),
        }));
      }
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleDeleteTripPhoto = (tripId: string, photoIdOrIdx: string | number) => {
    onUpdateDb((prev) => ({
      ...prev,
      sailTrips: (prev.sailTrips || []).map((t) =>
        t.id === tripId
          ? {
              ...t,
              photos: (t.photos || []).filter((p, idx) =>
                p.id ? p.id !== photoIdOrIdx : idx !== photoIdOrIdx
              ),
            }
          : t
      ),
    }));
  };

  const getCurrentLocalDateTime = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const local = new Date(now.getTime() - offset);
    return local.toISOString().slice(0, 16);
  };

  const openCreateLegModal = (trip: SailTrip) => {
    setActiveTripForLeg(trip);
    setEditingLeg(null);
    const prevLeg = trip.legs && trip.legs.length > 0 ? trip.legs[trip.legs.length - 1] : null;
    const legNum = (trip.legs?.length || 0) + 1;
    setLegTitle(`Leg ${legNum}`);
    setLegDeparturePort(prevLeg ? prevLeg.arrivalPort : '');
    setLegArrivalPort('');
    setLegDepartureTime(getCurrentLocalDateTime());
    setLegArrivalTime('');
    setLegDistanceNm('');
    setLegPropulsionMode('sail');
    setLegWindSpeed('');
    setLegWindGust('');
    setLegWindDirection('');
    setLegSeaState('');
    setLegWeather('');
    setLegBarometer('');
    setLegPointOfSail('');
    setLegSailsUsed('');

    // Pre-populate engine hours from previous leg arrival, or vessel currentEngineHours
    const initialStartHours =
      prevLeg?.endEngineHours !== undefined
        ? prevLeg.endEngineHours
        : db.vessel?.currentEngineHours;
    setLegStartEngineHours(initialStartHours !== undefined ? String(initialStartHours) : '');
    setLegEndEngineHours('');
    setLegStartFuelPercent(
      prevLeg?.endFuelLevelPercent !== undefined ? String(prevLeg.endFuelLevelPercent) : ''
    );
    setLegEndFuelPercent('');
    setSyncVesselEngineHours(true);

    // Step 1B.4 Crew, Anchorage, Notes & Photos
    setLegCrewText(prevLeg?.crew && prevLeg.crew.length > 0 ? prevLeg.crew.join(', ') : '');
    setLegAnchorageDetails('');
    setLegNotes('');
    setLegPhotos([]);

    setLegDepartureCoords(undefined);
    setLegArrivalCoords(undefined);
    setLegMaxSpeedKts(undefined);
    setLegAvgSpeedKts(undefined);

    setShowLegModal(true);
  };

  const openCreateLegModalWithGps = (trip: SailTrip, summary: CompletedLegSummary) => {
    setActiveTripForLeg(trip);
    setEditingLeg(null);
    const prevLeg = trip.legs && trip.legs.length > 0 ? trip.legs[trip.legs.length - 1] : null;
    const legNum = (trip.legs?.length || 0) + 1;
    setLegTitle(`Leg ${legNum}`);
    setLegDeparturePort(prevLeg ? prevLeg.arrivalPort : '');
    setLegArrivalPort('');
    setLegDepartureTime(summary.departureTime || getCurrentLocalDateTime());
    setLegArrivalTime(summary.arrivalTime || getCurrentLocalDateTime());
    setLegDistanceNm(summary.distanceNm > 0 ? String(summary.distanceNm) : '');
    setLegPropulsionMode('sail');
    setLegWindSpeed('');
    setLegWindGust('');
    setLegWindDirection('');
    setLegSeaState('');
    setLegWeather('');
    setLegBarometer('');
    setLegPointOfSail('');
    setLegSailsUsed('');

    const initialStartHours =
      prevLeg?.endEngineHours !== undefined
        ? prevLeg.endEngineHours
        : db.vessel?.currentEngineHours;
    setLegStartEngineHours(initialStartHours !== undefined ? String(initialStartHours) : '');
    setLegEndEngineHours('');
    setLegStartFuelPercent(
      prevLeg?.endFuelLevelPercent !== undefined ? String(prevLeg.endFuelLevelPercent) : ''
    );
    setLegEndFuelPercent('');
    setSyncVesselEngineHours(true);

    setLegCrewText(prevLeg?.crew && prevLeg.crew.length > 0 ? prevLeg.crew.join(', ') : '');
    setLegAnchorageDetails('');
    setLegNotes(
      `Logged with GPS AutoLeg: ${summary.distanceNm} NM in ${formatElapsedDuration(summary.elapsedSeconds)}${
        summary.maxSpeedKts ? `, max SOG ${summary.maxSpeedKts} kts` : ''
      }${summary.avgSpeedKts ? `, avg ${summary.avgSpeedKts} kts` : ''}.`
    );
    setLegPhotos([]);

    setLegDepartureCoords(summary.departureCoordinates);
    setLegArrivalCoords(summary.arrivalCoordinates);
    setLegMaxSpeedKts(summary.maxSpeedKts);
    setLegAvgSpeedKts(summary.avgSpeedKts);

    setShowLegModal(true);
  };

  const handleFinishAutoLegClick = (targetTripId?: string) => {
    const tripToFinish = trips.find((t) => t.id === (targetTripId || activeLeg?.tripId));
    const summary = finishAutoLeg();
    if (!summary) return;

    if (tripToFinish) {
      openCreateLegModalWithGps(tripToFinish, summary);
    }
  };

  const openEditLegModal = (trip: SailTrip, leg: SailLeg) => {
    setActiveTripForLeg(trip);
    setEditingLeg(leg);
    setLegTitle(leg.title || `Leg ${leg.legNumber}`);
    setLegDeparturePort(leg.departurePort);
    setLegArrivalPort(leg.arrivalPort);
    setLegDepartureTime(leg.departureTime || '');
    setLegArrivalTime(leg.arrivalTime || '');
    setLegDistanceNm(leg.distanceNm !== undefined ? String(leg.distanceNm) : '');
    setLegPropulsionMode(leg.propulsionMode);
    setLegWindSpeed(leg.windSpeedKts !== undefined ? String(leg.windSpeedKts) : '');
    setLegWindGust(leg.windGustKts !== undefined ? String(leg.windGustKts) : '');
    setLegWindDirection(leg.windDirection || '');
    setLegSeaState(leg.seaState || '');
    setLegWeather(leg.weather || '');
    setLegBarometer(leg.barometerHpa !== undefined ? String(leg.barometerHpa) : '');
    setLegPointOfSail(leg.pointOfSail || '');
    setLegSailsUsed(leg.sailsUsed || '');

    setLegStartEngineHours(
      leg.startEngineHours !== undefined ? String(leg.startEngineHours) : ''
    );
    setLegEndEngineHours(
      leg.endEngineHours !== undefined ? String(leg.endEngineHours) : ''
    );
    setLegStartFuelPercent(
      leg.startFuelLevelPercent !== undefined ? String(leg.startFuelLevelPercent) : ''
    );
    setLegEndFuelPercent(
      leg.endFuelLevelPercent !== undefined ? String(leg.endFuelLevelPercent) : ''
    );
    setSyncVesselEngineHours(false);

    // Step 1B.4 Crew, Anchorage, Notes & Photos
    setLegCrewText(leg.crew ? leg.crew.join(', ') : '');
    setLegAnchorageDetails(leg.anchorageDetails || '');
    setLegNotes(leg.notes || '');
    setLegPhotos(leg.photos ? [...leg.photos] : []);

    setLegDepartureCoords(leg.departureCoordinates);
    setLegArrivalCoords(leg.arrivalCoordinates);
    setLegMaxSpeedKts(leg.maxSpeedKts);
    setLegAvgSpeedKts(leg.avgSpeedKts);

    setShowLegModal(true);
  };

  const calculatedDuration = useMemo(() => {
    if (!legDepartureTime || !legArrivalTime) return null;
    const dep = new Date(legDepartureTime).getTime();
    const arr = new Date(legArrivalTime).getTime();
    if (isNaN(dep) || isNaN(arr) || arr <= dep) return null;
    const totalMins = Math.round((arr - dep) / 60000);
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return `${hours}h ${mins}m`;
  }, [legDepartureTime, legArrivalTime]);

  const calculatedEngineRun = useMemo(() => {
    const start = parseFloat(legStartEngineHours);
    const end = parseFloat(legEndEngineHours);
    if (!isNaN(start) && !isNaN(end) && end >= start) {
      return Math.round((end - start) * 10) / 10;
    }
    return null;
  }, [legStartEngineHours, legEndEngineHours]);

  const handleSaveLeg = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTripForLeg || !legDeparturePort.trim() || !legArrivalPort.trim() || !legDepartureTime) {
      return;
    }

    const distNum = parseFloat(legDistanceNm);
    const windSpeedNum = parseFloat(legWindSpeed);
    const windGustNum = parseFloat(legWindGust);
    const baroNum = parseFloat(legBarometer);

    const startEngNum = parseFloat(legStartEngineHours);
    const endEngNum = parseFloat(legEndEngineHours);
    const validStartEng = !isNaN(startEngNum) && startEngNum >= 0 ? startEngNum : undefined;
    const validEndEng = !isNaN(endEngNum) && endEngNum >= 0 ? endEngNum : undefined;
    const validEngRun =
      validStartEng !== undefined && validEndEng !== undefined && validEndEng >= validStartEng
        ? Math.round((validEndEng - validStartEng) * 10) / 10
        : undefined;

    const startFuelNum = parseFloat(legStartFuelPercent);
    const endFuelNum = parseFloat(legEndFuelPercent);
    const validStartFuel =
      !isNaN(startFuelNum) && startFuelNum >= 0 && startFuelNum <= 100 ? startFuelNum : undefined;
    const validEndFuel =
      !isNaN(endFuelNum) && endFuelNum >= 0 && endFuelNum <= 100 ? endFuelNum : undefined;

    const crewArray = legCrewText
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    onUpdateDb((prev) => {
      const currentTrips = prev.sailTrips || [];
      const updatedTrips = currentTrips.map((t) => {
        if (t.id !== activeTripForLeg.id) return t;
        const currentLegs = t.legs || [];

        if (editingLeg) {
          const updatedLegs = currentLegs.map((l) =>
            l.id === editingLeg.id
              ? {
                  ...l,
                  title: legTitle.trim() || undefined,
                  departurePort: legDeparturePort.trim(),
                  arrivalPort: legArrivalPort.trim(),
                  departureTime: legDepartureTime,
                  arrivalTime: legArrivalTime || undefined,
                  distanceNm: !isNaN(distNum) && distNum >= 0 ? distNum : undefined,
                  propulsionMode: legPropulsionMode,
                  windSpeedKts: !isNaN(windSpeedNum) && windSpeedNum >= 0 ? windSpeedNum : undefined,
                  windGustKts: !isNaN(windGustNum) && windGustNum >= 0 ? windGustNum : undefined,
                  windDirection: legWindDirection.trim() || undefined,
                  seaState: legSeaState || undefined,
                  weather: legWeather || undefined,
                  barometerHpa: !isNaN(baroNum) && baroNum > 0 ? baroNum : undefined,
                  pointOfSail: legPointOfSail.trim() || undefined,
                  sailsUsed: legSailsUsed.trim() || undefined,
                  startEngineHours: validStartEng,
                  endEngineHours: validEndEng,
                  engineHoursRun: validEngRun,
                  startFuelLevelPercent: validStartFuel,
                  endFuelLevelPercent: validEndFuel,
                  crew: crewArray,
                  anchorageDetails: legAnchorageDetails.trim() || undefined,
                  notes: legNotes.trim() || undefined,
                  photos: legPhotos.length > 0 ? legPhotos : undefined,
                  departureCoordinates: legDepartureCoords,
                  arrivalCoordinates: legArrivalCoords,
                  maxSpeedKts: legMaxSpeedKts,
                  avgSpeedKts: legAvgSpeedKts,
                }
              : l
          );
          return { ...t, legs: updatedLegs };
        } else {
          const newLeg: SailLeg = {
            id: 'leg-' + Date.now(),
            tripId: t.id,
            legNumber: currentLegs.length + 1,
            title: legTitle.trim() || undefined,
            departurePort: legDeparturePort.trim(),
            arrivalPort: legArrivalPort.trim(),
            departureTime: legDepartureTime,
            arrivalTime: legArrivalTime || undefined,
            distanceNm: !isNaN(distNum) && distNum >= 0 ? distNum : undefined,
            propulsionMode: legPropulsionMode,
            windSpeedKts: !isNaN(windSpeedNum) && windSpeedNum >= 0 ? windSpeedNum : undefined,
            windGustKts: !isNaN(windGustNum) && windGustNum >= 0 ? windGustNum : undefined,
            windDirection: legWindDirection.trim() || undefined,
            seaState: legSeaState || undefined,
            weather: legWeather || undefined,
            barometerHpa: !isNaN(baroNum) && baroNum > 0 ? baroNum : undefined,
            pointOfSail: legPointOfSail.trim() || undefined,
            sailsUsed: legSailsUsed.trim() || undefined,
            startEngineHours: validStartEng,
            endEngineHours: validEndEng,
            engineHoursRun: validEngRun,
            startFuelLevelPercent: validStartFuel,
            endFuelLevelPercent: validEndFuel,
            crew: crewArray,
            anchorageDetails: legAnchorageDetails.trim() || undefined,
            notes: legNotes.trim() || undefined,
            photos: legPhotos.length > 0 ? legPhotos : undefined,
            departureCoordinates: legDepartureCoords,
            arrivalCoordinates: legArrivalCoords,
            maxSpeedKts: legMaxSpeedKts,
            avgSpeedKts: legAvgSpeedKts,
          };
          return { ...t, legs: [...currentLegs, newLeg] };
        }
      });

      // Synchronize with vessel profile if requested and arrival engine hours are set
      let updatedVessel = prev.vessel;
      let updatedEngineHoursLogs = prev.engineHoursLogs || [];

      if (syncVesselEngineHours && validEndEng !== undefined && validEndEng > 0) {
        if (validEndEng > (prev.vessel?.currentEngineHours || 0)) {
          updatedVessel = {
            ...prev.vessel,
            currentEngineHours: validEndEng,
          };

          const logDate = legArrivalTime
            ? legArrivalTime.slice(0, 10)
            : legDepartureTime.slice(0, 10);

          const newEngineLog: EngineHoursEntry = {
            id: 'eng-' + Date.now(),
            date: logDate,
            engineHours: validEndEng,
            note: `Auto-synced from passage: ${legDeparturePort.trim()} → ${legArrivalPort.trim()}`,
          };

          updatedEngineHoursLogs = [newEngineLog, ...updatedEngineHoursLogs];
        }
      }

      return {
        ...prev,
        vessel: updatedVessel,
        engineHoursLogs: updatedEngineHoursLogs,
        sailTrips: updatedTrips,
      };
    });

    setShowLegModal(false);
    setEditingLeg(null);
  };

  const handleDeleteLeg = (tripId: string, legId: string) => {
    if (!window.confirm('Delete this passage leg?')) return;
    onUpdateDb((prev) => ({
      ...prev,
      sailTrips: (prev.sailTrips || []).map((t) =>
        t.id === tripId
          ? {
              ...t,
              legs: (t.legs || [])
                .filter((l) => l.id !== legId)
                .map((l, idx) => ({ ...l, legNumber: idx + 1 })),
            }
          : t
      ),
    }));
  };

  // Overall statistics aggregated across all trips and legs
  const stats = useMemo(() => {
    let totalNm = 0;
    let totalUnderwayMinutes = 0;
    let totalSailMinutes = 0;
    let totalEngineHoursRun = 0;
    let totalLegsCount = 0;

    trips.forEach((trip) => {
      (trip.legs || []).forEach((leg) => {
        totalLegsCount++;
        if (leg.distanceNm) totalNm += leg.distanceNm;

        // Calculate underway time if departure and arrival exist
        if (leg.departureTime && leg.arrivalTime) {
          const dep = new Date(leg.departureTime).getTime();
          const arr = new Date(leg.arrivalTime).getTime();
          if (!isNaN(dep) && !isNaN(arr) && arr > dep) {
            const minutes = (arr - dep) / (1000 * 60);
            totalUnderwayMinutes += minutes;
            if (leg.propulsionMode === 'sail') {
              totalSailMinutes += minutes;
            } else if (leg.propulsionMode === 'motor-sail') {
              totalSailMinutes += minutes * 0.5; // Half credit for motor-sailing
            }
          }
        }

        // Engine hours run
        if (
          leg.startEngineHours !== undefined &&
          leg.endEngineHours !== undefined &&
          leg.endEngineHours >= leg.startEngineHours
        ) {
          totalEngineHoursRun += leg.endEngineHours - leg.startEngineHours;
        }
      });
    });

    const totalUnderwayHours = Math.round((totalUnderwayMinutes / 60) * 10) / 10;
    const sailPercent =
      totalUnderwayMinutes > 0
        ? Math.round((totalSailMinutes / totalUnderwayMinutes) * 100)
        : 0;

    return {
      totalTrips: trips.length,
      totalLegs: totalLegsCount,
      totalNm: Math.round(totalNm * 10) / 10,
      totalUnderwayHours,
      totalEngineHoursRun: Math.round(totalEngineHoursRun * 10) / 10,
      sailPercent,
    };
  }, [trips]);

  // Filtered trips
  const filteredTrips = useMemo(() => {
    return trips.filter((trip) => {
      // 1. Status filter
      if (statusFilter !== 'all' && trip.status !== statusFilter) {
        return false;
      }

      // 2. Search query filter (matches trip title, captain, notes, ports, or crew)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = trip.title.toLowerCase().includes(q);
        const matchesCaptain = Boolean(trip.captain?.toLowerCase().includes(q));
        const matchesNotes = Boolean(trip.tripNotes?.toLowerCase().includes(q));
        const matchesLegs = (trip.legs || []).some(
          (leg) =>
            leg.departurePort.toLowerCase().includes(q) ||
            leg.arrivalPort.toLowerCase().includes(q) ||
            (leg.title && leg.title.toLowerCase().includes(q)) ||
            (leg.notes && leg.notes.toLowerCase().includes(q)) ||
            leg.crew.some((c) => c.toLowerCase().includes(q))
        );
        if (!matchesTitle && !matchesCaptain && !matchesNotes && !matchesLegs) {
          return false;
        }
      }

      return true;
    });
  }, [trips, statusFilter, searchQuery]);

  return (
    <div className="space-y-4 pb-20">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 sm:p-3 shadow-sm">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="truncate">Total Passages</span>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-white mt-0.5 sm:mt-1 truncate">
            {stats.totalTrips}{' '}
            <span className="text-[11px] sm:text-xs font-normal text-slate-400">
              ({stats.totalLegs} {stats.totalLegs === 1 ? 'leg' : 'legs'})
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 sm:p-3 shadow-sm">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span className="truncate">Distance Run</span>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-white mt-0.5 sm:mt-1 truncate">
            {stats.totalNm}{' '}
            <span className="text-[11px] sm:text-xs font-normal text-slate-400">NM</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 sm:p-3 shadow-sm">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">Time Underway</span>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-white mt-0.5 sm:mt-1 truncate">
            {stats.totalUnderwayHours}{' '}
            <span className="text-[11px] sm:text-xs font-normal text-slate-400">hrs</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 sm:p-3 shadow-sm">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
            <Wind className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">Sailing Ratio</span>
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono text-emerald-400 mt-0.5 sm:mt-1 truncate">
            {stats.sailPercent}%{' '}
            <span className="text-[11px] sm:text-xs font-normal text-slate-400 font-sans">by sail</span>
          </div>
        </div>
      </div>

      {/* Action & Filter Bar */}
      <div className="bg-slate-900/90 border border-slate-800 p-2.5 sm:p-3 rounded-xl space-y-2.5 sm:space-y-3">
        <div className="flex items-center justify-between gap-2">
          {/* Status filter buttons */}
          <div className="flex bg-slate-950 p-0.5 sm:p-1 rounded-lg border border-slate-800 text-[11px] sm:text-xs font-semibold overflow-x-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md transition whitespace-nowrap ${
                statusFilter === 'all'
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({trips.length})
            </button>
            <button
              onClick={() => setStatusFilter('underway')}
              className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md transition flex items-center gap-1 sm:gap-1.5 whitespace-nowrap ${
                statusFilter === 'underway'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span>Underway</span>
              <span className="text-[10px] opacity-80">({trips.filter((t) => t.status === 'underway').length})</span>
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md transition whitespace-nowrap ${
                statusFilter === 'completed'
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Completed</span>
              <span className="text-[10px] opacity-80 ml-1">({trips.filter((t) => t.status === 'completed').length})</span>
            </button>
          </div>

          {/* New Voyage button */}
          <button
            onClick={openCreateTripModal}
            className="flex items-center gap-1 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg transition shadow cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="hidden sm:inline">New Voyage</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by destination, port, crew, or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs px-1"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Active GPS AutoLeg Cockpit HUD */}
      {activeLeg && (
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950/40 border-2 border-teal-500/50 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4">
          {/* Header Row: Status, Wake Lock, Actions */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span
                className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${
                  activeLeg.isPaused
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}
              >
                <Radio
                  className={`w-3.5 h-3.5 ${
                    activeLeg.isPaused ? 'text-amber-400' : 'text-emerald-400 animate-pulse'
                  }`}
                />
                <span>{activeLeg.isPaused ? 'GPS AutoLeg Paused' : 'GPS AutoLeg Underway'}</span>
              </span>

              <span className="text-xs text-slate-300 font-semibold truncate">
                for{' '}
                <span className="text-white font-bold">
                  {trips.find((t) => t.id === activeLeg.tripId)?.title || 'Active Voyage'}
                </span>
              </span>

              {isWakeLockActive && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] bg-slate-800 text-amber-300 border border-slate-700 px-2 py-0.5 rounded-full font-medium">
                  <Sun className="w-3 h-3 text-amber-400" /> Screen Kept Awake
                </span>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
              {activeLeg.isPaused ? (
                <button
                  type="button"
                  onClick={resumeAutoLeg}
                  className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-lg transition shadow cursor-pointer"
                  title="Resume tracking position and speed"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Resume</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={pauseAutoLeg}
                  className="flex items-center gap-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs px-3 py-1.5 rounded-lg transition cursor-pointer"
                  title="Pause tracking (for anchorage, lunch stop, etc.)"
                >
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Pause</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleFinishAutoLegClick()}
                className="flex items-center gap-1 bg-teal-500 hover:bg-teal-400 text-slate-950 font-extrabold text-xs px-3.5 py-1.5 rounded-lg transition shadow cursor-pointer"
                title="Stop GPS tracking and open Leg Logbook to save"
              >
                <Flag className="w-3.5 h-3.5 fill-current" />
                <span>Finish Leg</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      'Discard active GPS AutoLeg tracking? Unsaved GPS distance will be lost.'
                    )
                  ) {
                    cancelAutoLeg();
                  }
                }}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                title="Cancel / Discard AutoLeg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Large High-Contrast Cockpit Gauges */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 text-center">
            {/* Gauge 1: SOG (Speed Over Ground) */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 sm:p-4 space-y-1">
              <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-center gap-1">
                <Gauge className="w-3.5 h-3.5 text-teal-400" />
                <span>Boat Speed (SOG)</span>
              </div>
              <div className="text-3xl sm:text-4xl font-black font-mono text-emerald-400 tracking-tight">
                {currentFix?.speedKts != null ? currentFix.speedKts.toFixed(1) : '0.0'}{' '}
                <span className="text-xs sm:text-sm font-semibold text-slate-400">kts</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                Avg: <strong className="text-slate-200">{avgSpeedKts}</strong> • Max:{' '}
                <strong className="text-slate-200">{activeLeg.maxSpeedKts || 0}</strong> kts
              </div>
            </div>

            {/* Gauge 2: Distance Run */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 sm:p-4 space-y-1">
              <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-center gap-1">
                <Navigation className="w-3.5 h-3.5 text-sky-400" />
                <span>Distance Run</span>
              </div>
              <div className="text-3xl sm:text-4xl font-black font-mono text-sky-300 tracking-tight">
                {activeLeg.distanceNm.toFixed(2)}{' '}
                <span className="text-xs sm:text-sm font-semibold text-slate-400">NM</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {activeLeg.fixes.length} fixes logged
              </div>
            </div>

            {/* Gauge 3: Elapsed Time */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 sm:p-4 space-y-1">
              <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Elapsed Underway</span>
              </div>
              <div className="text-3xl sm:text-4xl font-black font-mono text-amber-300 tracking-tight">
                {formatElapsedDuration(elapsedSeconds)}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                Departed{' '}
                {new Date(activeLeg.startTime).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>

            {/* Gauge 4: Course Over Ground (COG) */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 sm:p-4 space-y-1">
              <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-center gap-1">
                <Compass className="w-3.5 h-3.5 text-rose-400" />
                <span>Course (COG)</span>
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-rose-300 tracking-tight pt-1 truncate">
                {currentFix?.headingDeg != null
                  ? degreesToCompassWithDegrees(currentFix.headingDeg)
                  : '---'}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">True Heading</div>
            </div>
          </div>

          {/* Footer Bar: Marine Coordinates & Accuracy */}
          <div className="flex items-center justify-between gap-2 flex-wrap text-xs pt-1 border-t border-slate-800/80 text-slate-400">
            <div className="flex items-center gap-1.5 font-mono">
              <MapPin className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <span>
                {currentFix
                  ? toMarineCoordinates(currentFix.lat, currentFix.lon)
                  : 'Acquiring GPS fix...'}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {currentFix?.accuracyMeters != null && (
                <span className="text-[11px] font-mono text-slate-400">
                  Fix: <span className="text-emerald-400">±{currentFix.accuracyMeters}m</span>
                </span>
              )}
            </div>
          </div>

          {gpsErrorMessage && (
            <div className="flex items-center justify-between gap-3 bg-rose-950/40 border border-rose-500/50 text-rose-300 text-xs px-3 py-2.5 rounded-xl flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="break-words">{gpsErrorMessage}</span>
              </div>
              {trackingStatus === 'permission-denied' && (
                <button
                  type="button"
                  onClick={() => requestGpsPermission()}
                  className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition shrink-0 cursor-pointer shadow"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Grant Permission</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Trips / Voyages List */}
      {filteredTrips.length === 0 ? (
        <div className="text-center py-12 px-4 bg-slate-900/50 border border-slate-800/80 rounded-2xl space-y-3">
          <Sailboat className="w-12 h-12 text-slate-600 mx-auto stroke-[1.5]" />
          <h3 className="text-base font-bold text-slate-200">
            {trips.length === 0 ? 'No Voyages Logged Yet' : 'No Matching Voyages'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {trips.length === 0
              ? 'Start logging your passages, multi-leg cruises, weather conditions, engine hours, and sea stories.'
              : 'Try clearing your search query or switching your status filter.'}
          </p>
          {trips.length === 0 && (
            <button
              onClick={openCreateTripModal}
              className="inline-flex items-center gap-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs px-4 py-2 rounded-lg transition shadow mt-1 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Log Your First Voyage</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTrips.map((trip) => {
            const isExpanded = Boolean(expandedTripIds[trip.id]);
            const legCount = trip.legs?.length || 0;

            // Rollup metrics for this specific voyage
            let tripNm = 0;
            let tripUnderwayMinutes = 0;
            let tripSailMinutes = 0;
            let tripEngineHoursRun = 0;

            (trip.legs || []).forEach((leg) => {
              if (leg.distanceNm) tripNm += leg.distanceNm;
              if (leg.departureTime && leg.arrivalTime) {
                const dep = new Date(leg.departureTime).getTime();
                const arr = new Date(leg.arrivalTime).getTime();
                if (!isNaN(dep) && !isNaN(arr) && arr > dep) {
                  const mins = (arr - dep) / (1000 * 60);
                  tripUnderwayMinutes += mins;
                  if (leg.propulsionMode === 'sail') tripSailMinutes += mins;
                  else if (leg.propulsionMode === 'motor-sail') tripSailMinutes += mins * 0.5;
                }
              }
              if (
                leg.startEngineHours !== undefined &&
                leg.endEngineHours !== undefined &&
                leg.endEngineHours >= leg.startEngineHours
              ) {
                tripEngineHoursRun += leg.endEngineHours - leg.startEngineHours;
              }
            });

            const tripUnderwayHours = Math.round((tripUnderwayMinutes / 60) * 10) / 10;
            const tripSailPercent =
              tripUnderwayMinutes > 0
                ? Math.round((tripSailMinutes / tripUnderwayMinutes) * 100)
                : 0;

            return (
              <div
                key={trip.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 shadow-sm hover:border-slate-700 transition"
              >
                {/* Trip Header (Clickable to toggle collapse/expand) */}
                <div className="space-y-2">
                  {/* Row 1: Status & Date Badges + Stats & Action Buttons */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span
                        className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                          trip.status === 'underway'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                        }`}
                      >
                        {trip.status === 'underway' ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            UNDERWAY
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-sky-400" />
                            COMPLETED
                          </>
                        )}
                      </span>

                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        {trip.startDate}
                        {trip.endDate && trip.endDate !== trip.startDate && ` → ${trip.endDate}`}
                      </span>

                      {trip.captain && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-500" />
                          {trip.captain}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-auto">
                      <div className="text-right text-xs">
                        <div className="text-teal-400 font-mono font-bold flex items-center justify-end gap-1">
                          <Navigation className="w-3.5 h-3.5" />
                          <span>{Math.round(tripNm * 10) / 10} NM</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {legCount} {legCount === 1 ? 'leg' : 'legs'}
                        </div>
                      </div>

                      {/* Trip actions */}
                      <div className="flex items-center gap-1 pl-1 border-l border-slate-800">
                        <button
                          type="button"
                          onClick={() => openEditTripModal(trip)}
                          className="p-1.5 text-slate-400 hover:text-sky-300 hover:bg-slate-800 rounded-lg transition"
                          title="Edit voyage details"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTrip(trip.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition"
                          title="Delete voyage"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Dedicated Full-Width Voyage Title */}
                  <button
                    type="button"
                    onClick={() => toggleTripExpanded(trip.id)}
                    className="min-w-0 text-left w-full group cursor-pointer block pt-0.5"
                  >
                    <h3 className="text-base font-bold text-slate-100 group-hover:text-sky-300 transition flex items-start gap-1.5 w-full">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-sky-400 shrink-0 mt-1" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-sky-400 shrink-0 mt-1" />
                      )}
                      <span className="w-full break-words">{trip.title}</span>
                    </h3>
                  </button>
                </div>

                {trip.tripNotes && (
                  <p className="text-xs text-slate-300 leading-relaxed italic border-t border-slate-800/60 pt-2">
                    "{trip.tripNotes}"
                  </p>
                )}

                {/* Expanded Legs & Voyage Summary Section */}
                {isExpanded && (
                  <div className="space-y-3 pt-2 border-t border-slate-800/80">
                    {/* Voyage Metrics Rollup Strip */}
                    <div className="grid grid-cols-4 gap-2 bg-slate-950/80 border border-slate-800/80 rounded-xl p-2.5 text-center">
                      <div>
                        <div className="text-[9px] uppercase font-bold text-slate-400">Distance</div>
                        <div className="text-xs font-bold font-mono text-teal-300 mt-0.5">
                          {Math.round(tripNm * 10) / 10} <span className="text-[9px] font-normal text-slate-400">NM</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase font-bold text-slate-400">Underway</div>
                        <div className="text-xs font-bold font-mono text-amber-300 mt-0.5">
                          {tripUnderwayHours} <span className="text-[9px] font-normal text-slate-400">h</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase font-bold text-slate-400">Engine Run</div>
                        <div className="text-xs font-bold font-mono text-sky-300 mt-0.5">
                          {Math.round(tripEngineHoursRun * 10) / 10} <span className="text-[9px] font-normal text-slate-400">h</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase font-bold text-slate-400">Sail Ratio</div>
                        <div className="text-xs font-bold font-mono text-emerald-400 mt-0.5">
                          {tripSailPercent}%
                        </div>
                      </div>
                    </div>

                    {/* Voyage Summary Photos Section */}
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                            <Camera className="w-3.5 h-3.5 text-sky-400" />
                            Voyage Photos ({trip.photos?.length || 0})
                          </span>
                          {(() => {
                            const legPhotosCount = (trip.legs || []).reduce(
                              (sum, l) => sum + (l.photos?.length || 0),
                              0
                            );
                            const totalAllPhotos = (trip.photos?.length || 0) + legPhotosCount;
                            if (legPhotosCount > 0) {
                              return (
                                <span className="text-[10px] bg-slate-900 border border-slate-700/80 text-slate-400 px-2 py-0.5 rounded-full">
                                  {totalAllPhotos} total with legs
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>

                        {/* Direct Upload to Voyage (Disabled in Demo Mode) */}
                        {!IS_DEMO_MODE ? (
                          <label className="flex items-center gap-1 text-[11px] font-bold text-sky-300 bg-sky-950/50 hover:bg-sky-900/60 border border-sky-800/60 rounded-lg px-2.5 py-1 transition cursor-pointer">
                            <Camera className="w-3 h-3 stroke-[2.5]" />
                            <span>{isUploadingPhoto ? 'Uploading...' : '+ Add Photos'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              disabled={isUploadingPhoto}
                              className="hidden"
                              onChange={(e) => {
                                void handleDirectUploadTripPhotos(trip.id, e.target.files);
                                e.target.value = '';
                              }}
                            />
                          </label>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-medium">Demo Mode</span>
                        )}
                      </div>

                      {/* Voyage-level Photos Thumbnails */}
                      {trip.photos && trip.photos.length > 0 ? (
                        <div className="flex gap-2 overflow-x-auto pb-1 pt-0.5">
                          {trip.photos.map((photo, pIdx) => (
                            <div
                              key={photo.id || pIdx}
                              className="relative group rounded-lg overflow-hidden border border-slate-700 bg-slate-900 w-20 h-20 shrink-0"
                            >
                              <img
                                src={photo.dataUrl}
                                alt={photo.caption || `Voyage Photo ${pIdx + 1}`}
                                className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition"
                                onClick={() => setPreviewPhotoUrl(photo.dataUrl)}
                              />
                              {!IS_DEMO_MODE && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm('Delete this photo from voyage?')) {
                                      handleDeleteTripPhoto(trip.id, photo.id || pIdx);
                                    }
                                  }}
                                  className="absolute top-1 right-1 bg-rose-950/80 hover:bg-rose-900 text-rose-300 p-1 rounded-md opacity-0 group-hover:opacity-100 transition shadow cursor-pointer"
                                  title="Delete photo"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-500 italic">
                          No voyage summary photos uploaded yet. Snap or upload harbor views, boat under sail, or crew photos.
                        </p>
                      )}
                    </div>

                    {/* Legs Container Header */}
                    <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Navigation className="w-3.5 h-3.5 text-teal-400" />
                        Passage Legs ({legCount})
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {trip.status === 'underway' && (
                          activeLeg && activeLeg.tripId === trip.id ? (
                            <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-500/50 rounded-lg px-2.5 py-1">
                              <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                              <span>AutoLeg Recording...</span>
                            </span>
                          ) : !activeLeg ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {trackingStatus === 'permission-denied' && (
                                <button
                                  type="button"
                                  onClick={() => requestGpsPermission()}
                                  className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300 bg-amber-950/50 hover:bg-amber-900/70 border border-amber-600/60 rounded-lg px-2.5 py-1 transition cursor-pointer"
                                  title="Grant Location Permission for Android"
                                >
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                  <span>Enable GPS</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => startAutoLeg(trip.id)}
                                className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-700/60 rounded-lg px-2.5 py-1 transition cursor-pointer"
                                title="Start tracking speed, distance and time with device GPS"
                              >
                                <Radio className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Start GPS AutoLeg</span>
                              </button>
                            </div>
                          ) : null
                        )}
                        <button
                          type="button"
                          onClick={() => openCreateLegModal(trip)}
                          className="flex items-center gap-1 text-[11px] font-bold text-teal-300 bg-teal-950/40 hover:bg-teal-900/50 border border-teal-800/60 rounded-lg px-2.5 py-1 transition cursor-pointer"
                        >
                          <Plus className="w-3 h-3 stroke-[3]" />
                          <span>Add Leg</span>
                        </button>
                      </div>
                    </div>

                    {/* Legs Placeholder Container */}
                    {legCount === 0 ? (
                      <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-xl p-4 text-center space-y-2">
                        <Compass className="w-7 h-7 text-slate-600 mx-auto" />
                        <div className="text-xs font-semibold text-slate-300">No legs logged for this voyage yet</div>
                        <p className="text-[11px] text-slate-500">Record departure/arrival ports, weather conditions, engine hours, and passage notes.</p>
                        <button
                          type="button"
                          onClick={() => openCreateLegModal(trip)}
                          className="inline-flex items-center gap-1 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition shadow mt-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add First Leg</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {trip.legs.map((leg) => {
                          const isLegExpanded = !!expandedLegIds[leg.id];
                          const hasExtraDetails =
                            (leg.crew && leg.crew.length > 0) ||
                            leg.notes ||
                            leg.anchorageDetails ||
                            (leg.photos && leg.photos.length > 0) ||
                            leg.pointOfSail ||
                            leg.sailsUsed ||
                            leg.maxSpeedKts !== undefined ||
                            Boolean(leg.departureCoordinates);

                          return (
                            <div
                              key={leg.id}
                              className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 space-y-2 transition hover:border-slate-700"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() => toggleLegExpanded(leg.id)}
                                  className="min-w-0 text-left flex-1 group cursor-pointer"
                                >
                                  <div className="font-bold text-slate-100 flex items-center gap-1.5 flex-wrap">
                                    {hasExtraDetails ? (
                                      isLegExpanded ? (
                                        <ChevronDown className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                                      ) : (
                                        <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-teal-400 shrink-0" />
                                      )
                                    ) : null}
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-teal-300 font-mono">
                                      Leg {leg.legNumber}
                                    </span>
                                    <span className="truncate group-hover:text-teal-300 transition">
                                      {leg.departurePort} → {leg.arrivalPort}
                                    </span>
                                    {leg.title && leg.title !== `Leg ${leg.legNumber}` && (
                                      <span className="text-[11px] font-normal text-slate-400">
                                        ({leg.title})
                                      </span>
                                    )}
                                  </div>

                                  <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                                    <span>
                                      {leg.departureTime
                                        ? new Date(leg.departureTime).toLocaleDateString()
                                        : ''}
                                    </span>
                                    {leg.distanceNm ? <span>• {leg.distanceNm} NM</span> : null}
                                    <span className="capitalize text-teal-400">
                                      • {leg.propulsionMode}
                                    </span>
                                    {leg.windSpeedKts !== undefined && (
                                      <span className="flex items-center gap-1 text-slate-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                                        <Wind className="w-2.5 h-2.5 text-sky-400" />
                                        <span>
                                          {leg.windDirection ? `${leg.windDirection} ` : ''}
                                          {leg.windSpeedKts} kts
                                          {leg.windGustKts ? ` (g${leg.windGustKts})` : ''}
                                        </span>
                                      </span>
                                    )}
                                    {leg.seaState && (
                                      <span className="flex items-center gap-1 text-slate-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 capitalize">
                                        <Waves className="w-2.5 h-2.5 text-teal-400" />
                                        <span>{leg.seaState}</span>
                                      </span>
                                    )}
                                    {leg.maxSpeedKts !== undefined && (
                                      <span className="flex items-center gap-1 text-teal-300 bg-teal-950/40 px-1.5 py-0.5 rounded border border-teal-800/60 font-mono text-[10px]">
                                        <Radio className="w-2.5 h-2.5 text-teal-400" />
                                        <span>Max {leg.maxSpeedKts} kts{leg.avgSpeedKts ? ` • Avg ${leg.avgSpeedKts} kts` : ''}</span>
                                      </span>
                                    )}
                                    {leg.engineHoursRun !== undefined && leg.engineHoursRun > 0 && (
                                      <span className="flex items-center gap-1 text-slate-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                                        <Gauge className="w-2.5 h-2.5 text-amber-400" />
                                        <span>+{leg.engineHoursRun}h eng</span>
                                      </span>
                                    )}
                                    {leg.startFuelLevelPercent !== undefined &&
                                      leg.endFuelLevelPercent !== undefined && (
                                        <span className="flex items-center gap-1 text-slate-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                                          <Fuel className="w-2.5 h-2.5 text-cyan-400" />
                                          <span>
                                            Fuel: {leg.startFuelLevelPercent}% → {leg.endFuelLevelPercent}%
                                          </span>
                                        </span>
                                      )}
                                    {leg.photos && leg.photos.length > 0 && (
                                      <span className="flex items-center gap-1 text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-800/40">
                                        <Camera className="w-2.5 h-2.5" />
                                        <span>{leg.photos.length}</span>
                                      </span>
                                    )}
                                  </div>
                                </button>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => openEditLegModal(trip, leg)}
                                    className="p-1 text-slate-400 hover:text-sky-300 hover:bg-slate-800 rounded transition cursor-pointer"
                                    title="Edit leg"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteLeg(trip.id, leg.id)}
                                    className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded transition cursor-pointer"
                                    title="Delete leg"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Expanded Leg Details */}
                              {isLegExpanded && hasExtraDetails && (
                                <div className="space-y-2 pt-2 border-t border-slate-800/80 text-xs">
                                  {/* GPS AutoLeg Telemetry Summary */}
                                  {(leg.departureCoordinates || leg.arrivalCoordinates || leg.maxSpeedKts !== undefined) && (
                                    <div className="flex items-start gap-2 text-slate-300 bg-teal-950/30 border border-teal-500/40 rounded-lg p-2.5 text-[11px] font-mono">
                                      <Radio className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                                      <div className="space-y-1">
                                        <div className="text-teal-300 font-sans font-bold flex items-center gap-1.5 flex-wrap">
                                          <span>GPS AutoLeg Telemetry Tracked</span>
                                          {leg.maxSpeedKts !== undefined && (
                                            <span className="font-mono text-[10px] text-teal-400 font-normal">
                                              (Max SOG: {leg.maxSpeedKts} kts{leg.avgSpeedKts ? ` • Avg: ${leg.avgSpeedKts} kts` : ''})
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-slate-300 flex items-center gap-2 flex-wrap">
                                          {leg.departureCoordinates && (
                                            <span>
                                              Dep: {toMarineCoordinates(leg.departureCoordinates.lat, leg.departureCoordinates.lon)}
                                            </span>
                                          )}
                                          {leg.arrivalCoordinates && (
                                            <span>
                                              → Arr: {toMarineCoordinates(leg.arrivalCoordinates.lat, leg.arrivalCoordinates.lon)}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Crew manifest */}
                                  {leg.crew && leg.crew.length > 0 && (
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-slate-400 font-semibold flex items-center gap-1 text-[11px]">
                                        <Users className="w-3 h-3 text-teal-400" />
                                        Crew:
                                      </span>
                                      {leg.crew.map((member, cIdx) => (
                                        <span
                                          key={cIdx}
                                          className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-full text-[11px] text-slate-300 font-medium"
                                        >
                                          {member}
                                        </span>
                                      ))}
                                    </div>
                                  )}

                                  {/* Anchorage / Berth */}
                                  {leg.anchorageDetails && (
                                    <div className="flex items-start gap-1.5 text-slate-300 bg-slate-900/60 border border-slate-800/80 rounded-lg p-2 text-[11px]">
                                      <Anchor className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                                      <div>
                                        <span className="font-semibold text-slate-400">
                                          Dock / Anchorage:{' '}
                                        </span>
                                        <span>{leg.anchorageDetails}</span>
                                      </div>
                                    </div>
                                  )}

                                  {/* Point of Sail & Sails used */}
                                  {(leg.pointOfSail || leg.sailsUsed) && (
                                    <div className="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap">
                                      {leg.pointOfSail && (
                                        <span>
                                          <strong className="text-slate-300">Point of Sail:</strong>{' '}
                                          {leg.pointOfSail}
                                        </span>
                                      )}
                                      {leg.sailsUsed && (
                                        <span>
                                          • <strong className="text-slate-300">Sails Set:</strong>{' '}
                                          {leg.sailsUsed}
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {/* Journal Notes */}
                                  {leg.notes && (
                                    <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5 text-slate-300 text-xs leading-relaxed space-y-1">
                                      <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                                        <FileText className="w-3 h-3 text-amber-400" />
                                        Passage Journal
                                      </span>
                                      <p className="whitespace-pre-wrap">{leg.notes}</p>
                                    </div>
                                  )}

                                  {/* Photos Gallery */}
                                  {leg.photos && leg.photos.length > 0 && (
                                    <div>
                                      <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 mb-1.5">
                                        <Camera className="w-3 h-3 text-emerald-400" />
                                        Passage Photos ({leg.photos.length})
                                      </span>
                                      <div className="flex gap-2 overflow-x-auto pb-1">
                                        {leg.photos.map((photo, pIdx) => (
                                          <button
                                            key={photo.id || pIdx}
                                            type="button"
                                            onClick={() => setPreviewPhotoUrl(photo.dataUrl)}
                                            className="relative rounded-lg overflow-hidden border border-slate-700 bg-slate-900 w-16 h-16 shrink-0 group cursor-pointer"
                                            title="Click to enlarge"
                                          >
                                            <img
                                              src={photo.dataUrl}
                                              alt={photo.caption || `Passage Photo ${pIdx + 1}`}
                                              className="w-full h-full object-cover group-hover:scale-105 transition"
                                            />
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create or Edit Voyage (Trip) */}
      {showTripModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-3 sm:p-4"
          style={{
            paddingTop: 'max(1rem, calc(env(safe-area-inset-top, 0px) + 0.5rem))',
            paddingBottom: 'max(1rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))',
          }}
        >
          <form
            onSubmit={handleSaveTrip}
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Pinned Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/40 shrink-0">
              <div>
                <span className="text-xs uppercase font-bold tracking-wider text-sky-400">
                  {editingTrip ? 'Edit Voyage' : 'New Voyage / Passage'}
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  {editingTrip ? editingTrip.title : 'Log a Cruise or Sail'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowTripModal(false);
                  setEditingTrip(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* Status Selector */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-semibold">
                Voyage Status
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTripStatusVal('underway')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold border transition ${
                    tripStatusVal === 'underway'
                      ? 'bg-emerald-500/25 border-emerald-500 text-emerald-200 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Underway (Active)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTripStatusVal('completed')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold border transition ${
                    tripStatusVal === 'completed'
                      ? 'bg-sky-500/25 border-sky-500 text-sky-200 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                  <span>Completed</span>
                </button>
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-semibold">
                Voyage Title
              </label>
              <input
                type="text"
                required
                placeholder="e.g., San Juan Islands Summer Cruise, Day Sail to Edmonds..."
                value={tripTitle}
                onChange={(e) => setTripTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                autoFocus
              />
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-semibold flex items-center justify-between">
                  <span>Start Date</span>
                  <Calendar className="w-3.5 h-3.5 text-sky-400" />
                </label>
                <input
                  type="date"
                  required
                  value={tripStartDate}
                  onChange={(e) => setTripStartDate(e.target.value)}
                  onClick={(e) => {
                    try {
                      e.currentTarget.showPicker?.();
                    } catch {}
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white [color-scheme:dark] cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-semibold flex items-center justify-between">
                  <span>End Date</span>
                  <span className="text-[10px] text-slate-500 font-normal">(optional)</span>
                </label>
                <input
                  type="date"
                  value={tripEndDate}
                  onChange={(e) => setTripEndDate(e.target.value)}
                  onClick={(e) => {
                    try {
                      e.currentTarget.showPicker?.();
                    } catch {}
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white [color-scheme:dark] cursor-pointer"
                />
              </div>
            </div>

            {/* Captain / Skipper */}
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-semibold">
                Captain / Skipper <span className="text-[10px] text-slate-500 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g., Capt. Jack"
                value={tripCaptain}
                onChange={(e) => setTripCaptain(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Voyage Journal Notes */}
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-semibold">
                Voyage Highlights & Notes <span className="text-[10px] text-slate-500 font-normal">(optional)</span>
              </label>
              <textarea
                rows={3}
                placeholder="Overview, weather summary, memorable stops, general passage notes..."
                value={tripNotesVal}
                onChange={(e) => setTripNotesVal(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Voyage Photo Attachments */}
            {!IS_DEMO_MODE ? (
              <div className="pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-sky-400" />
                    Voyage Photos ({tripPhotos.length})
                  </label>
                  <label className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition">
                    <Camera className="w-3 h-3" />
                    <span>{isUploadingTripPhoto ? 'Processing...' : '+ Attach Photos'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={isUploadingTripPhoto}
                      className="hidden"
                      onChange={(e) => {
                        void handleTripModalPhotosSelected(e.target.files);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>

                {tripPhotos.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 pt-1 max-h-40 overflow-y-auto pr-1">
                    {tripPhotos.map((photo, idx) => (
                      <div
                        key={photo.id || idx}
                        className="relative group rounded-lg overflow-hidden border border-slate-700 bg-slate-900 aspect-square"
                      >
                        <img
                          src={photo.dataUrl}
                          alt={photo.caption || `Voyage photo ${idx + 1}`}
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => setPreviewPhotoUrl(photo.dataUrl)}
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeTripModalPhoto(idx);
                          }}
                          className="absolute top-1 right-1 bg-rose-950/80 hover:bg-rose-900 text-rose-300 p-1 rounded-md opacity-0 group-hover:opacity-100 transition shadow cursor-pointer"
                          title="Remove photo"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            </div>

            {/* Pinned Action Buttons Footer */}
            <div className="flex justify-end gap-2 p-3.5 border-t border-slate-800 bg-slate-950/40 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowTripModal(false);
                  setEditingTrip(null);
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 transition shadow cursor-pointer"
              >
                {editingTrip ? 'Save Changes' : 'Create Voyage'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Create or Edit Passage Leg (Step 1B.1 Core Route Inputs) */}
      {showLegModal && activeTripForLeg && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-3 sm:p-4"
          style={{
            paddingTop: 'max(1rem, calc(env(safe-area-inset-top, 0px) + 0.5rem))',
            paddingBottom: 'max(1rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))',
          }}
        >
          <form
            onSubmit={handleSaveLeg}
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Pinned Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/40 shrink-0">
              <div>
                <span className="text-xs uppercase font-bold tracking-wider text-teal-400 flex items-center gap-1">
                  <Navigation className="w-3.5 h-3.5" />
                  {activeTripForLeg.title}
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  {editingLeg ? `Edit Leg ${editingLeg.legNumber}` : `Log New Passage Leg`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowLegModal(false);
                  setEditingLeg(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* GPS AutoLeg Telemetry Banner */}
              {(legDepartureCoords || legArrivalCoords || legMaxSpeedKts !== undefined) && (
                <div className="bg-teal-950/40 border border-teal-500/50 rounded-xl p-3 space-y-1.5 text-xs text-teal-200">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-bold flex items-center gap-1.5 text-emerald-300">
                      <Radio className="w-3.5 h-3.5 text-emerald-400" />
                      GPS AutoLeg Telemetry Recorded
                    </span>
                    {legMaxSpeedKts !== undefined && (
                      <span className="font-mono text-[11px] text-teal-300">
                        Max Speed: <strong className="text-white">{legMaxSpeedKts} kts</strong>
                        {legAvgSpeedKts ? ` • Avg: ${legAvgSpeedKts} kts` : ''}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-slate-300 flex items-center gap-2 flex-wrap">
                    {legDepartureCoords && (
                      <span>
                        Dep: {toMarineCoordinates(legDepartureCoords.lat, legDepartureCoords.lon)}
                      </span>
                    )}
                    {legArrivalCoords && (
                      <span>
                        → Arr: {toMarineCoordinates(legArrivalCoords.lat, legArrivalCoords.lon)}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Leg Title (Optional) */}
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-semibold">
                Leg Name / Identifier <span className="text-[10px] text-slate-500 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g., Leg 1: Anacortes to Rosario Resort"
                value={legTitle}
                onChange={(e) => setLegTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
              />
            </div>

            {/* Departure & Arrival Ports */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-semibold flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-teal-400" />
                  Departure Port
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Cap Sante Marina"
                  value={legDeparturePort}
                  onChange={(e) => setLegDeparturePort(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-semibold flex items-center gap-1">
                  <Anchor className="w-3 h-3 text-sky-400" />
                  Arrival Port / Anchor
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Rosario Resort"
                  value={legArrivalPort}
                  onChange={(e) => setLegArrivalPort(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            {/* Departure & Arrival Time Pickers */}
            <div className="space-y-1.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-semibold flex items-center justify-between">
                    <span>Departure Time</span>
                    <Calendar className="w-3 h-3 text-teal-400" />
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={legDepartureTime}
                    onChange={(e) => setLegDepartureTime(e.target.value)}
                    onClick={(e) => {
                      try {
                        e.currentTarget.showPicker?.();
                      } catch {}
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white [color-scheme:dark] cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-semibold flex items-center justify-between">
                    <span>Arrival Time</span>
                    <span className="text-[10px] text-slate-500 font-normal">(optional)</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={legArrivalTime}
                    onChange={(e) => setLegArrivalTime(e.target.value)}
                    onClick={(e) => {
                      try {
                        e.currentTarget.showPicker?.();
                      } catch {}
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white [color-scheme:dark] cursor-pointer"
                  />
                </div>
              </div>

              {calculatedDuration && (
                <div className="text-[11px] font-mono text-teal-300 bg-teal-950/40 border border-teal-800/50 rounded-lg px-2.5 py-1 flex items-center justify-between">
                  <span>Passage Duration:</span>
                  <strong className="text-white">{calculatedDuration}</strong>
                </div>
              )}
            </div>

            {/* Distance & Propulsion Mode */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-semibold">
                  Distance (Nautical Miles)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="e.g., 18.5"
                  value={legDistanceNm}
                  onChange={(e) => setLegDistanceNm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1 font-semibold">
                  Propulsion Mode
                </label>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => setLegPropulsionMode('sail')}
                    className={`py-2 px-1 text-[10px] font-bold rounded-lg border transition text-center ${
                      legPropulsionMode === 'sail'
                        ? 'bg-teal-500/25 border-teal-500 text-teal-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Sail
                  </button>
                  <button
                    type="button"
                    onClick={() => setLegPropulsionMode('motor-sail')}
                    className={`py-2 px-1 text-[10px] font-bold rounded-lg border transition text-center ${
                      legPropulsionMode === 'motor-sail'
                        ? 'bg-cyan-500/25 border-cyan-500 text-cyan-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Motor-Sail
                  </button>
                  <button
                    type="button"
                    onClick={() => setLegPropulsionMode('motor')}
                    className={`py-2 px-1 text-[10px] font-bold rounded-lg border transition text-center ${
                      legPropulsionMode === 'motor'
                        ? 'bg-amber-500/25 border-amber-500 text-amber-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Motor
                  </button>
                </div>
              </div>
            </div>

            {/* Marine Weather, Sea State & Sail Trim */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-3">
              <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                <Wind className="w-3.5 h-3.5" />
                Marine Weather, Sea State & Sail Trim
              </span>

              {/* Wind Speed, Gusts & Direction */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Wind (kts)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="e.g. 15"
                    value={legWindSpeed}
                    onChange={(e) => setLegWindSpeed(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Gusts (kts)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="e.g. 22"
                    value={legWindGust}
                    onChange={(e) => setLegWindGust(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Direction</label>
                  <input
                    type="text"
                    placeholder="e.g. NW, 280°"
                    value={legWindDirection}
                    onChange={(e) => setLegWindDirection(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              {/* Sea State & Weather Sky */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Sea State</label>
                  <select
                    value={legSeaState}
                    onChange={(e) => setLegSeaState(e.target.value as SeaState | '')}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
                  >
                    <option value="">Unspecified</option>
                    <option value="calm">Calm (glassy / &lt;1 ft)</option>
                    <option value="slight">Slight (light chop 1-2 ft)</option>
                    <option value="moderate">Moderate (waves 3-5 ft)</option>
                    <option value="rough">Rough (waves 6-8 ft)</option>
                    <option value="heavy">Heavy (waves 8+ ft / gale)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Weather / Sky</label>
                  <select
                    value={legWeather}
                    onChange={(e) => setLegWeather(e.target.value as WeatherSky | '')}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
                  >
                    <option value="">Unspecified</option>
                    <option value="clear">☀️ Clear / Sunny</option>
                    <option value="partly-cloudy">⛅ Partly Cloudy</option>
                    <option value="overcast">☁️ Overcast</option>
                    <option value="rain">🌧️ Rain</option>
                    <option value="fog">🌫️ Fog / Restricted Vis</option>
                    <option value="squall">⛈️ Squalls / Storm</option>
                  </select>
                </div>
              </div>

              {/* Point of Sail & Sails Set */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Point of Sail</label>
                  <input
                    type="text"
                    placeholder="e.g. Beam Reach, Broad Reach"
                    value={legPointOfSail}
                    onChange={(e) => setLegPointOfSail(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Sails Used</label>
                  <input
                    type="text"
                    placeholder="e.g. Full Main + 110% Genoa"
                    value={legSailsUsed}
                    onChange={(e) => setLegSailsUsed(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
                  />
                </div>
              </div>
            </div>

            {/* Step 1B.3: Engine Hours & Fuel Tracking */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5" />
                  Engine Hours & Fuel Tracking
                </span>
                {calculatedEngineRun !== null && (
                  <span className="text-[11px] font-mono font-bold text-amber-300 bg-amber-950/40 border border-amber-800/50 px-2 py-0.5 rounded">
                    Engine Run: +{calculatedEngineRun} hrs
                  </span>
                )}
              </div>

              {/* Start & End Engine Hours */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Start Engine Hours
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder={
                      db.vessel?.currentEngineHours
                        ? `${db.vessel.currentEngineHours}`
                        : 'e.g. 842.1'
                    }
                    value={legStartEngineHours}
                    onChange={(e) => setLegStartEngineHours(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Arrival Engine Hours
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="e.g. 844.5"
                    value={legEndEngineHours}
                    onChange={(e) => setLegEndEngineHours(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* Sync to Vessel Engine Hours Toggle */}
              <label className="flex items-center gap-2 cursor-pointer pt-0.5">
                <input
                  type="checkbox"
                  checked={syncVesselEngineHours}
                  onChange={(e) => setSyncVesselEngineHours(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500/20"
                />
                <span className="text-[11px] text-slate-300">
                  Sync arrival hours to Vessel Profile{' '}
                  <span className="text-slate-500">
                    (currently {db.vessel?.currentEngineHours || 0} hrs)
                  </span>
                </span>
              </label>

              {/* Fuel Level % Start & Arrival */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1 flex items-center gap-1">
                    <Fuel className="w-3 h-3 text-cyan-400" />
                    Departure Fuel (%)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    placeholder="e.g. 95"
                    value={legStartFuelPercent}
                    onChange={(e) => setLegStartFuelPercent(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1 flex items-center gap-1">
                    <Fuel className="w-3 h-3 text-cyan-400" />
                    Arrival Fuel (%)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    placeholder="e.g. 85"
                    value={legEndFuelPercent}
                    onChange={(e) => setLegEndFuelPercent(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Step 1B.4: Crew, Anchorage & Passage Journal Notes */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-3">
              <span className="text-xs font-bold text-teal-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Crew, Anchorage & Passage Journal
              </span>

              {/* Crew Manifest */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Crew & Guests Manifest <span className="text-[10px] text-slate-500 font-normal">(comma-separated)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Capt Jack, Sarah (Mate), Leo (Guest)"
                  value={legCrewText}
                  onChange={(e) => setLegCrewText(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                />
              </div>

              {/* Anchorage / Slip / Mooring Details */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1 flex items-center gap-1">
                  <Anchor className="w-3 h-3 text-sky-400" />
                  Docking / Anchorage Details <span className="text-[10px] text-slate-500 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Marina Slip B-14, 30A power, $65/nt OR Mooring ball #4, 25ft sand"
                  value={legAnchorageDetails}
                  onChange={(e) => setLegAnchorageDetails(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                />
              </div>

              {/* Journal Notes */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1 flex items-center gap-1">
                  <FileText className="w-3 h-3 text-amber-400" />
                  Passage Notes & Logbook Entry <span className="text-[10px] text-slate-500 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Passage observations, wildlife sightings, sea conditions, sail trim changes, navigation notes..."
                  value={legNotes}
                  onChange={(e) => setLegNotes(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white resize-y"
                />
              </div>

              {/* Photo Attachments */}
              {!IS_DEMO_MODE ? (
                <div className="pt-2 border-t border-slate-800/80">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-emerald-400" />
                      Passage Photos ({legPhotos.length})
                    </label>
                    <label className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700 px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition">
                      <Camera className="w-3 h-3" />
                      <span>{isUploadingPhoto ? 'Processing...' : '+ Attach Photo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={isUploadingPhoto}
                        className="hidden"
                        onChange={(e) => {
                          void handlePhotoFilesSelected(e.target.files);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>

                  {legPhotos.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 pt-1">
                      {legPhotos.map((photo, idx) => (
                        <div
                          key={photo.id || idx}
                          className="relative group rounded-lg overflow-hidden border border-slate-700 bg-slate-900 aspect-square"
                        >
                          <img
                            src={photo.dataUrl}
                            alt={photo.caption || `Passage photo ${idx + 1}`}
                            className="w-full h-full object-cover cursor-pointer"
                            onClick={() => setPreviewPhotoUrl(photo.dataUrl)}
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeLegPhoto(idx);
                            }}
                            className="absolute top-1 right-1 bg-rose-950/80 hover:bg-rose-900 text-rose-300 p-1 rounded-md opacity-0 group-hover:opacity-100 transition shadow cursor-pointer"
                            title="Remove photo"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            </div>

            {/* Pinned Modal Actions Footer */}
            <div className="flex justify-end gap-2 p-3.5 border-t border-slate-800 bg-slate-950/40 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowLegModal(false);
                  setEditingLeg(null);
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-xs font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 transition shadow cursor-pointer"
              >
                {editingLeg ? 'Save Leg Changes' : 'Save Passage Leg'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Photo Lightbox Modal */}
      {previewPhotoUrl && (
        <div
          className="fixed inset-0 z-[110] bg-black/90 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewPhotoUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setPreviewPhotoUrl(null)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white p-1 rounded-full bg-slate-800/60 transition"
              title="Close image preview"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={previewPhotoUrl}
              alt="Passage photo enlarged"
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border border-slate-800"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};

