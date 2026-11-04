import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Anchor,
  BookOpen,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Cog,
  DollarSign,
  Droplet,
  Droplets,
  FlaskConical,
  Fuel,
  Gauge,
  History,
  Image as ImageIcon,
  Layers,
  LifeBuoy,
  Package,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  Tag,
  Trash2,
  Waves,
  Wrench,
  X,
  Zap,
  ZoomIn,
} from 'lucide-react';
import {
  CaptainsDatabase,
  LinkedPartRequirement,
  MaintenancePhoto,
  MaintenanceSchedule,
  ServiceLogEntry,
  ServiceLogStatus,
  SystemCategory,
} from '../types';
import { PhotoLightboxModal } from './PhotoLightboxModal';
import {
  compressImageFile,
  deductFromPartInventory,
  evaluateSchedule,
  ScheduleStatus,
} from '../utils/vendors';
import { IS_DEMO_MODE } from '../utils/demoMode';
import { findMatchingManual, openOrShareManualPdf } from '../db/pdfStorage';
import { ManualsLibrarySection } from './ManualsLibrarySection';

interface MaintenanceViewProps {
  db: CaptainsDatabase;
  onUpdateDb: (updater: (prev: CaptainsDatabase) => CaptainsDatabase) => void;
  onJumpToPart: (partId: string) => void;
  showManualsModalSignal?: boolean;
  onCloseManualsModal?: () => void;
}

const CATEGORIES: SystemCategory[] = [
  'Engine',
  'Cooling',
  'Fuel',
  'Lubrication',
  'Electrical',
  'Transmission',
  'Plumbing & Water',
  'Rigging / Deck',
  'Safety',
];

interface SystemTab {
  id: string;
  label: string;
  defaultCategory?: SystemCategory;
  icon: React.ComponentType<{ className?: string }>;
  matches: (cat: string) => boolean;
  isCustom?: boolean;
}

const BASE_SYSTEM_TABS: SystemTab[] = [
  {
    id: 'all',
    label: 'All Systems',
    icon: Layers,
    matches: () => true,
  },
  {
    id: 'Engine',
    label: 'Engine',
    defaultCategory: 'Engine',
    icon: Cog,
    matches: (cat) => cat === 'Engine',
  },
  {
    id: 'Cooling',
    label: 'Cooling',
    defaultCategory: 'Cooling',
    icon: Waves,
    matches: (cat) => cat === 'Cooling' || cat === 'Engine - Cooling',
  },
  {
    id: 'Fuel',
    label: 'Fuel',
    defaultCategory: 'Fuel',
    icon: Fuel,
    matches: (cat) => cat === 'Fuel' || cat === 'Engine - Fuel' || cat === 'Fuel System',
  },
  {
    id: 'Lubrication',
    label: 'Lubrication',
    defaultCategory: 'Lubrication',
    icon: Droplet,
    matches: (cat) => cat === 'Lubrication' || cat === 'Engine - Lubrication',
  },
  {
    id: 'Electrical',
    label: 'Electrical',
    defaultCategory: 'Electrical',
    icon: Zap,
    matches: (cat) => cat === 'Electrical' || cat === 'Engine - Electrical',
  },
  {
    id: 'Transmission',
    label: 'Transmission',
    defaultCategory: 'Transmission',
    icon: Cog,
    matches: (cat) => cat === 'Transmission',
  },
  {
    id: 'Plumbing & Water',
    label: 'Plumbing & Water',
    defaultCategory: 'Plumbing & Water',
    icon: Droplets,
    matches: (cat) => cat === 'Plumbing & Water' || cat === 'Plumbing / Head',
  },
  {
    id: 'Rigging / Deck',
    label: 'Rigging & Deck',
    defaultCategory: 'Rigging / Deck',
    icon: Anchor,
    matches: (cat) => cat === 'Rigging / Deck',
  },
  {
    id: 'Safety',
    label: 'Safety',
    defaultCategory: 'Safety',
    icon: LifeBuoy,
    matches: (cat) => cat === 'Safety',
  },
];

export const MaintenanceView: React.FC<MaintenanceViewProps> = ({
  db,
  onUpdateDb,
  onJumpToPart,
  showManualsModalSignal,
  onCloseManualsModal,
}) => {
  const [subTab, setSubTab] = useState<'schedules' | 'history'>('schedules');
  const [selectedSystems, setSelectedSystems] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [loggingSchedule, setLoggingSchedule] = useState<MaintenanceSchedule | null>(null);
  const [statusToast, setStatusToast] = useState<string | null>(null);
  const [showNewScheduleModal, setShowNewScheduleModal] = useState(false);
  const [isAddingCustomCategory, setIsAddingCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  useEffect(() => {
    if (!statusToast) return;
    const t = setTimeout(() => setStatusToast(null), 5000);
    return () => clearTimeout(t);
  }, [statusToast]);

  // Dynamically resolve custom categories from db and existing items
  const customCategoryNames = useMemo(() => {
    const set = new Set<string>(db.customCategories || []);
    for (const s of db.schedules) {
      if (s.category && !BASE_SYSTEM_TABS.some((t) => t.id !== 'all' && t.matches(s.category))) {
        set.add(s.category);
      }
    }
    for (const p of db.parts) {
      if (p.category && !BASE_SYSTEM_TABS.some((t) => t.id !== 'all' && t.matches(p.category))) {
        set.add(p.category);
      }
    }
    for (const l of db.serviceLogs) {
      if (l.category && !BASE_SYSTEM_TABS.some((t) => t.id !== 'all' && t.matches(l.category))) {
        set.add(l.category);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [db.customCategories, db.schedules, db.parts, db.serviceLogs]);

  const systemTabs: SystemTab[] = useMemo(() => {
    const customTabs: SystemTab[] = customCategoryNames.map((name) => ({
      id: name,
      label: name,
      defaultCategory: name,
      icon: Tag,
      matches: (cat) => cat.toLowerCase() === name.toLowerCase(),
      isCustom: true,
    }));
    return [...BASE_SYSTEM_TABS, ...customTabs];
  }, [customCategoryNames]);

  const activeSystemTab =
    (selectedSystems.length === 1 && systemTabs.find((t) => t.id === selectedSystems[0])) ||
    systemTabs[0];

  // Log service modal state
  const [logDate, setLogDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [logHours, setLogHours] = useState(String(db.vessel.currentEngineHours));
  const [logCost, setLogCost] = useState('');
  const [logNotes, setLogNotes] = useState('');
  const [logStatus, setLogStatus] = useState<ServiceLogStatus>('completed');
  const [deductSpares, setDeductSpares] = useState(true);
  const [logPhotos, setLogPhotos] = useState<MaintenancePhoto[]>([]);

  // Edit service log entry modal state
  const [editingLog, setEditingLog] = useState<ServiceLogEntry | null>(null);
  const [editLogTitle, setEditLogTitle] = useState('');
  const [editLogCategory, setEditLogCategory] = useState<string>('Engine');
  const [editLogStatus, setEditLogStatus] = useState<ServiceLogStatus>('completed');
  const [editLogDate, setEditLogDate] = useState('');
  const [editLogHours, setEditLogHours] = useState('');
  const [editLogCost, setEditLogCost] = useState('');
  const [editLogNotes, setEditLogNotes] = useState('');
  const [editLogPhotos, setEditLogPhotos] = useState<MaintenancePhoto[]>([]);
  const [editLogPartsUsed, setEditLogPartsUsed] = useState<LinkedPartRequirement[]>([]);
  const [editLogExtraPartId, setEditLogExtraPartId] = useState('');
  const [isEditLogAddingCustomCategory, setIsEditLogAddingCustomCategory] = useState(false);
  const [editLogCustomCategoryInput, setEditLogCustomCategoryInput] = useState('');

  // Logbook filter states
  const [historySelectedSystems, setHistorySelectedSystems] = useState<string[]>([]);
  const [selectedLogStatuses, setSelectedLogStatuses] = useState<string[]>([]);
  const [isLogStatusDropdownOpen, setIsLogStatusDropdownOpen] = useState(false);
  const logStatusDropdownRef = useRef<HTMLDivElement>(null);

  // Map of partId -> string quantity used during service execution
  const [customPartsUsed, setCustomPartsUsed] = useState<Record<string, string>>({});
  const [extraPartToAdd, setExtraPartToAdd] = useState('');

  // New schedule modal state
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<SystemCategory>('Engine');
  const [newIntervalMode, setNewIntervalMode] = useState<'scheduled' | 'as-needed'>('scheduled');
  const [newIntervalHours, setNewIntervalHours] = useState('100');
  const [newIntervalDays, setNewIntervalDays] = useState('365');
  const [newLastHours, setNewLastHours] = useState(String(db.vessel.currentEngineHours));
  const [newLastDate, setNewLastDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newSpecNotes, setNewSpecNotes] = useState('');
  const [newProcNotes, setNewProcNotes] = useState('');
  const [newManualId, setNewManualId] = useState('');
  const [newManualPage, setNewManualPage] = useState('');
  const [newLinkedItems, setNewLinkedItems] = useState<LinkedPartRequirement[]>([]);
  const [newTaskPhotos, setNewTaskPhotos] = useState<MaintenancePhoto[]>([]);
  const [pickerPartId, setPickerPartId] = useState('');
  const [pickerQty, setPickerQty] = useState('1');
  const [editingSchedule, setEditingSchedule] = useState<MaintenanceSchedule | null>(null);

  // Lightbox & photo processing state
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<{
    photo: MaintenancePhoto;
    contextTitle: string;
    onDelete?: () => void;
  } | null>(null);

  // Collapsible card state (cards start minimized by default and expand when title is clicked)
  const [expandedScheduleIds, setExpandedScheduleIds] = useState<Record<string, boolean>>({});
  const [expandedLogIds, setExpandedLogIds] = useState<Record<string, boolean>>({});
  const [showManualsModal, setShowManualsModal] = useState(false);
  const [manualsSearchQuery, setManualsSearchQuery] = useState('');

  useEffect(() => {
    if (showManualsModalSignal) {
      setShowManualsModal(true);
    }
  }, [showManualsModalSignal]);

  const handleCloseManuals = () => {
    setShowManualsModal(false);
    if (onCloseManualsModal) {
      onCloseManualsModal();
    }
  };

  // Dropdown pull-down open states
  const [isSystemDropdownOpen, setIsSystemDropdownOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isHistorySystemDropdownOpen, setIsHistorySystemDropdownOpen] = useState(false);

  const systemDropdownRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const historySystemDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        systemDropdownRef.current &&
        !systemDropdownRef.current.contains(event.target as Node)
      ) {
        setIsSystemDropdownOpen(false);
      }
      if (
        statusDropdownRef.current &&
        !statusDropdownRef.current.contains(event.target as Node)
      ) {
        setIsStatusDropdownOpen(false);
      }
      if (
        historySystemDropdownRef.current &&
        !historySystemDropdownRef.current.contains(event.target as Node)
      ) {
        setIsHistorySystemDropdownOpen(false);
      }
      if (
        logStatusDropdownRef.current &&
        !logStatusDropdownRef.current.contains(event.target as Node)
      ) {
        setIsLogStatusDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleScheduleExpanded = (id: string) => {
    setExpandedScheduleIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleLogExpanded = (id: string) => {
    setExpandedLogIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const openCreateScheduleModal = () => {
    setEditingSchedule(null);
    setNewTitle('');
    if (activeSystemTab.defaultCategory) {
      setNewCategory(activeSystemTab.defaultCategory);
    } else {
      setNewCategory('Engine');
    }
    setNewIntervalMode('scheduled');
    setNewIntervalHours('100');
    setNewIntervalDays('365');
    setNewLastHours(String(db.vessel.currentEngineHours));
    setNewLastDate(new Date().toISOString().slice(0, 10));
    setNewSpecNotes('');
    setNewProcNotes('');
    setNewManualId('');
    setNewManualPage('');
    setNewLinkedItems([]);
    setNewTaskPhotos([]);
    setIsAddingCustomCategory(false);
    setCustomCategoryInput('');
    setShowNewScheduleModal(true);
  };

  const openEditScheduleModal = (sched: MaintenanceSchedule) => {
    setEditingSchedule(sched);
    setNewTitle(sched.title);
    setNewCategory(sched.category);
    const hasInterval = Boolean(sched.intervalHours || sched.intervalDays);
    setNewIntervalMode(hasInterval ? 'scheduled' : 'as-needed');
    setNewIntervalHours(sched.intervalHours !== undefined ? String(sched.intervalHours) : '100');
    setNewIntervalDays(sched.intervalDays !== undefined ? String(sched.intervalDays) : '365');
    setNewLastHours(sched.lastCompletedHours !== undefined ? String(sched.lastCompletedHours) : '');
    setNewLastDate(sched.lastCompletedDate || '');
    setNewSpecNotes(sched.wrenchOrSpecNotes || '');
    setNewProcNotes(sched.procedureNotes || '');
    setNewManualId(sched.manualId || '');
    setNewManualPage(sched.manualPage || '');
    setNewLinkedItems([...(sched.linkedParts || [])]);
    setNewTaskPhotos([...(sched.photos || [])]);
    setIsAddingCustomCategory(false);
    setCustomCategoryInput('');
    setShowNewScheduleModal(true);
  };

  const evaluated = useMemo(
    () =>
      db.schedules
        .map((s) => evaluateSchedule(s, db.vessel.currentEngineHours))
        .sort((a, b) => {
          const rank = { overdue: 0, 'due-soon': 1, good: 2, 'as-needed': 3 };
          if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
          return b.progressPercent - a.progressPercent;
        }),
    [db.schedules, db.vessel.currentEngineHours]
  );

  // Pre-index service logs by scheduleId so task status checks are O(1) instead of O(L log L) per schedule
  const logsByScheduleId = useMemo(() => {
    const map = new Map<string, ServiceLogEntry[]>();
    for (const log of db.serviceLogs) {
      if (!log.scheduleId) continue;
      let list = map.get(log.scheduleId);
      if (!list) {
        list = [];
        map.set(log.scheduleId, list);
      }
      list.push(log);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const dateDiff = b.date.localeCompare(a.date);
        if (dateDiff !== 0) return dateDiff;
        return b.id.localeCompare(a.id);
      });
    }
    return map;
  }, [db.serviceLogs]);

  // Check if a task is cleared from the Maintenance Tasks pane (cancelled, or completed as-needed)
  const isTaskClearedFromMaintenance = (s: MaintenanceSchedule, status: ScheduleStatus) => {
    const scheduleLogs = logsByScheduleId.get(s.id) || [];
    // 1. Any task whose most recent service log entry is 'cancelled' is cleared from Maintenance Tasks
    if (scheduleLogs.length > 0 && scheduleLogs[0].status === 'cancelled') {
      return true;
    }

    // 2. An as-needed task that has been completed in the Service Logbook is cleared from Maintenance Tasks
    if (status === 'as-needed') {
      const hasCompletedLog = scheduleLogs.some(
        (l) => (l.status || 'completed') === 'completed'
      );
      if (hasCompletedLog) return true;
    }

    return false;
  };

  // Active tasks for Maintenance Tasks pane: exclude completed or cancelled tasks (they live in Service Logbook)
  const activeEvaluated = evaluated.filter(
    (e) => !isTaskClearedFromMaintenance(e.schedule, e.status)
  );

  const itemsInSelectedSystem = activeEvaluated.filter((e) => {
    if (selectedSystems.length === 0) return true;
    return systemTabs.some(
      (tab) => selectedSystems.includes(tab.id) && tab.matches(e.schedule.category)
    );
  });

  const totalInSelectedSystem = itemsInSelectedSystem.length;

  const pendingCountInSystem = itemsInSelectedSystem.filter(
    (e) =>
      e.status === 'overdue' ||
      e.status === 'due-soon' ||
      e.status === 'as-needed'
  ).length;

  const scheduledCountInSystem = itemsInSelectedSystem.filter(
    (e) => e.status === 'good'
  ).length;

  const filteredEvaluated = activeEvaluated.filter((e) => {
    // 1. Vessel System multi-filter
    if (selectedSystems.length > 0) {
      const matchesAnySystem = systemTabs.some(
        (tab) => selectedSystems.includes(tab.id) && tab.matches(e.schedule.category)
      );
      if (!matchesAnySystem) return false;
    }

    const isPending =
      e.status === 'overdue' ||
      e.status === 'due-soon' ||
      e.status === 'as-needed';
    const isScheduled = e.status === 'good';

    // 2. Status multi-filter (Pending / Scheduled)
    if (selectedStatuses.length > 0) {
      const matchesStatus =
        (selectedStatuses.includes('pending') && isPending) ||
        (selectedStatuses.includes('scheduled') && isScheduled);

      if (!matchesStatus) return false;
    }

    return true;
  });

  const filteredServiceLogs = useMemo(() => {
    return db.serviceLogs.filter((log) => {
      if (historySelectedSystems.length > 0) {
        const matchesAnySystem = systemTabs.some(
          (tab) => historySelectedSystems.includes(tab.id) && tab.matches(log.category)
        );
        if (!matchesAnySystem) return false;
      }
      if (selectedLogStatuses.length > 0) {
        const currentLogStatus = log.status || 'completed';
        if (!selectedLogStatuses.includes(currentLogStatus)) return false;
      }
      if (historySearchQuery.trim()) {
        const q = historySearchQuery.toLowerCase();
        const matchesTitle = log.title.toLowerCase().includes(q);
        const matchesCategory = log.category.toLowerCase().includes(q);
        const matchesNotes = log.notes.toLowerCase().includes(q);
        const matchesDate = log.date.toLowerCase().includes(q);
        const matchesParts = log.partsUsed?.some(
          (p) =>
            (p.nameSnapshot && p.nameSnapshot.toLowerCase().includes(q)) ||
            p.partId.toLowerCase().includes(q)
        );
        const matchesPhotoCaption = log.photos?.some(
          (ph) => ph.caption && ph.caption.toLowerCase().includes(q)
        );
        if (
          !matchesTitle &&
          !matchesCategory &&
          !matchesNotes &&
          !matchesDate &&
          !matchesParts &&
          !matchesPhotoCaption
        ) {
          return false;
        }
      }
      return true;
    });
  }, [db.serviceLogs, historySelectedSystems, selectedLogStatuses, systemTabs, historySearchQuery]);

  const totalHistoryCost = useMemo(() => {
    return filteredServiceLogs.reduce((sum, log) => sum + (log.cost || 0), 0);
  }, [filteredServiceLogs]);

  const handleDeleteServiceLog = (id: string) => {
    onUpdateDb((prev) => {
      const logToDelete = prev.serviceLogs.find((l) => l.id === id);
      let updatedSchedules = prev.schedules;
      if (logToDelete?.scheduleId && (logToDelete.status || 'completed') === 'completed') {
        const remainingLogs = prev.serviceLogs.filter(
          (l) =>
            l.id !== id &&
            l.scheduleId === logToDelete.scheduleId &&
            (l.status || 'completed') === 'completed'
        );
        if (remainingLogs.length > 0) {
          const sorted = [...remainingLogs].sort((a, b) => b.date.localeCompare(a.date));
          updatedSchedules = prev.schedules.map((s) =>
            s.id === logToDelete.scheduleId
              ? {
                  ...s,
                  lastCompletedDate: sorted[0].date,
                  lastCompletedHours: sorted[0].engineHours,
                }
              : s
          );
        } else {
          updatedSchedules = prev.schedules.map((s) =>
            s.id === logToDelete.scheduleId
              ? {
                  ...s,
                  lastCompletedDate: undefined,
                  lastCompletedHours: undefined,
                }
              : s
          );
        }
      }

      return {
        ...prev,
        schedules: updatedSchedules,
        serviceLogs: prev.serviceLogs.filter((l) => l.id !== id),
      };
    });
  };

  const openEditLogModal = (log: ServiceLogEntry) => {
    setEditingLog(log);
    setEditLogTitle(log.title);
    setEditLogCategory(log.category);
    setEditLogStatus(log.status || 'completed');
    setEditLogDate(log.date);
    setEditLogHours(String(log.engineHours));
    setEditLogCost(log.cost ? String(log.cost) : '');
    setEditLogNotes(log.notes || '');
    setEditLogPhotos([...(log.photos || [])]);
    setEditLogPartsUsed([...(log.partsUsed || [])]);
    setEditLogExtraPartId('');
    setIsEditLogAddingCustomCategory(false);
    setEditLogCustomCategoryInput('');
  };

  const handleSaveEditLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLog) return;

    const hoursNum = parseFloat(editLogHours) || editingLog.engineHours;
    const costNum = parseFloat(editLogCost) || 0;
    const prevStatus = editingLog.status || 'completed';
    const newStatus = editLogStatus;
    const linkedSchedId = editingLog.scheduleId;

    onUpdateDb((prev) => {
      const updatedLogs: ServiceLogEntry[] = prev.serviceLogs.map((l) => {
        if (l.id !== editingLog.id) return l;
        return {
          ...l,
          title: editLogTitle.trim() || l.title,
          category: (editLogCategory || l.category) as SystemCategory,
          status: newStatus,
          date: editLogDate,
          engineHours: hoursNum,
          cost: costNum,
          notes: editLogNotes.trim(),
          photos: editLogPhotos.length > 0 ? editLogPhotos : undefined,
          partsUsed: editLogPartsUsed,
        };
      });

      let updatedSchedules = prev.schedules;
      if (linkedSchedId) {
        updatedSchedules = prev.schedules.map((s) => {
          if (s.id !== linkedSchedId) return s;

          if (prevStatus === 'completed' && newStatus !== 'completed') {
            const otherCompleted = updatedLogs.filter(
              (ol) =>
                ol.scheduleId === s.id &&
                ol.id !== editingLog.id &&
                (ol.status || 'completed') === 'completed'
            );
            if (otherCompleted.length > 0) {
              const sorted = [...otherCompleted].sort((a, b) =>
                b.date.localeCompare(a.date)
              );
              return {
                ...s,
                lastCompletedDate: sorted[0].date,
                lastCompletedHours: sorted[0].engineHours,
              };
            } else {
              return {
                ...s,
                lastCompletedDate: undefined,
                lastCompletedHours: undefined,
              };
            }
          }

          if (newStatus === 'completed') {
            return {
              ...s,
              lastCompletedDate: editLogDate,
              lastCompletedHours: hoursNum,
            };
          }

          return s;
        });
      }

      return {
        ...prev,
        schedules: updatedSchedules,
        serviceLogs: updatedLogs,
      };
    });

    setStatusToast('Service logbook entry updated.');
    setEditingLog(null);
  };

  const handleAddExtraPartToEditLog = () => {
    if (!editLogExtraPartId) return;
    const part = db.parts.find((p) => p.id === editLogExtraPartId);
    if (!part) return;
    if (editLogPartsUsed.some((lp) => lp.partId === part.id)) return;
    const isConsumable = part.itemType === 'consumable';
    setEditLogPartsUsed((prev) => [
      ...prev,
      {
        partId: part.id,
        quantityNeeded: 1,
        nameSnapshot: part.name,
        unitSnapshot: part.unit || (isConsumable ? 'oz' : 'each'),
      },
    ]);
    setEditLogExtraPartId('');
  };

  const handleUpdateEditLogPartQty = (partId: string, qty: number) => {
    setEditLogPartsUsed((prev) =>
      prev.map((p) => (p.partId === partId ? { ...p, quantityNeeded: qty } : p))
    );
  };

  const handleRemovePartFromEditLog = (partId: string) => {
    setEditLogPartsUsed((prev) => prev.filter((p) => p.partId !== partId));
  };

  const processSelectedPhotoFiles = async (
    files: FileList | null,
    onPhotosReady: (added: MaintenancePhoto[]) => void
  ) => {
    if (!files || files.length === 0) return;
    setIsProcessingPhoto(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const fileArray = Array.from(files);
      const results = await Promise.allSettled(
        fileArray.map(async (file, index) => {
          const isImage =
            file.type.startsWith('image/') ||
            /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i.test(file.name);
          if (!isImage) return null;
          const dataUrl = await compressImageFile(file, 1024, 0.75);
          return {
            id: `photo-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
            dataUrl,
            addedAt: today,
          };
        })
      );
      const added: MaintenancePhoto[] = results
        .filter(
          (r): r is PromiseFulfilledResult<MaintenancePhoto | null> =>
            r.status === 'fulfilled' && r.value !== null
        )
        .map((r) => r.value as MaintenancePhoto);

      if (added.length > 0) {
        onPhotosReady(added);
      }
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  const handleQuickAddPhotosToSchedule = async (scheduleId: string, files: FileList | null) => {
    await processSelectedPhotoFiles(files, (added) => {
      onUpdateDb((prev) => ({
        ...prev,
        schedules: prev.schedules.map((s) =>
          s.id === scheduleId
            ? { ...s, photos: [...(s.photos || []), ...added] }
            : s
        ),
      }));
      setStatusToast(`Attached ${added.length} photo${added.length > 1 ? 's' : ''} to maintenance task.`);
    });
  };

  const handleDeletePhotoFromSchedule = (scheduleId: string, photoId: string) => {
    onUpdateDb((prev) => ({
      ...prev,
      schedules: prev.schedules.map((s) =>
        s.id === scheduleId
          ? { ...s, photos: (s.photos || []).filter((p) => p.id !== photoId) }
          : s
      ),
    }));
  };

  const handleQuickAddPhotosToLog = async (logId: string, files: FileList | null) => {
    await processSelectedPhotoFiles(files, (added) => {
      onUpdateDb((prev) => ({
        ...prev,
        serviceLogs: prev.serviceLogs.map((l) =>
          l.id === logId
            ? { ...l, photos: [...(l.photos || []), ...added] }
            : l
        ),
      }));
      setStatusToast(`Attached ${added.length} photo${added.length > 1 ? 's' : ''} to service log entry.`);
    });
  };

  const handleDeletePhotoFromLog = (logId: string, photoId: string) => {
    onUpdateDb((prev) => ({
      ...prev,
      serviceLogs: prev.serviceLogs.map((l) =>
        l.id === logId
          ? { ...l, photos: (l.photos || []).filter((p) => p.id !== photoId) }
          : l
      ),
    }));
  };

  const openLogModal = (sched: MaintenanceSchedule) => {
    setLoggingSchedule(sched);
    setLogStatus('completed');
    setLogDate(new Date().toISOString().slice(0, 10));
    setLogHours(String(db.vessel.currentEngineHours));

    // Pre-populate parts used with required amounts from the schedule
    const initialUsed: Record<string, string> = {};
    (sched.linkedParts || []).forEach((lp) => {
      initialUsed[lp.partId] = String(lp.quantityNeeded);
    });
    setCustomPartsUsed(initialUsed);
    setExtraPartToAdd('');

    // Estimate cost from linked parts
    const estCost = (sched.linkedParts || []).reduce((sum, lp) => {
      const part = db.parts.find((p) => p.id === lp.partId);
      return sum + (part?.lastPricePaid ?? 0) * lp.quantityNeeded;
    }, 0);
    setLogCost(estCost > 0 ? estCost.toFixed(2) : '');
    setLogNotes('');
    setDeductSpares(true);
    setLogPhotos([]);
  };

  const handleAddExtraPartToLog = () => {
    if (!extraPartToAdd) return;
    const part = db.parts.find((p) => p.id === extraPartToAdd);
    if (!part) return;
    setCustomPartsUsed((prev) => ({
      ...prev,
      [part.id]: prev[part.id] || '1',
    }));
    setExtraPartToAdd('');
  };

  const handleRemovePartFromLog = (partId: string) => {
    setCustomPartsUsed((prev) => {
      const copy = { ...prev };
      delete copy[partId];
      return copy;
    });
  };

  const handleCompleteService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loggingSchedule) return;
    const hoursNum = parseFloat(logHours) || db.vessel.currentEngineHours;
    const costNum = parseFloat(logCost) || 0;

    // Build finalized array of parts/consumables used
    const finalizedPartsUsed: LinkedPartRequirement[] = [];
    for (const [partId, qtyStr] of Object.entries(customPartsUsed)) {
      const qty = parseFloat(qtyStr);
      const part = db.parts.find((p) => p.id === partId);
      if (qty && qty > 0 && part) {
        finalizedPartsUsed.push({
          partId,
          quantityNeeded: Number(qty.toFixed(2)),
          nameSnapshot: part.name,
          unitSnapshot: part.unit || (part.itemType === 'consumable' ? 'oz' : 'each'),
        });
      }
    }

    onUpdateDb((prev) => {
      const defaultNotes =
        logStatus === 'completed'
          ? 'Scheduled maintenance completed.'
          : logStatus === 'deferred'
          ? 'Maintenance task deferred.'
          : 'Maintenance task cancelled.';

      const newLog: ServiceLogEntry = {
        id: 'log-' + Date.now(),
        scheduleId: loggingSchedule.id,
        title: loggingSchedule.title,
        category: loggingSchedule.category,
        date: logDate,
        engineHours: hoursNum,
        cost: costNum,
        partsUsed: logStatus === 'completed' ? finalizedPartsUsed : [],
        notes: logNotes.trim() || defaultNotes,
        status: logStatus,
        photos: logPhotos.length > 0 ? logPhotos : undefined,
      };

      const updatedSchedules = prev.schedules.map((s) => {
        if (s.id !== loggingSchedule.id) return s;
        if (logStatus === 'completed') {
          return {
            ...s,
            lastCompletedHours: hoursNum,
            lastCompletedDate: logDate,
          };
        }
        return s;
      });

      // Deduct used consumables & spare parts from on-board inventory (FIFO across containers) if task is completed
      const updatedParts =
        deductSpares && logStatus === 'completed'
          ? prev.parts.map((part) => {
              const used = finalizedPartsUsed.find((lp) => lp.partId === part.id);
              if (!used) return part;
              return deductFromPartInventory(part, used.quantityNeeded);
            })
          : prev.parts;

      return {
        ...prev,
        vessel: {
          ...prev.vessel,
          currentEngineHours: Math.max(prev.vessel.currentEngineHours, hoursNum),
          lastUpdated: logDate,
        },
        schedules: updatedSchedules,
        serviceLogs: [newLog, ...prev.serviceLogs],
        parts: updatedParts,
      };
    });

    const statusLabel =
      logStatus === 'completed'
        ? 'completed'
        : logStatus === 'deferred'
        ? 'deferred'
        : 'cancelled';
    setStatusToast(`Service logged as ${statusLabel}: "${loggingSchedule.title}". Added to Service Logbook.`);
    setLoggingSchedule(null);
    setLogPhotos([]);
  };

  const handleAddLinkedItemToNewSchedule = () => {
    if (!pickerPartId) return;
    const qty = parseFloat(pickerQty) || 1;
    const part = db.parts.find((p) => p.id === pickerPartId);
    if (!part) return;

    if (newLinkedItems.some((item) => item.partId === pickerPartId)) {
      setNewLinkedItems((prev) =>
        prev.map((item) =>
          item.partId === pickerPartId ? { ...item, quantityNeeded: qty } : item
        )
      );
    } else {
      setNewLinkedItems((prev) => [
        ...prev,
        {
          partId: pickerPartId,
          quantityNeeded: qty,
          nameSnapshot: part.name,
          unitSnapshot: part.unit || (part.itemType === 'consumable' ? 'oz' : 'each'),
        },
      ]);
    }
    setPickerPartId('');
    setPickerQty('1');
  };

  const handleRemoveLinkedItemFromNewSchedule = (partId: string) => {
    setNewLinkedItems((prev) => prev.filter((item) => item.partId !== partId));
  };

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    const finalTitle = newTitle.trim();
    const finalCategory = newCategory.trim();
    if (!finalTitle || !finalCategory) return;

    const isAsNeeded = newIntervalMode === 'as-needed';
    const parsedHours = parseFloat(newIntervalHours);
    const parsedDays = parseInt(newIntervalDays, 10);
    const parsedLastHours = parseFloat(newLastHours);

    const isCustomCat = !CATEGORIES.includes(finalCategory);

    if (editingSchedule) {
      onUpdateDb((prev) => ({
        ...prev,
        schedules: prev.schedules.map((s) =>
          s.id === editingSchedule.id
            ? {
                ...s,
                title: finalTitle,
                category: finalCategory,
                intervalHours: !isAsNeeded && parsedHours > 0 ? parsedHours : undefined,
                intervalDays: !isAsNeeded && parsedDays > 0 ? parsedDays : undefined,
                lastCompletedHours: isAsNeeded ? s.lastCompletedHours : (!isNaN(parsedLastHours) && parsedLastHours >= 0 ? parsedLastHours : undefined),
                lastCompletedDate: isAsNeeded ? s.lastCompletedDate : (newLastDate || undefined),
                linkedParts: newLinkedItems,
                wrenchOrSpecNotes: newSpecNotes.trim() || undefined,
                procedureNotes: newProcNotes.trim() || undefined,
                manualId: newManualId || undefined,
                manualPage: newManualPage.trim() || undefined,
                photos: newTaskPhotos.length > 0 ? newTaskPhotos : undefined,
              }
            : s
        ),
        customCategories:
          isCustomCat && !prev.customCategories?.includes(finalCategory)
            ? [...(prev.customCategories || []), finalCategory]
            : prev.customCategories,
      }));
    } else {
      const created: MaintenanceSchedule = {
        id: 'sched-' + Date.now(),
        title: finalTitle,
        category: finalCategory,
        intervalHours: !isAsNeeded && parsedHours > 0 ? parsedHours : undefined,
        intervalDays: !isAsNeeded && parsedDays > 0 ? parsedDays : undefined,
        lastCompletedHours: !isAsNeeded && !isNaN(parsedLastHours) && parsedLastHours >= 0 ? parsedLastHours : undefined,
        lastCompletedDate: !isAsNeeded ? (newLastDate || undefined) : undefined,
        linkedParts: newLinkedItems,
        wrenchOrSpecNotes: newSpecNotes.trim() || undefined,
        procedureNotes: newProcNotes.trim() || undefined,
        manualId: newManualId || undefined,
        manualPage: newManualPage.trim() || undefined,
        photos: newTaskPhotos.length > 0 ? newTaskPhotos : undefined,
      };

      onUpdateDb((prev) => ({
        ...prev,
        schedules: [...prev.schedules, created],
        customCategories:
          isCustomCat && !prev.customCategories?.includes(finalCategory)
            ? [...(prev.customCategories || []), finalCategory]
            : prev.customCategories,
      }));
    }

    setNewTitle('');
    setNewSpecNotes('');
    setNewProcNotes('');
    setNewLinkedItems([]);
    setNewTaskPhotos([]);
    setIsAddingCustomCategory(false);
    setCustomCategoryInput('');
    setShowNewScheduleModal(false);
    setEditingSchedule(null);
  };

  const handleDeleteSchedule = (id: string) => {
    onUpdateDb((prev) => ({
      ...prev,
      schedules: prev.schedules.filter((s) => s.id !== id),
    }));
  };

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/90 border border-slate-800 p-2 sm:p-3 rounded-xl">
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setSubTab('schedules')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              subTab === 'schedules'
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span className="sm:hidden">Tasks ({activeEvaluated.length})</span>
            <span className="hidden sm:inline">Maintenance Tasks ({activeEvaluated.length})</span>
          </button>
          <button
            onClick={() => setSubTab('history')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              subTab === 'history'
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span className="sm:hidden">Logbook</span>
            <span className="hidden sm:inline">Service Logbook</span>
          </button>
        </div>

        <button
          onClick={openCreateScheduleModal}
          className="flex items-center gap-1 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg transition shadow shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span className="sm:hidden">+ Task</span>
          <span className="hidden sm:inline">Add Maintenance Task</span>
        </button>
      </div>

      {/* Toast Feedback */}
      {statusToast && (
        <div className="flex items-center justify-between bg-emerald-950/80 border border-emerald-500/50 rounded-xl px-4 py-3 text-emerald-200 text-xs shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{statusToast}</span>
          </div>
          <button
            onClick={() => setStatusToast(null)}
            className="text-emerald-400 hover:text-emerald-200 font-bold ml-2 text-sm leading-none px-1"
          >
            ×
          </button>
        </div>
      )}

      {subTab === 'schedules' && (
        <div className="space-y-3">
          {/* Filter Bar with Dropdowns (Vessel System & Task Status) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 relative z-20">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
              {/* 1. Filter by Vessel System Pull-down (Multi-Select) */}
              <div className="relative flex-1 sm:flex-initial" ref={systemDropdownRef}>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Vessel System
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsSystemDropdownOpen((prev) => !prev);
                    setIsStatusDropdownOpen(false);
                  }}
                  className={`w-full sm:w-auto flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition shadow-sm sm:min-w-[190px] ${
                    selectedSystems.length > 0
                      ? 'bg-sky-500/20 text-sky-200 border-sky-400'
                      : 'bg-slate-950 text-slate-200 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Layers className="w-4 h-4 text-sky-400 shrink-0" />
                    <span className="truncate">
                      {selectedSystems.length === 0
                        ? 'All Systems'
                        : selectedSystems.length === 1
                        ? systemTabs.find((t) => t.id === selectedSystems[0])?.label || '1 System'
                        : `${selectedSystems.length} Systems Selected`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
                      {totalInSelectedSystem}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                        isSystemDropdownOpen ? 'rotate-180 text-sky-400' : ''
                      }`}
                    />
                  </div>
                </button>

                {isSystemDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1.5 w-64 max-h-72 overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-50 space-y-0.5">
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 mb-1 flex items-center justify-between">
                      <span>Select Systems (Multi)</span>
                      {selectedSystems.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setSelectedSystems([])}
                          className="text-[10px] text-sky-400 hover:underline"
                        >
                          Select All
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-500">All Active</span>
                      )}
                    </div>

                    {/* "All Systems" row */}
                    <button
                      type="button"
                      onClick={() => setSelectedSystems([])}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs transition text-left ${
                        selectedSystems.length === 0
                          ? 'bg-sky-500/20 text-sky-100 font-bold'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className={`w-4 h-4 rounded flex items-center justify-center border transition ${
                            selectedSystems.length === 0
                              ? 'bg-sky-500 border-sky-400 text-slate-950'
                              : 'border-slate-700 bg-slate-950'
                          }`}
                        >
                          {selectedSystems.length === 0 && <Check className="w-3 h-3 stroke-[3]" />}
                        </span>
                        <Layers className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <span className="truncate">All Systems</span>
                      </div>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
                        {activeEvaluated.length}
                      </span>
                    </button>

                    {systemTabs
                      .filter((t) => t.id !== 'all')
                      .map((tab) => {
                        const Icon = tab.icon;
                        const isSelected = selectedSystems.includes(tab.id);
                        const count = activeEvaluated.filter((e) =>
                          tab.matches(e.schedule.category)
                        ).length;

                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => {
                              setSelectedSystems((prev) =>
                                prev.includes(tab.id)
                                  ? prev.filter((id) => id !== tab.id)
                                  : [...prev, tab.id]
                              );
                            }}
                            className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs transition text-left ${
                              isSelected
                                ? 'bg-sky-500/20 text-sky-100 font-bold'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span
                                className={`w-4 h-4 rounded flex items-center justify-center border transition ${
                                  isSelected
                                    ? 'bg-sky-500 border-sky-400 text-slate-950'
                                    : 'border-slate-700 bg-slate-950'
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </span>
                              <Icon className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                              <span className="truncate">{tab.label}</span>
                            </div>
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
                              {count}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* 2. Filter by Task Status Pull-down (Multi-Select) */}
              <div className="relative flex-1 sm:flex-initial" ref={statusDropdownRef}>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Task Status
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsStatusDropdownOpen((prev) => !prev);
                    setIsSystemDropdownOpen(false);
                  }}
                  className={`w-full sm:w-auto flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition shadow-sm sm:min-w-[190px] ${
                    selectedStatuses.length > 0
                      ? 'bg-sky-500/20 text-sky-200 border-sky-400'
                      : 'bg-slate-950 text-slate-200 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="truncate">
                      {selectedStatuses.length === 0
                        ? 'All Active (Scheduled & Pending)'
                        : selectedStatuses.length === 1
                        ? selectedStatuses[0] === 'pending'
                          ? 'Pending'
                          : 'Scheduled'
                        : `${selectedStatuses.length} Statuses Selected`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
                      {pendingCountInSystem + scheduledCountInSystem}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                        isStatusDropdownOpen ? 'rotate-180 text-sky-400' : ''
                      }`}
                    />
                  </div>
                </button>

                {isStatusDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1.5 w-60 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-50 space-y-0.5">
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 mb-1 flex items-center justify-between">
                      <span>Select Statuses (Multi)</span>
                      {selectedStatuses.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setSelectedStatuses([])}
                          className="text-[10px] text-sky-400 hover:underline"
                        >
                          Select All Active
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-500">All Active</span>
                      )}
                    </div>

                    {/* "All Active Tasks" row */}
                    <button
                      type="button"
                      onClick={() => setSelectedStatuses([])}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs transition text-left ${
                        selectedStatuses.length === 0
                          ? 'bg-sky-500/20 text-sky-100 font-bold'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className={`w-4 h-4 rounded flex items-center justify-center border transition ${
                            selectedStatuses.length === 0
                              ? 'bg-sky-500 border-sky-400 text-slate-950'
                              : 'border-slate-700 bg-slate-950'
                          }`}
                        >
                          {selectedStatuses.length === 0 && <Check className="w-3 h-3 stroke-[3]" />}
                        </span>
                        <Layers className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <span className="truncate">All Active Tasks</span>
                      </div>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
                        {pendingCountInSystem + scheduledCountInSystem}
                      </span>
                    </button>

                    {[
                      {
                        id: 'pending',
                        label: 'Pending (Due / As-Needed)',
                        icon: Clock,
                        color: 'text-amber-400',
                        count: pendingCountInSystem,
                      },
                      {
                        id: 'scheduled',
                        label: 'Scheduled (On Track)',
                        icon: Calendar,
                        color: 'text-sky-400',
                        count: scheduledCountInSystem,
                      },
                    ].map((opt) => {
                      const Icon = opt.icon;
                      const isSelected = selectedStatuses.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setSelectedStatuses((prev) =>
                              prev.includes(opt.id)
                                ? prev.filter((id) => id !== opt.id)
                                : [...prev, opt.id]
                            );
                          }}
                          className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs transition text-left ${
                            isSelected
                              ? 'bg-sky-500/20 text-sky-100 font-bold'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span
                              className={`w-4 h-4 rounded flex items-center justify-center border transition ${
                                isSelected
                                  ? 'bg-sky-500 border-sky-400 text-slate-950'
                                  : 'border-slate-700 bg-slate-950'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </span>
                            <Icon className={`w-3.5 h-3.5 ${opt.color} shrink-0`} />
                            <span className="truncate">{opt.label}</span>
                          </div>
                          <span
                            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                              opt.id === 'pending' && opt.count > 0
                                ? 'bg-amber-500/20 text-amber-300 font-bold'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {opt.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="bg-slate-950 border border-slate-800 px-2.5 py-1.5 rounded-lg text-slate-300 font-semibold flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>{filteredEvaluated.length} Tasks</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {subTab === 'schedules' ? (
        filteredEvaluated.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-2">
            <div className="text-sm font-bold text-slate-200">
              No matching maintenance tasks found
            </div>
            <p className="text-xs text-slate-400">
              {selectedStatuses.includes('pending') && selectedStatuses.length === 1
                ? 'No maintenance tasks are currently pending.'
                : selectedStatuses.includes('scheduled') && selectedStatuses.length === 1
                ? 'No recurring scheduled tasks found.'
                : selectedStatuses.includes('completed') && selectedStatuses.length === 1
                ? 'No maintenance tasks have been logged as completed yet.'
                : 'No maintenance tasks match the selected filters.'}
            </p>
            <button
              onClick={openCreateScheduleModal}
              className="inline-flex items-center gap-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs px-3.5 py-2 rounded-lg transition mt-1"
            >
              <Plus className="w-4 h-4" />
              Add Maintenance Task
            </button>
          </div>
        ) : (
        <div className="space-y-3">
          {filteredEvaluated.map((item) => {
            const { schedule, status, progressPercent, summaryText } = item;
            const isAsNeeded = status === 'as-needed';
            const isOverdue = status === 'overdue';
            const isDueSoon = status === 'due-soon';

            const badgeStyle =
              isOverdue
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : isDueSoon
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : isAsNeeded
                ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                : 'bg-sky-500/20 text-sky-300 border-sky-500/40';

            const barStyle =
              status === 'overdue'
                ? 'bg-rose-500'
                : status === 'due-soon'
                ? 'bg-amber-500'
                : 'bg-emerald-500';

            // Check if any linked consumable or part is low or missing
            const lowItems = (schedule.linkedParts || []).filter((lp) => {
              const part = db.parts.find((p) => p.id === lp.partId);
              if (!part) return true;
              if (part.trackQuantity === false) return false;
              return part.quantityOnBoard <= part.minQuantity;
            });
            const isExpanded = Boolean(expandedScheduleIds[schedule.id]);
            const linkedManual = findMatchingManual(db.manuals, schedule);

            return (
              <div
                key={schedule.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 shadow-sm"
              >
                <div className="space-y-2">
                  {/* Row 1: Category, Status, Manual Badges and Log Done Button */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="text-[11px] font-medium uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {schedule.category}
                      </span>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${badgeStyle}`}
                      >
                        {isOverdue ? (
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                        ) : isDueSoon ? (
                          <Clock className="w-3 h-3 text-amber-400" />
                        ) : isAsNeeded ? (
                          <Clock className="w-3 h-3 text-teal-400" />
                        ) : (
                          <Calendar className="w-3 h-3 text-sky-400" />
                        )}
                        {isOverdue
                          ? 'PENDING (OVERDUE)'
                          : isDueSoon
                          ? 'PENDING (DUE SOON)'
                          : isAsNeeded
                          ? 'PENDING'
                          : 'SCHEDULED'}
                      </span>

                      {linkedManual && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void openOrShareManualPdf(linkedManual, schedule.manualPage);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-500/40 hover:bg-indigo-500/30 transition cursor-pointer"
                          title={`Open ${linkedManual.title}${
                            schedule.manualPage ? ` (${schedule.manualPage})` : ''
                          }`}
                        >
                          <BookOpen className="w-3 h-3 text-indigo-300" />
                          <span>
                            Manual PDF{schedule.manualPage ? ` (${schedule.manualPage})` : ''}
                          </span>
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => openLogModal(schedule)}
                      title="Record this task as completed now"
                      className="ml-auto shrink-0 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-lg transition shadow flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Log Done</span>
                    </button>
                  </div>

                  {/* Row 2: Dedicated Full-Width Task Title with 100% width across the card */}
                  <button
                    type="button"
                    onClick={() => toggleScheduleExpanded(schedule.id)}
                    className="text-left w-full group cursor-pointer block pt-0.5"
                    title={isExpanded ? 'Click to collapse task details' : 'Click to expand task details'}
                  >
                    <h3 className="text-base font-bold text-slate-100 group-hover:text-sky-300 transition flex items-start gap-1.5 w-full">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-sky-400 shrink-0 mt-1" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-sky-400 shrink-0 mt-1" />
                      )}
                      <span className="w-full break-words">{schedule.title}</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 pl-5.5">{summaryText}</p>
                  </button>
                </div>

                {isExpanded && (
                  <>
                {/* Progress Bar (for scheduled interval tasks) OR Operational Banner (for as-needed tasks) */}
                {isAsNeeded ? (
                  <div className="flex items-center justify-between text-[11px] bg-slate-950/70 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-400">
                    <span className="text-sky-300 flex items-center gap-1">
                      <Wrench className="w-3 h-3 text-sky-400" />
                      Operational / Event-Driven (No fixed interval)
                    </span>
                    <span className="text-[10px] text-slate-500">Log whenever performed</span>
                  </div>
                ) : (
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className={`h-full transition-all ${barStyle}`}
                      style={{ width: `${Math.min(100, Math.max(6, progressPercent))}%` }}
                    />
                  </div>
                )}

                {/* Last Service & Interval metadata */}
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                  <div className="flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span>
                      Last: <strong className="text-slate-200">{schedule.lastCompletedHours !== undefined ? `${schedule.lastCompletedHours}h` : '—'}</strong>
                      {schedule.intervalHours ? ` (Every ${schedule.intervalHours}h)` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span>
                      Date: <strong className="text-slate-200">{schedule.lastCompletedDate ?? '—'}</strong>
                      {schedule.intervalDays ? ` (${schedule.intervalDays}d)` : ''}
                    </span>
                  </div>
                </div>

                {/* Wrench / Spec notes */}
                {schedule.wrenchOrSpecNotes && (
                  <div className="text-xs bg-slate-950/90 border border-slate-800/90 rounded-lg px-3 py-2 text-amber-200/90">
                    <span className="font-semibold text-amber-400">Specs / Tools / Dosage: </span>
                    {schedule.wrenchOrSpecNotes}
                  </div>
                )}

                {schedule.procedureNotes && (
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {schedule.procedureNotes}
                  </p>
                )}

                {/* Linked Consumables & Spare Parts Strip */}
                {(schedule.linkedParts || []).length > 0 && (
                  <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-semibold uppercase tracking-wider">
                        Required Consumables & Parts:
                      </span>
                      {lowItems.length > 0 && (
                        <span className="text-rose-400 font-bold flex items-center gap-1">
                          <ShoppingCart className="w-3 h-3" />
                          Consumable Restock Advised ({lowItems.length})
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-1.5">
                        {(schedule.linkedParts || []).map((lp) => {
                          const part = db.parts.find((p) => p.id === lp.partId);
                          if (!part) return null;
                          const isConsumable = part.itemType === 'consumable';
                          const unit = part.unit || (isConsumable ? 'oz' : 'each');
                          const isTracked = part.trackQuantity !== false;
                          const isLow = isTracked && part.quantityOnBoard <= part.minQuantity;
                          const hasEnough = !isTracked || part.quantityOnBoard >= lp.quantityNeeded;

                          return (
                            <button
                              key={lp.partId}
                              onClick={() => onJumpToPart(part.id)}
                              title={
                                isLow
                                  ? `Low stock! Click to view prices and buy ${part.name}`
                                  : `Click to view inventory details for ${part.name}`
                              }
                              className={`text-xs px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 transition ${
                                isLow
                                  ? 'bg-rose-950/40 border-rose-600/60 text-rose-200 hover:border-rose-400'
                                  : isConsumable
                                  ? 'bg-teal-950/30 border-teal-600/40 text-teal-200 hover:border-teal-400'
                                  : 'bg-slate-800/80 border-slate-700 text-slate-200 hover:border-sky-500'
                              }`}
                            >
                              {isConsumable ? (
                                <FlaskConical className="w-3.5 h-3.5 text-teal-400" />
                              ) : (
                                <Package className="w-3.5 h-3.5 text-sky-400" />
                              )}
                              <span>
                                {lp.quantityNeeded} {unit} {part.name}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                  !isTracked
                                    ? 'bg-slate-800 text-slate-300'
                                    : hasEnough
                                    ? isLow
                                      ? 'bg-amber-500/20 text-amber-300'
                                      : 'bg-emerald-500/20 text-emerald-300'
                                    : 'bg-rose-500/30 text-rose-200'
                                }`}
                              >
                                {isTracked ? `${part.quantityOnBoard} ${unit} on board` : 'Catalog ref'}
                              </span>
                              {isLow && (
                                <span className="text-[10px] text-rose-400 font-extrabold underline ml-0.5">
                                  Buy
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Reference Photos & Diagrams Strip */}
                {(schedule.photos || []).length > 0 && (
                  <div className="pt-2 border-t border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5 text-sky-300">
                        <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                        Task Photos & Reference Diagrams ({(schedule.photos || []).length})
                      </span>
                      <span className="text-[10px] text-slate-500">Tap photo to enlarge</span>
                    </div>

                    <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                      {(schedule.photos || []).map((photo) => (
                        <div
                          key={photo.id}
                          className="relative group shrink-0 w-24 bg-slate-950 border border-slate-800 hover:border-sky-500/60 rounded-lg overflow-hidden transition"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setLightboxPhoto({
                                photo,
                                contextTitle: schedule.title,
                                onDelete: () => handleDeletePhotoFromSchedule(schedule.id, photo.id),
                              })
                            }
                            className="block w-full h-20 overflow-hidden relative"
                            title={photo.caption || 'Click to view full size'}
                          >
                            <img
                              src={photo.dataUrl}
                              alt={photo.caption || schedule.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition flex items-center justify-center">
                              <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition drop-shadow" />
                            </div>
                          </button>
                          {photo.caption && (
                            <div className="px-1.5 py-1 text-[10px] text-slate-300 truncate bg-slate-950 border-t border-slate-800/80">
                              {photo.caption}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeletePhotoFromSchedule(schedule.id, photo.id)}
                            className="absolute top-1 right-1 bg-slate-950/85 hover:bg-rose-600 text-slate-300 hover:text-white rounded-full p-1 opacity-80 group-hover:opacity-100 transition shadow"
                            title="Remove photo"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Card Actions Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs text-slate-400 gap-2 flex-wrap">
                  <div className="text-[11px] text-slate-500">
                    ID: <span className="font-mono text-slate-400">{schedule.id}</span>
                  </div>

                  <div className="flex items-center gap-2 ml-auto">
                    {!IS_DEMO_MODE && (
                      <label
                        className="flex items-center gap-1 text-slate-300 hover:text-emerald-300 bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg px-2.5 py-1 text-xs transition font-semibold cursor-pointer"
                        title="Attach photo or diagram to this task"
                      >
                        <Camera className="w-3.5 h-3.5 text-emerald-400" />
                        <span>+ Photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            void handleQuickAddPhotosToSchedule(schedule.id, e.target.files);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    )}
                    <button
                      onClick={() => openEditScheduleModal(schedule)}
                      className="flex items-center gap-1 text-slate-300 hover:text-sky-300 bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg px-2.5 py-1 text-xs transition font-semibold"
                      title="Edit task details"
                    >
                      <Pencil className="w-3.5 h-3.5 text-sky-400" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDeleteSchedule(schedule.id)}
                      className="text-slate-600 hover:text-rose-400 p-1.5 transition rounded-lg hover:bg-rose-500/10"
                      title="Delete task"
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
        )
      ) : (
        /* Chronological Service Logbook History with System Category Filtering */
        <div className="space-y-3">
          {/* Pull-down System & Log Status Filters for History (Multi-Select) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 relative z-20">
            <div className="flex items-center gap-3 flex-wrap">
              {/* 1. Filter Logbook by System Pull-down */}
              <div className="relative" ref={historySystemDropdownRef}>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Vessel System
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsHistorySystemDropdownOpen((prev) => !prev);
                    setIsLogStatusDropdownOpen(false);
                  }}
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition shadow-sm min-w-[200px] ${
                    historySelectedSystems.length > 0
                      ? 'bg-sky-500/20 text-sky-200 border-sky-400'
                      : 'bg-slate-950 text-slate-200 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Layers className="w-4 h-4 text-sky-400 shrink-0" />
                    <span className="truncate">
                      {historySelectedSystems.length === 0
                        ? 'All Systems'
                        : historySelectedSystems.length === 1
                        ? systemTabs.find((t) => t.id === historySelectedSystems[0])?.label || '1 System'
                        : `${historySelectedSystems.length} Systems Selected`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
                      {filteredServiceLogs.length}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                        isHistorySystemDropdownOpen ? 'rotate-180 text-sky-400' : ''
                      }`}
                    />
                  </div>
                </button>

                {isHistorySystemDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1.5 w-64 max-h-72 overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-50 space-y-0.5">
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 mb-1 flex items-center justify-between">
                      <span>Select Systems (Multi)</span>
                      {historySelectedSystems.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setHistorySelectedSystems([])}
                          className="text-[10px] text-sky-400 hover:underline"
                        >
                          Select All
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-500">All Active</span>
                      )}
                    </div>

                    {/* "All Systems" row */}
                    <button
                      type="button"
                      onClick={() => setHistorySelectedSystems([])}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs transition text-left ${
                        historySelectedSystems.length === 0
                          ? 'bg-sky-500/20 text-sky-100 font-bold'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className={`w-4 h-4 rounded flex items-center justify-center border transition ${
                            historySelectedSystems.length === 0
                              ? 'bg-sky-500 border-sky-400 text-slate-950'
                              : 'border-slate-700 bg-slate-950'
                          }`}
                        >
                          {historySelectedSystems.length === 0 && <Check className="w-3 h-3 stroke-[3]" />}
                        </span>
                        <Layers className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <span className="truncate">All Systems</span>
                      </div>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
                        {db.serviceLogs.length}
                      </span>
                    </button>

                    {systemTabs
                      .filter((t) => t.id !== 'all')
                      .map((tab) => {
                        const Icon = tab.icon;
                        const isSelected = historySelectedSystems.includes(tab.id);
                        const count = db.serviceLogs.filter((l) =>
                          tab.matches(l.category)
                        ).length;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => {
                              setHistorySelectedSystems((prev) =>
                                prev.includes(tab.id)
                                  ? prev.filter((id) => id !== tab.id)
                                  : [...prev, tab.id]
                              );
                            }}
                            className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs transition text-left ${
                              isSelected
                                ? 'bg-sky-500/20 text-sky-100 font-bold'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span
                                className={`w-4 h-4 rounded flex items-center justify-center border transition ${
                                  isSelected
                                    ? 'bg-sky-500 border-sky-400 text-slate-950'
                                    : 'border-slate-700 bg-slate-950'
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </span>
                              <Icon className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                              <span className="truncate">{tab.label}</span>
                            </div>
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
                              {count}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* 2. Filter Logbook by Log Status Pull-down (Multi-Select) */}
              <div className="relative" ref={logStatusDropdownRef}>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Log Status
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsLogStatusDropdownOpen((prev) => !prev);
                    setIsHistorySystemDropdownOpen(false);
                  }}
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition shadow-sm min-w-[180px] ${
                    selectedLogStatuses.length > 0
                      ? 'bg-sky-500/20 text-sky-200 border-sky-400'
                      : 'bg-slate-950 text-slate-200 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="truncate">
                      {selectedLogStatuses.length === 0
                        ? 'All Statuses'
                        : selectedLogStatuses.length === 1
                        ? selectedLogStatuses[0] === 'completed'
                          ? 'Completed'
                          : selectedLogStatuses[0] === 'deferred'
                          ? 'Deferred'
                          : 'Cancelled'
                        : `${selectedLogStatuses.length} Statuses Selected`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
                      {filteredServiceLogs.length}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                        isLogStatusDropdownOpen ? 'rotate-180 text-sky-400' : ''
                      }`}
                    />
                  </div>
                </button>

                {isLogStatusDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1.5 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-50 space-y-0.5">
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 mb-1 flex items-center justify-between">
                      <span>Select Statuses (Multi)</span>
                      {selectedLogStatuses.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setSelectedLogStatuses([])}
                          className="text-[10px] text-sky-400 hover:underline"
                        >
                          Select All
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-500">All Active</span>
                      )}
                    </div>

                    {/* "All Statuses" row */}
                    <button
                      type="button"
                      onClick={() => setSelectedLogStatuses([])}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs transition text-left ${
                        selectedLogStatuses.length === 0
                          ? 'bg-sky-500/20 text-sky-100 font-bold'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className={`w-4 h-4 rounded flex items-center justify-center border transition ${
                            selectedLogStatuses.length === 0
                              ? 'bg-sky-500 border-sky-400 text-slate-950'
                              : 'border-slate-700 bg-slate-950'
                          }`}
                        >
                          {selectedLogStatuses.length === 0 && <Check className="w-3 h-3 stroke-[3]" />}
                        </span>
                        <Layers className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <span className="truncate">All Statuses</span>
                      </div>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
                        {db.serviceLogs.length}
                      </span>
                    </button>

                    {[
                      {
                        id: 'completed',
                        label: 'Completed',
                        icon: CheckCircle2,
                        color: 'text-emerald-400',
                        count: db.serviceLogs.filter((l) => (l.status || 'completed') === 'completed').length,
                      },
                      {
                        id: 'deferred',
                        label: 'Deferred',
                        icon: Clock,
                        color: 'text-amber-400',
                        count: db.serviceLogs.filter((l) => l.status === 'deferred').length,
                      },
                      {
                        id: 'cancelled',
                        label: 'Cancelled',
                        icon: X,
                        color: 'text-rose-400',
                        count: db.serviceLogs.filter((l) => l.status === 'cancelled').length,
                      },
                    ].map((opt) => {
                      const Icon = opt.icon;
                      const isSelected = selectedLogStatuses.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setSelectedLogStatuses((prev) =>
                              prev.includes(opt.id)
                                ? prev.filter((id) => id !== opt.id)
                                : [...prev, opt.id]
                            );
                          }}
                          className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs transition text-left ${
                            isSelected
                              ? 'bg-sky-500/20 text-sky-100 font-bold'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span
                              className={`w-4 h-4 rounded flex items-center justify-center border transition ${
                                isSelected
                                  ? 'bg-sky-500 border-sky-400 text-slate-950'
                                  : 'border-slate-700 bg-slate-950'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </span>
                            <Icon className={`w-3.5 h-3.5 ${opt.color} shrink-0`} />
                            <span className="truncate">{opt.label}</span>
                          </div>
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
                            {opt.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-slate-300 font-semibold flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-sky-400" />
                <span>{filteredServiceLogs.length} Records</span>
              </span>
              <span className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-emerald-400 font-semibold flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5" />
                <span>${totalHistoryCost.toFixed(2)} Total</span>
              </span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search logbook title, notes, part used, or date..."
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* History Cards or Empty State */}
          {filteredServiceLogs.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-2">
              <div className="text-sm font-bold text-slate-200">
                No service logs found
                {historySelectedSystems.length === 1
                  ? ` in ${systemTabs.find((t) => t.id === historySelectedSystems[0])?.label || historySelectedSystems[0]}`
                  : historySelectedSystems.length > 1
                  ? ' in selected systems'
                  : ''}
              </div>
              <p className="text-xs text-slate-400">
                {historySearchQuery
                  ? `No service records match "${historySearchQuery}". Try clearing search.`
                  : historySelectedSystems.length > 0
                  ? `No historical service entries recorded for the selected system(s) yet.`
                  : 'No historical service entries recorded yet.'}
              </p>
              {historySearchQuery && (
                <button
                  onClick={() => setHistorySearchQuery('')}
                  className="text-xs text-sky-400 hover:text-sky-300 underline font-semibold mt-1"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredServiceLogs.map((log) => {
                const isLogExpanded = Boolean(expandedLogIds[log.id]);
                return (
                <div
                  key={log.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2.5"
                >
                  <div className="space-y-2">
                    {/* Row 1: Badges & Right-Aligned Engine Hours/Cost/Actions */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-sky-300">
                          {log.category}
                        </span>
                        {log.status === 'deferred' ? (
                          <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-amber-500/20 text-amber-300 border-amber-500/40 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-400" />
                            DEFERRED
                          </span>
                        ) : log.status === 'cancelled' ? (
                          <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-rose-500/20 text-rose-300 border-rose-500/40 flex items-center gap-1">
                            <X className="w-3 h-3 text-rose-400" />
                            CANCELLED
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-emerald-500/20 text-emerald-300 border-emerald-500/40 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            COMPLETED
                          </span>
                        )}
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          {log.date}
                        </span>
                      </div>

                      <div className="text-right text-xs shrink-0 flex items-center gap-2 ml-auto">
                        <div>
                          <div className="text-sky-400 font-mono font-bold flex items-center justify-end gap-1">
                            <Gauge className="w-3.5 h-3.5" />
                            <span>{log.engineHours} hrs</span>
                          </div>
                          {log.cost > 0 && (
                            <div className="text-emerald-400 font-semibold mt-0.5">
                              ${log.cost.toFixed(2)}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditLogModal(log);
                          }}
                          className="p-1.5 text-slate-400 hover:text-sky-300 hover:bg-slate-800 rounded-lg transition"
                          title="Edit service log entry"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Row 2: Dedicated Full-Width Log Title */}
                    <button
                      type="button"
                      onClick={() => toggleLogExpanded(log.id)}
                      className="text-left w-full group cursor-pointer block pt-0.5"
                      title={isLogExpanded ? 'Click to collapse log details' : 'Click to expand log details'}
                    >
                      <h4 className="text-sm sm:text-base font-bold text-slate-100 group-hover:text-sky-300 transition flex items-start gap-1.5 w-full">
                        {isLogExpanded ? (
                          <ChevronDown className="w-4 h-4 text-sky-400 shrink-0 mt-1" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-sky-400 shrink-0 mt-1" />
                        )}
                        <span className="w-full break-words">{log.title}</span>
                      </h4>
                    </button>
                  </div>

                  {isLogExpanded && (
                    <>
                  <p className="text-xs text-slate-300 leading-relaxed">{log.notes}</p>

                  {/* Consumables / Parts deducted during this service */}
                  {log.partsUsed && log.partsUsed.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-800/80">
                      {log.partsUsed.map((p, idx) => {
                        const part = db.parts.find((item) => item.id === p.partId);
                        const isConsumable = part?.itemType === 'consumable';
                        const name = p.nameSnapshot || part?.name || p.partId;
                        const unit = p.unitSnapshot || part?.unit || (isConsumable ? 'oz' : 'each');
                        return (
                          <span
                            key={`${p.partId}-${idx}`}
                            className={`text-[11px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                              isConsumable
                                ? 'bg-teal-950/40 border-teal-500/40 text-teal-200'
                                : 'bg-slate-800 border-slate-700 text-slate-200'
                            }`}
                          >
                            {isConsumable ? (
                              <FlaskConical className="w-3 h-3 text-teal-400" />
                            ) : (
                              <Package className="w-3 h-3 text-sky-400" />
                            )}
                            <span>
                              {name}: <strong className="font-mono text-white">{p.quantityNeeded} {unit}</strong>
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Service Inspection Photos */}
                  {log.photos && log.photos.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-300 flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                        Service & Inspection Photos ({log.photos.length})
                      </span>
                      <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        {log.photos.map((photo) => (
                          <div
                            key={photo.id}
                            className="relative group shrink-0 w-24 bg-slate-950 border border-slate-800 hover:border-sky-500/60 rounded-lg overflow-hidden transition"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setLightboxPhoto({
                                  photo,
                                  contextTitle: `${log.title} (${log.date})`,
                                  onDelete: () => handleDeletePhotoFromLog(log.id, photo.id),
                                })
                              }
                              className="block w-full h-20 overflow-hidden relative"
                              title={photo.caption || 'Click to view full size'}
                            >
                              <img
                                src={photo.dataUrl}
                                alt={photo.caption || log.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition flex items-center justify-center">
                                <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition drop-shadow" />
                              </div>
                            </button>
                            {photo.caption && (
                              <div className="px-1.5 py-1 text-[10px] text-slate-300 truncate bg-slate-950 border-t border-slate-800/80">
                                {photo.caption}
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeletePhotoFromLog(log.id, photo.id)}
                              className="absolute top-1 right-1 bg-slate-950/85 hover:bg-rose-600 text-slate-300 hover:text-white rounded-full p-1 opacity-80 group-hover:opacity-100 transition shadow"
                              title="Remove photo"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer with Edit, Add Photo & Delete entry actions */}
                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/60 text-xs">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditLogModal(log)}
                        className="flex items-center gap-1.5 text-slate-300 hover:text-sky-300 bg-slate-950/80 hover:bg-slate-800 border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition"
                        title="Edit service log entry"
                      >
                        <Pencil className="w-3 h-3 text-sky-400" />
                        <span>Edit</span>
                      </button>
                      {!IS_DEMO_MODE && (
                        <label
                          className="flex items-center gap-1 text-slate-400 hover:text-emerald-300 bg-slate-950/70 hover:bg-slate-800 border border-slate-800 rounded-lg px-2 py-1 text-[11px] font-semibold transition cursor-pointer"
                          title="Attach photo to this service log entry"
                        >
                          <Camera className="w-3 h-3 text-emerald-400" />
                          <span>+ Photo</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              void handleQuickAddPhotosToLog(log.id, e.target.files);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteServiceLog(log.id)}
                      className="text-slate-600 hover:text-rose-400 p-1 transition rounded hover:bg-rose-500/10"
                      title="Delete logbook entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                    </>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal: Log Completed Service with Consumable Deductions */}
      {loggingSchedule && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleCompleteService}
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl my-auto"
          >
            <div>
              <span
                className={`text-xs uppercase font-bold tracking-wider ${
                  logStatus === 'completed'
                    ? 'text-emerald-400'
                    : logStatus === 'deferred'
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {logStatus === 'completed'
                  ? 'Record Completed Task'
                  : logStatus === 'deferred'
                  ? 'Defer Maintenance Task'
                  : 'Cancel Maintenance Task'}
              </span>
              <h3 className="text-lg font-bold text-white mt-0.5">{loggingSchedule.title}</h3>
            </div>

            {/* Status Selection: Completed, Deferred, Cancelled */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-semibold">
                Entry Status
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setLogStatus('completed')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold border transition ${
                    logStatus === 'completed'
                      ? 'bg-emerald-500/25 border-emerald-500 text-emerald-200 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Completed</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLogStatus('deferred')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold border transition ${
                    logStatus === 'deferred'
                      ? 'bg-amber-500/25 border-amber-500 text-amber-200 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Deferred</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLogStatus('cancelled')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold border transition ${
                    logStatus === 'cancelled'
                      ? 'bg-rose-500/25 border-rose-500 text-rose-200 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <X className="w-3.5 h-3.5 text-rose-400" />
                  <span>Cancelled</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Service Date</label>
                <input
                  type="date"
                  required
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Engine Hours</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={logHours}
                  onChange={(e) => setLogHours(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Total Cost ($ optional)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={logCost}
                onChange={(e) => setLogCost(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>

            {/* Consumables & Parts to Deduct (Only if task is completed) */}
            {logStatus === 'completed' ? (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-400 flex items-center gap-1.5">
                    <FlaskConical className="w-3.5 h-3.5" />
                    Consumables & Parts Used (Auto-Deducted)
                  </span>
                  <label className="flex items-center gap-1 text-[11px] text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deductSpares}
                      onChange={(e) => setDeductSpares(e.target.checked)}
                      className="rounded text-sky-500"
                    />
                    <span>Deduct Stock</span>
                  </label>
                </div>

                {Object.keys(customPartsUsed).length === 0 ? (
                  <div className="text-xs text-slate-500 italic py-1">
                    No linked consumables or spare parts set for this task.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {Object.entries(customPartsUsed).map(([partId, qtyStr]) => {
                      const part = db.parts.find((p) => p.id === partId);
                      if (!part) return null;
                      const isConsumable = part.itemType === 'consumable';
                      const unit = part.unit || (isConsumable ? 'oz' : 'each');
                      const usedQty = parseFloat(qtyStr) || 0;
                      const isTracked = part.trackQuantity !== false;
                      const remaining = Math.max(0, Number((part.quantityOnBoard - usedQty).toFixed(2)));
                      const willBeLow = isTracked && remaining <= part.minQuantity;

                      return (
                        <div
                          key={part.id}
                          className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-white truncate flex items-center gap-1">
                                {isConsumable ? (
                                  <FlaskConical className="w-3 h-3 text-teal-400 shrink-0" />
                                ) : (
                                  <Package className="w-3 h-3 text-sky-400 shrink-0" />
                                )}
                                <span className="truncate">{part.name}</span>
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {isTracked ? (
                                  <>
                                    Stock: <strong className="text-slate-200">{part.quantityOnBoard} {unit}</strong> • After: <strong className={willBeLow ? 'text-rose-400' : 'text-emerald-400'}>{remaining} {unit}</strong>
                                  </>
                                ) : (
                                  <span className="text-slate-400">Untracked</span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                value={qtyStr}
                                onChange={(e) =>
                                  setCustomPartsUsed((prev) => ({
                                    ...prev,
                                    [part.id]: e.target.value,
                                  }))
                                }
                                className="w-16 bg-slate-950 border border-teal-500 rounded px-2 py-1 text-xs text-white font-mono text-right"
                              />
                              <span className="text-xs text-slate-400 font-mono">{unit}</span>
                              <button
                                type="button"
                                onClick={() => handleRemovePartFromLog(part.id)}
                                className="text-slate-500 hover:text-rose-400 p-0.5 ml-1"
                                title="Remove from this log"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {willBeLow && (
                            <div className="text-[10px] text-amber-300 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Stock will drop to or below minimum ({part.minQuantity} {unit}) — advise to buy another!
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add an extra consumable/part on the fly */}
                <div className="pt-1 flex items-center gap-1.5 w-full min-w-0">
                  <select
                    value={extraPartToAdd}
                    onChange={(e) => setExtraPartToAdd(e.target.value)}
                    className="flex-1 min-w-0 truncate bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="">+ Add other consumable or spare used...</option>
                    {db.parts
                      .filter((p) => !customPartsUsed[p.id])
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.itemType === 'consumable' ? '💧 ' : '🔧 '}
                          {p.name} {p.trackQuantity !== false ? `(${p.quantityOnBoard} ${p.unit || 'on board'})` : '(Untracked)'}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddExtraPartToLog}
                    disabled={!extraPartToAdd}
                    className="shrink-0 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-semibold text-white rounded transition"
                  >
                    Add
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-xs bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-slate-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-slate-500 shrink-0" />
                <span>
                  No parts or inventory stock will be deducted for a {logStatus} logbook entry.
                </span>
              </div>
            )}

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                {logStatus === 'completed'
                  ? 'Logbook Notes / Observations'
                  : logStatus === 'deferred'
                  ? 'Reason for Deferral'
                  : 'Reason for Cancellation'}
              </label>
              <textarea
                rows={2}
                placeholder={
                  logStatus === 'completed'
                    ? 'e.g., Water tank topped off, fresh taste, no leaks...'
                    : logStatus === 'deferred'
                    ? 'e.g., Deferring to haul-out next month; parts on order...'
                    : 'e.g., Equipment replaced; task no longer applicable...'
                }
                value={logNotes}
                onChange={(e) => setLogNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>

            {/* Service & Inspection Photos Section */}
            {!IS_DEMO_MODE ? (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5" />
                    Service & Inspection Photos ({logPhotos.length})
                  </span>
                  <label className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition">
                    <Camera className="w-3 h-3" />
                    <span>{isProcessingPhoto ? 'Compressing...' : '+ Snap / Upload Photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={isProcessingPhoto}
                      className="hidden"
                      onChange={(e) => {
                        void processSelectedPhotoFiles(e.target.files, (added) => {
                          setLogPhotos((prev) => [...prev, ...added]);
                        });
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>

                {logPhotos.length === 0 ? (
                  <div className="text-[11px] text-slate-500 italic">
                    Optional: Attach before/after photos of parts replaced, filters, or inspection findings.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {logPhotos.map((photo) => (
                      <div
                        key={photo.id}
                        className="flex items-center gap-2.5 bg-slate-900 border border-slate-800 rounded-lg p-2"
                      >
                        <img
                          src={photo.dataUrl}
                          alt={photo.caption || 'Service photo'}
                          className="w-12 h-12 rounded object-cover shrink-0 border border-slate-700"
                        />
                        <input
                          type="text"
                          placeholder="Add caption (e.g., Old impeller wear)..."
                          value={photo.caption || ''}
                          onChange={(e) =>
                            setLogPhotos((prev) =>
                              prev.map((p) =>
                                p.id === photo.id ? { ...p, caption: e.target.value } : p
                              )
                            )
                          }
                          className="flex-1 bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setLogPhotos((prev) => prev.filter((p) => p.id !== photo.id))
                          }
                          className="text-slate-500 hover:text-rose-400 p-1 shrink-0"
                          title="Remove photo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setLoggingSchedule(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`px-4 py-2 rounded-lg text-xs font-bold transition shadow ${
                  logStatus === 'completed'
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                    : logStatus === 'deferred'
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                    : 'bg-rose-500 hover:bg-rose-400 text-white'
                }`}
              >
                {logStatus === 'completed'
                  ? 'Save & Deduct Inventory'
                  : logStatus === 'deferred'
                  ? 'Record Deferral in Logbook'
                  : 'Record Cancellation in Logbook'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Edit Existing Service Logbook Entry */}
      {editingLog && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto pt-[max(1rem,env(safe-area-inset-top,0px))]">
          <form
            onSubmit={handleSaveEditLog}
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl my-auto"
          >
            <div className="flex items-center justify-between">
              <div>
                <span
                  className={`text-xs uppercase font-bold tracking-wider ${
                    editLogStatus === 'completed'
                      ? 'text-emerald-400'
                      : editLogStatus === 'deferred'
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  Edit Service Logbook Entry
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5 truncate max-w-xs sm:max-w-sm">
                  {editLogTitle || 'Untitled Record'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingLog(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Linked Maintenance Task shortcut */}
            {editingLog.scheduleId && (() => {
              const linkedTask = db.schedules.find((s) => s.id === editingLog.scheduleId);
              if (!linkedTask) return null;
              return (
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2">
                  <div className="text-xs text-slate-300 truncate">
                    <span className="text-slate-500 block text-[10px] uppercase font-bold">Linked Maintenance Task</span>
                    <span className="font-semibold text-slate-200 truncate">{linkedTask.title}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingLog(null);
                      openEditScheduleModal(linkedTask);
                    }}
                    className="flex items-center gap-1 text-[11px] font-semibold text-sky-400 hover:text-sky-300 bg-sky-950/60 hover:bg-sky-900/60 border border-sky-800/60 px-2.5 py-1 rounded-lg transition shrink-0"
                  >
                    <Wrench className="w-3 h-3" />
                    <span>Edit Task Specs</span>
                  </button>
                </div>
              );
            })()}

            {/* Status Selection: Completed, Deferred, Cancelled */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-semibold">
                Entry Status
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setEditLogStatus('completed')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold border transition ${
                    editLogStatus === 'completed'
                      ? 'bg-emerald-500/25 border-emerald-500 text-emerald-200 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Completed</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditLogStatus('deferred')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold border transition ${
                    editLogStatus === 'deferred'
                      ? 'bg-amber-500/25 border-amber-500 text-amber-200 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Deferred</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditLogStatus('cancelled')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold border transition ${
                    editLogStatus === 'cancelled'
                      ? 'bg-rose-500/25 border-rose-500 text-rose-200 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <X className="w-3.5 h-3.5 text-rose-400" />
                  <span>Cancelled</span>
                </button>
              </div>
            </div>

            {/* Service Title */}
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-semibold">Service Title</label>
              <input
                type="text"
                required
                value={editLogTitle}
                onChange={(e) => setEditLogTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Vessel System / Category */}
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-semibold">Vessel System</label>
              {isEditLogAddingCustomCategory ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="New custom system..."
                    value={editLogCustomCategoryInput}
                    onChange={(e) => setEditLogCustomCategoryInput(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = editLogCustomCategoryInput.trim();
                      if (trimmed) {
                        setEditLogCategory(trimmed);
                        if (!db.customCategories?.includes(trimmed)) {
                          onUpdateDb((prev) => ({
                            ...prev,
                            customCategories: [...(prev.customCategories || []), trimmed],
                          }));
                        }
                        setIsEditLogAddingCustomCategory(false);
                        setEditLogCustomCategoryInput('');
                      }
                    }}
                    disabled={!editLogCustomCategoryInput.trim()}
                    className="px-3 py-2 bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-lg transition"
                  >
                    Add
                  </button>
                </div>
              ) : (
                <select
                  value={editLogCategory}
                  onChange={(e) => {
                    if (e.target.value === '__add_custom__') {
                      setIsEditLogAddingCustomCategory(true);
                      setEditLogCustomCategoryInput('');
                    } else {
                      setEditLogCategory(e.target.value);
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                >
                  <optgroup label="Standard Systems">
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </optgroup>
                  {customCategoryNames.length > 0 && (
                    <optgroup label="Custom Systems">
                      {customCategoryNames.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <option value="__add_custom__">+ Add Custom System...</option>
                </select>
              )}
            </div>

            {/* Date & Hours */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-semibold">Service Date</label>
                <input
                  type="date"
                  required
                  value={editLogDate}
                  onChange={(e) => setEditLogDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-semibold">Engine Hours</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={editLogHours}
                  onChange={(e) => setEditLogHours(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
                />
              </div>
            </div>

            {/* Cost */}
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-semibold">Total Cost ($ optional)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={editLogCost}
                onChange={(e) => setEditLogCost(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>

            {/* Consumables & Parts Used */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2.5">
              <span className="text-xs font-bold text-teal-400 flex items-center gap-1.5">
                <FlaskConical className="w-3.5 h-3.5" />
                Consumables & Parts Used ({editLogPartsUsed.length})
              </span>

              {editLogPartsUsed.length === 0 ? (
                <div className="text-xs text-slate-500 italic py-0.5">
                  No parts or consumables recorded for this service.
                </div>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {editLogPartsUsed.map((p, idx) => {
                    const part = db.parts.find((item) => item.id === p.partId);
                    const isConsumable = part?.itemType === 'consumable';
                    const name = p.nameSnapshot || part?.name || p.partId;
                    const unit = p.unitSnapshot || part?.unit || (isConsumable ? 'oz' : 'each');

                    return (
                      <div
                        key={`${p.partId}-${idx}`}
                        className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate flex items-center gap-1">
                            {isConsumable ? (
                              <FlaskConical className="w-3 h-3 text-teal-400 shrink-0" />
                            ) : (
                              <Package className="w-3 h-3 text-sky-400 shrink-0" />
                            )}
                            <span className="truncate">{name}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={p.quantityNeeded}
                            onChange={(e) =>
                              handleUpdateEditLogPartQty(p.partId, parseFloat(e.target.value) || 0)
                            }
                            className="w-16 bg-slate-950 border border-teal-500 rounded px-2 py-1 text-xs text-white font-mono text-right"
                          />
                          <span className="text-xs text-slate-400 font-mono">{unit}</span>
                          <button
                            type="button"
                            onClick={() => handleRemovePartFromEditLog(p.partId)}
                            className="text-slate-500 hover:text-rose-400 p-0.5 ml-1"
                            title="Remove part"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add part dropdown */}
              <div className="pt-1 flex items-center gap-1.5 w-full min-w-0">
                <select
                  value={editLogExtraPartId}
                  onChange={(e) => setEditLogExtraPartId(e.target.value)}
                  className="flex-1 min-w-0 truncate bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="">+ Add part or consumable...</option>
                  {db.parts
                    .filter((p) => !editLogPartsUsed.some((lp) => lp.partId === p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.itemType === 'consumable' ? '💧 ' : '🔧 '}
                        {p.name}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddExtraPartToEditLog}
                  disabled={!editLogExtraPartId}
                  className="shrink-0 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-semibold text-white rounded transition"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-semibold">
                Logbook Notes / Observations
              </label>
              <textarea
                rows={3}
                value={editLogNotes}
                onChange={(e) => setEditLogNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>

            {/* Photos (Disabled in Demo Mode) */}
            {!IS_DEMO_MODE ? (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5" />
                    Service Photos ({editLogPhotos.length})
                  </span>
                  <label className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition">
                    <Camera className="w-3 h-3" />
                    <span>{isProcessingPhoto ? 'Compressing...' : '+ Upload / Snap'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={isProcessingPhoto}
                      className="hidden"
                      onChange={(e) => {
                        void processSelectedPhotoFiles(e.target.files, (added) => {
                          setEditLogPhotos((prev) => [...prev, ...added]);
                        });
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>

                {editLogPhotos.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {editLogPhotos.map((photo) => (
                      <div
                        key={photo.id}
                        className="flex items-center gap-2.5 bg-slate-900 border border-slate-800 rounded-lg p-2"
                      >
                        <img
                          src={photo.dataUrl}
                          alt={photo.caption || 'Service photo'}
                          className="w-12 h-12 rounded object-cover shrink-0 border border-slate-700"
                        />
                        <input
                          type="text"
                          placeholder="Add caption..."
                          value={photo.caption || ''}
                          onChange={(e) =>
                            setEditLogPhotos((prev) =>
                              prev.map((p) =>
                                p.id === photo.id ? { ...p, caption: e.target.value } : p
                              )
                            )
                          }
                          className="flex-1 bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setEditLogPhotos((prev) => prev.filter((p) => p.id !== photo.id))
                          }
                          className="text-slate-500 hover:text-rose-400 p-1 shrink-0"
                          title="Remove photo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingLog(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 transition shadow"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Create or Edit Maintenance Task with Multi-Consumable Linking */}
      {showNewScheduleModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveSchedule}
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-3.5 shadow-2xl my-auto"
          >
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Wrench className="w-5 h-5 text-sky-400" />
              {editingSchedule ? 'Edit Maintenance Task' : 'New Maintenance Task'}
            </h3>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Task Title</label>
              <input
                type="text"
                required
                placeholder="e.g., Refill Freshwater Tank & Add Water Freshener"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-400">System Category</label>
                {!isAddingCustomCategory ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingCustomCategory(true);
                      setCustomCategoryInput('');
                    }}
                    className="text-[11px] text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ New Category</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingCustomCategory(false);
                      setCustomCategoryInput('');
                    }}
                    className="text-[11px] text-slate-400 hover:text-slate-200"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {isAddingCustomCategory ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="e.g., Electronics & Nav, HVAC, Tender..."
                    value={customCategoryInput}
                    onChange={(e) => setCustomCategoryInput(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = customCategoryInput.trim();
                      if (trimmed) {
                        setNewCategory(trimmed);
                        if (!db.customCategories?.includes(trimmed)) {
                          onUpdateDb((prev) => ({
                            ...prev,
                            customCategories: [...(prev.customCategories || []), trimmed],
                          }));
                        }
                        setIsAddingCustomCategory(false);
                        setCustomCategoryInput('');
                      }
                    }}
                    disabled={!customCategoryInput.trim()}
                    className="px-3 py-2 bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-lg transition"
                  >
                    Add
                  </button>
                </div>
              ) : (
                <select
                  value={newCategory}
                  onChange={(e) => {
                    if (e.target.value === '__add_custom__') {
                      setIsAddingCustomCategory(true);
                      setCustomCategoryInput('');
                    } else {
                      setNewCategory(e.target.value as SystemCategory);
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                >
                  <optgroup label="Standard Systems">
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </optgroup>
                  {customCategoryNames.length > 0 && (
                    <optgroup label="Custom Vessel Categories">
                      {customCategoryNames.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <option value="__add_custom__">+ Add Custom Category...</option>
                </select>
              )}
            </div>

            {/* Interval Mode: Fixed Interval vs As-Needed (N/A) */}
            <div className="space-y-1.5">
              <label className="block text-xs text-slate-400">Maintenance Interval Type</label>
              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setNewIntervalMode('scheduled')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition ${
                    newIntervalMode === 'scheduled'
                      ? 'bg-sky-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Fixed Interval
                </button>
                <button
                  type="button"
                  onClick={() => setNewIntervalMode('as-needed')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition ${
                    newIntervalMode === 'as-needed'
                      ? 'bg-teal-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  As-Needed / N/A
                </button>
              </div>
            </div>

            {/* Intervals: Engine Hours and Calendar Days (shown only if scheduled) */}
            {newIntervalMode === 'scheduled' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Interval (Engine Hours)
                    <span className="text-[10px] text-slate-500 block">e.g., 100 or 250</span>
                  </label>
                  <input
                    type="number"
                    placeholder="e.g., 100"
                    value={newIntervalHours}
                    onChange={(e) => setNewIntervalHours(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Interval (Days)
                    <span className="text-[10px] text-slate-500 block">e.g., 180 or 365</span>
                  </label>
                  <input
                    type="number"
                    placeholder="e.g., 365"
                    value={newIntervalDays}
                    onChange={(e) => setNewIntervalDays(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>
            ) : (
              <div className="bg-slate-950 border border-teal-500/30 rounded-xl p-2.5 text-xs text-teal-300 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-teal-400 shrink-0" />
                <span>
                  Interval set to <strong>N/A (As-Needed)</strong>. No countdown timers will be set; task will be ready to log whenever performed.
                </span>
              </div>
            )}

            {/* Linked Consumables & Spare Parts */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
              <span className="text-xs font-bold text-teal-400 flex items-center gap-1.5">
                <FlaskConical className="w-3.5 h-3.5" />
                Linked Consumables & Spare Parts
              </span>

              {newLinkedItems.length > 0 && (
                <div className="space-y-1.5">
                  {newLinkedItems.map((item) => {
                    const part = db.parts.find((p) => p.id === item.partId);
                    const isConsumable = part?.itemType === 'consumable';
                    const unit = part?.unit || (isConsumable ? 'oz' : 'each');
                    return (
                      <div
                        key={item.partId}
                        className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs"
                      >
                        <span className="truncate text-slate-200">
                          {isConsumable ? '💧 ' : '🔧 '}
                          {part?.name || item.partId} (<strong>{item.quantityNeeded} {unit}</strong>)
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveLinkedItemFromNewSchedule(item.partId)}
                          className="text-slate-500 hover:text-rose-400 p-0.5 ml-2"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1 w-full min-w-0">
                <select
                  value={pickerPartId}
                  onChange={(e) => setPickerPartId(e.target.value)}
                  className="flex-1 min-w-0 truncate bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="">Select consumable or part...</option>
                  {db.parts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.itemType === 'consumable' ? '💧 ' : '🔧 '}
                      {p.name} ({p.unit || 'each'})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  placeholder="Qty"
                  value={pickerQty}
                  onChange={(e) => setPickerQty(e.target.value)}
                  className="w-16 shrink-0 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white font-mono text-right"
                />
                <button
                  type="button"
                  onClick={handleAddLinkedItemToNewSchedule}
                  disabled={!pickerPartId}
                  className="shrink-0 bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white text-xs px-3 py-1.5 rounded font-bold transition"
                >
                  Link
                </button>
              </div>
            </div>

            {/* Baseline interval reference (applicable to recurring scheduled tasks) */}
            {newIntervalMode === 'scheduled' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Last Done @ Hours</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newLastHours}
                    onChange={(e) => setNewLastHours(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Last Done Date</label>
                  <input
                    type="date"
                    value={newLastDate}
                    onChange={(e) => setNewLastDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs text-slate-400 mb-1">Dosage / Wrench / Specs</label>
              <input
                type="text"
                placeholder="e.g., Add 2 oz freshener per 40 gal tank • Deck fill key"
                value={newSpecNotes}
                onChange={(e) => setNewSpecNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Procedure Notes</label>
              <textarea
                rows={2}
                placeholder="Step-by-step reminders..."
                value={newProcNotes}
                onChange={(e) => setNewProcNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>

            {/* Linked Equipment Manual (PDF) & Page Reference */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-indigo-950/20 border border-indigo-500/30 rounded-xl p-2.5">
              <div className="sm:col-span-2">
                <label className="block text-xs text-indigo-300 font-semibold mb-1 flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                  Linked Manual (PDF)
                </label>
                <select
                  value={newManualId}
                  onChange={(e) => setNewManualId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                >
                  <option value="">None</option>
                  {(db.manuals || []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-indigo-300 font-semibold mb-1">
                  Page / Section Ref
                </label>
                <input
                  type="text"
                  placeholder="e.g., p. 28"
                  value={newManualPage}
                  onChange={(e) => setNewManualPage(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white font-mono"
                />
              </div>
            </div>

            {/* Reference Photos & Diagrams Section */}
            {!IS_DEMO_MODE ? (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5" />
                    Reference Photos & Diagrams ({newTaskPhotos.length})
                  </span>
                  <label className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition">
                    <Camera className="w-3 h-3" />
                    <span>{isProcessingPhoto ? 'Compressing...' : '+ Add Photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={isProcessingPhoto}
                      className="hidden"
                      onChange={(e) => {
                        void processSelectedPhotoFiles(e.target.files, (added) => {
                          setNewTaskPhotos((prev) => [...prev, ...added]);
                        });
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>

                {newTaskPhotos.length === 0 ? (
                  <div className="text-[11px] text-slate-500 italic">
                    Optional: Attach photos of drain plugs, belt routing, filter locations, or manual diagrams.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {newTaskPhotos.map((photo) => (
                      <div
                        key={photo.id}
                        className="flex items-center gap-2.5 bg-slate-900 border border-slate-800 rounded-lg p-2"
                      >
                        <img
                          src={photo.dataUrl}
                          alt={photo.caption || 'Task reference photo'}
                          className="w-12 h-12 rounded object-cover shrink-0 border border-slate-700"
                        />
                        <input
                          type="text"
                          placeholder="Caption (e.g., 17mm drain plug location)..."
                          value={photo.caption || ''}
                          onChange={(e) =>
                            setNewTaskPhotos((prev) =>
                              prev.map((p) =>
                                p.id === photo.id ? { ...p, caption: e.target.value } : p
                              )
                            )
                          }
                          className="flex-1 bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setNewTaskPhotos((prev) => prev.filter((p) => p.id !== photo.id))
                          }
                          className="text-slate-500 hover:text-rose-400 p-1 shrink-0"
                          title="Remove photo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowNewScheduleModal(false);
                  setEditingSchedule(null);
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950"
              >
                {editingSchedule ? 'Save Changes' : 'Create Task'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Window: Equipment Manuals & PDFs Locker */}
      {showManualsModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-4 overflow-y-auto pt-[max(1rem,env(safe-area-inset-top,0px))]"
          onClick={handleCloseManuals}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-800 bg-slate-950/60 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center shrink-0">
                  <BookOpen className="w-4 h-4 text-indigo-300" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-white truncate">
                    Equipment Manuals & PDFs
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate">
                    Browse offline PDFs, page indexes, or upload new manuals
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseManuals}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 p-1.5 rounded-lg transition shrink-0"
                title="Close Manuals Window"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Filter inside Modal */}
            <div className="px-4 pt-3 pb-2 border-b border-slate-800/80 shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search manuals by title, engine/model, or page index (e.g., Impeller)..."
                  value={manualsSearchQuery}
                  onChange={(e) => setManualsSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Scrollable Manuals Content */}
            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              <ManualsLibrarySection
                db={db}
                onUpdateDb={onUpdateDb}
                filteredManuals={(db.manuals || []).filter((manual) => {
                  if (selectedSystems.length > 0) {
                    const matchesAny = systemTabs.some(
                      (tab) => selectedSystems.includes(tab.id) && tab.matches(manual.category)
                    );
                    if (!matchesAny) return false;
                  }
                  if (!manualsSearchQuery.trim()) return true;
                  const q = manualsSearchQuery.toLowerCase();
                  return (
                    manual.title.toLowerCase().includes(q) ||
                    manual.equipmentModel.toLowerCase().includes(q) ||
                    manual.category.toLowerCase().includes(q) ||
                    (manual.fileName && manual.fileName.toLowerCase().includes(q)) ||
                    (manual.pageHints && manual.pageHints.toLowerCase().includes(q)) ||
                    (manual.notes && manual.notes.toLowerCase().includes(q))
                  );
                })}
                customCategoryNames={customCategoryNames}
                defaultCategory={activeSystemTab.defaultCategory}
                onJumpToPart={(partId) => {
                  setShowManualsModal(false);
                  onJumpToPart(partId);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Photo Lightbox Viewer with Zoom & Download */}
      {lightboxPhoto && (
        <PhotoLightboxModal
          imageUrl={lightboxPhoto.photo.dataUrl}
          title={lightboxPhoto.contextTitle}
          caption={lightboxPhoto.photo.caption}
          dateAdded={lightboxPhoto.photo.addedAt}
          onClose={() => setLightboxPhoto(null)}
          onDelete={lightboxPhoto.onDelete}
        />
      )}
    </div>
  );
};
