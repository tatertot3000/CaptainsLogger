import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  AlertCircle,
  Anchor,
  BookOpen,
  Calendar,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Cog,
  DollarSign,
  Droplet,
  Droplets,
  ExternalLink,
  FlaskConical,
  Fuel,
  Layers,
  LifeBuoy,
  MapPin,
  Minus,
  Package,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  Tag,
  Trash2,
  Waves,
  X,
  Zap,
} from 'lucide-react';
import {
  CaptainsDatabase,
  ConsumableContainer,
  InventoryItemType,
  MaintenancePhoto,
  PartItem,
  SystemCategory,
} from '../types';
import { getConsumableTotals, getVendorSearchLinks } from '../utils/vendors';
import { ManualsLibrarySection } from './ManualsLibrarySection';
import { PhotoLightboxModal } from './PhotoLightboxModal';
import { findMatchingManual, openOrShareManualPdf } from '../db/pdfStorage';

interface PartsCatalogViewProps {
  db: CaptainsDatabase;
  onUpdateDb: (updater: (prev: CaptainsDatabase) => CaptainsDatabase) => void;
  highlightedPartId?: string | null;
  onClearHighlight?: () => void;
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

export const PartsCatalogView: React.FC<PartsCatalogViewProps> = ({
  db,
  onUpdateDb,
  highlightedPartId,
  onClearHighlight,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSystems, setSelectedSystems] = useState<string[]>([]);
  const [selectedItemTypes, setSelectedItemTypes] = useState<string[]>([]);
  const [filterLowStockOnly, setFilterLowStockOnly] = useState(false);
  const [catalogSubView, setCatalogSubView] = useState<'parts' | 'manuals'>('parts');
  const [selectedQueryByPart, setSelectedQueryByPart] = useState<Record<string, string>>({});
  const [showAddPartModal, setShowAddPartModal] = useState(false);
  const [editingPart, setEditingPart] = useState<PartItem | null>(null);

  // Add / Edit part form state
  const [itemType, setItemType] = useState<InventoryItemType>('part');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<SystemCategory>('Engine');
  const [equipmentModel, setEquipmentModel] = useState(db.vessel.engineMakeModel);
  const [oemPartNumber, setOemPartNumber] = useState('');
  const [crossRefsRaw, setCrossRefsRaw] = useState('');
  const [qtyOnBoard, setQtyOnBoard] = useState('1');
  const [minQty, setMinQty] = useState('1');
  const [trackQuantity, setTrackQuantity] = useState(true);
  const [unit, setUnit] = useState('each');
  const [containerSize, setContainerSize] = useState('16');
  const [dosageHint, setDosageHint] = useState('');
  const [datePurchased, setDatePurchased] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [lastPrice, setLastPrice] = useState('');
  const [vendorUrl, setVendorUrl] = useState('');
  const [locationOnBoat, setLocationOnBoat] = useState('');
  const [notes, setNotes] = useState('');
  const [manualId, setManualId] = useState('');
  const [manualPage, setManualPage] = useState('');
  const [editingDatePartId, setEditingDatePartId] = useState<string | null>(null);
  const [editingContainerData, setEditingContainerData] = useState<{
    partId: string;
    partName: string;
    unit: string;
    container: ConsumableContainer;
  } | null>(null);
  const [modalContainers, setModalContainers] = useState<ConsumableContainer[]>([]);
  const [isAddingCustomCategory, setIsAddingCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [lightboxPhoto, setLightboxPhoto] = useState<MaintenancePhoto | null>(null);

  const modalTotalQty = useMemo(() => {
    return Number(
      modalContainers.reduce((sum, c) => sum + (c.quantityRemaining || 0), 0).toFixed(2)
    );
  }, [modalContainers]);

  // Dynamically resolve custom categories from db and existing items
  const customCategoryNames = useMemo(() => {
    const set = new Set<string>(db.customCategories || []);
    for (const p of db.parts) {
      if (p.category && !BASE_SYSTEM_TABS.some((t) => t.id !== 'all' && t.matches(p.category))) {
        set.add(p.category);
      }
    }
    for (const s of db.schedules) {
      if (s.category && !BASE_SYSTEM_TABS.some((t) => t.id !== 'all' && t.matches(s.category))) {
        set.add(s.category);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [db.customCategories, db.parts, db.schedules]);

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

  // Inline "Add New Container / Bottle" state per consumable card
  const [addingContainerForPartId, setAddingContainerForPartId] = useState<string | null>(null);
  const [newContDate, setNewContDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newContSize, setNewContSize] = useState('16');
  const [newContQty, setNewContQty] = useState('16');

  // Collapsible card state (cards start minimized by default and expand when title is clicked)
  const [expandedPartIds, setExpandedPartIds] = useState<Record<string, boolean>>({});

  // Dropdown pull-down open states
  const [isSystemDropdownOpen, setIsSystemDropdownOpen] = useState(false);
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);

  const systemDropdownRef = useRef<HTMLDivElement>(null);
  const typeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        systemDropdownRef.current &&
        !systemDropdownRef.current.contains(event.target as Node)
      ) {
        setIsSystemDropdownOpen(false);
      }
      if (
        typeDropdownRef.current &&
        !typeDropdownRef.current.contains(event.target as Node)
      ) {
        setIsTypeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const togglePartExpanded = (id: string) => {
    setExpandedPartIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const openAddPartModal = (defaultCat?: SystemCategory) => {
    setEditingPart(null);
    setItemType('part');
    setName('');
    if (defaultCat) {
      setCategory(defaultCat);
    } else if (activeSystemTab.defaultCategory) {
      setCategory(activeSystemTab.defaultCategory);
    } else {
      setCategory('Engine');
    }
    setEquipmentModel(db.vessel.engineMakeModel);
    setOemPartNumber('');
    setCrossRefsRaw('');
    setQtyOnBoard('1');
    setMinQty('1');
    setTrackQuantity(true);
    setUnit('each');
    setContainerSize('16');
    setDosageHint('');
    setDatePurchased(new Date().toISOString().slice(0, 10));
    setLastPrice('');
    setVendorUrl('');
    setLocationOnBoat('');
    setNotes('');
    setManualId('');
    setManualPage('');
    setIsAddingCustomCategory(false);
    setCustomCategoryInput('');
    setModalContainers([
      {
        id: `cont-${Date.now()}-1`,
        datePurchased: new Date().toISOString().slice(0, 10),
        containerSize: 16,
        quantityRemaining: 16,
        pricePaid: undefined,
      },
    ]);
    setShowAddPartModal(true);
  };

  const openEditPartModal = (part: PartItem) => {
    setEditingPart(part);
    setItemType(part.itemType || 'part');
    setName(part.name);
    setCategory(part.category);
    setEquipmentModel(part.equipmentModel || db.vessel.engineMakeModel);
    setOemPartNumber(part.oemPartNumber);
    setCrossRefsRaw(part.crossRefNumbers?.join(', ') || '');
    setQtyOnBoard(String(part.quantityOnBoard));
    setMinQty(String(part.minQuantity));
    setTrackQuantity(part.trackQuantity !== false);
    setUnit(part.unit || (part.itemType === 'consumable' ? 'oz' : 'each'));
    setContainerSize(String(part.containerSize || 16));
    setDosageHint(part.dosageHint || '');
    setDatePurchased(part.datePurchased || new Date().toISOString().slice(0, 10));
    setLastPrice(part.lastPricePaid !== undefined ? String(part.lastPricePaid) : '');
    setVendorUrl(part.preferredVendorUrl || '');
    setLocationOnBoat(part.locationOnBoat || '');
    setNotes(part.notes || '');
    setManualId(part.manualId || '');
    setManualPage(part.manualPage || '');
    setIsAddingCustomCategory(false);
    setCustomCategoryInput('');

    const existingContainers =
      part.containers && part.containers.length > 0
        ? part.containers.map((c) => ({ ...c }))
        : [
            {
              id: `cont-${part.id}-1`,
              datePurchased: part.datePurchased || new Date().toISOString().slice(0, 10),
              containerSize: part.containerSize || 16,
              quantityRemaining: Math.min(part.containerSize || 16, part.quantityOnBoard || 0),
              pricePaid: part.lastPricePaid,
            },
          ];
    setModalContainers(existingContainers);
    setShowAddPartModal(true);
  };

  const handleAddModalContainer = () => {
    const defaultSize = Math.max(0.1, parseFloat(containerSize) || 16);
    const today = new Date().toISOString().slice(0, 10);
    setModalContainers((prev) => [
      ...prev,
      {
        id: `cont-${Date.now()}-${prev.length + 1}`,
        datePurchased: today,
        containerSize: defaultSize,
        quantityRemaining: defaultSize,
        pricePaid: parseFloat(lastPrice) > 0 ? parseFloat(lastPrice) : undefined,
      },
    ]);
  };

  const handleUpdateModalContainer = (
    index: number,
    patch: Partial<ConsumableContainer>
  ) => {
    setModalContainers((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], ...patch };
      }
      return next;
    });
  };

  const handleRemoveModalContainer = (index: number) => {
    setModalContainers((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveContainerDetails = (
    partId: string,
    updatedContainer: ConsumableContainer
  ) => {
    onUpdateDb((prev) => ({
      ...prev,
      parts: prev.parts.map((p) => {
        if (p.id !== partId || !p.containers) return p;
        const safeSize = Math.max(0.1, updatedContainer.containerSize || 16);
        const safeQty = Math.min(
          safeSize,
          Math.max(0, updatedContainer.quantityRemaining || 0)
        );
        const updatedContainers = p.containers.map((c) =>
          c.id === updatedContainer.id
            ? {
                ...updatedContainer,
                containerSize: safeSize,
                quantityRemaining: safeQty,
              }
            : c
        );
        const totalOnBoard = Number(
          updatedContainers.reduce((sum, c) => sum + c.quantityRemaining, 0).toFixed(2)
        );
        return {
          ...p,
          containers: updatedContainers,
          quantityOnBoard: totalOnBoard,
        };
      }),
    }));
    setEditingContainerData(null);
  };

  const adjustQuantity = (partId: string, delta: number) => {
    onUpdateDb((prev) => ({
      ...prev,
      parts: prev.parts.map((p) => {
        if (p.id !== partId) return p;
        const next = Math.max(0, Number((p.quantityOnBoard + delta).toFixed(2)));
        return { ...p, quantityOnBoard: next };
      }),
    }));
  };

  const adjustContainerQuantity = (partId: string, containerId: string, delta: number) => {
    onUpdateDb((prev) => ({
      ...prev,
      parts: prev.parts.map((p) => {
        if (p.id !== partId || !p.containers) return p;
        const updatedContainers = p.containers.map((c) => {
          if (c.id !== containerId) return c;
          const maxBottleCapacity = Math.max(0.1, c.containerSize || p.containerSize || 16);
          // Never allow fluid to exceed the registered container/bottle size
          const nextRem = Math.min(
            maxBottleCapacity,
            Math.max(0, Number((c.quantityRemaining + delta).toFixed(2)))
          );
          return {
            ...c,
            containerSize: maxBottleCapacity,
            quantityRemaining: nextRem,
          };
        });
        const totalOnBoard = Number(
          updatedContainers.reduce((sum, c) => sum + c.quantityRemaining, 0).toFixed(2)
        );
        return {
          ...p,
          containers: updatedContainers,
          quantityOnBoard: totalOnBoard,
        };
      }),
    }));
  };

  const handleDeleteContainer = (partId: string, containerId: string) => {
    onUpdateDb((prev) => ({
      ...prev,
      parts: prev.parts.map((p) => {
        if (p.id !== partId || !p.containers) return p;
        const updatedContainers = p.containers.filter((c) => c.id !== containerId);
        const totalOnBoard = Number(
          updatedContainers.reduce((sum, c) => sum + c.quantityRemaining, 0).toFixed(2)
        );
        return {
          ...p,
          containers: updatedContainers,
          quantityOnBoard: totalOnBoard,
        };
      }),
    }));
  };

  const openAddContainerForm = (part: PartItem) => {
    const defaultSize = part.containerSize || 16;
    setExpandedPartIds((prev) => ({ ...prev, [part.id]: true }));
    setAddingContainerForPartId(part.id);
    setNewContDate(new Date().toISOString().slice(0, 10));
    setNewContSize(String(defaultSize));
    setNewContQty(String(defaultSize));
  };

  const handleConfirmAddContainer = (partId: string) => {
    const sizeNum = Math.max(0.1, parseFloat(newContSize) || 16);
    const rawQty = parseFloat(newContQty);
    const qtyNum = Math.min(sizeNum, Math.max(0, isNaN(rawQty) ? sizeNum : rawQty));
    const dateStr = newContDate || new Date().toISOString().slice(0, 10);

    const newContainer: ConsumableContainer = {
      id: `cont-${Date.now()}`,
      datePurchased: dateStr,
      containerSize: sizeNum,
      quantityRemaining: qtyNum,
    };

    onUpdateDb((prev) => ({
      ...prev,
      parts: prev.parts.map((p) => {
        if (p.id !== partId) return p;
        const updatedContainers = [...(p.containers || []), newContainer];
        const totalOnBoard = Number(
          updatedContainers.reduce((sum, c) => sum + c.quantityRemaining, 0).toFixed(2)
        );
        return {
          ...p,
          containers: updatedContainers,
          quantityOnBoard: totalOnBoard,
          datePurchased: dateStr,
        };
      }),
    }));
    setAddingContainerForPartId(null);
  };

  const handleUpdatePurchaseDate = (partId: string, newDate: string) => {
    onUpdateDb((prev) => ({
      ...prev,
      parts: prev.parts.map((p) =>
        p.id === partId ? { ...p, datePurchased: newDate || undefined } : p
      ),
    }));
    setEditingDatePartId(null);
  };

  const handleSavePart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const parsedQty = parseFloat(qtyOnBoard);
    const parsedMin = parseFloat(minQty);
    const parsedContainer = parseFloat(containerSize);
    const validQty = Math.max(0, isNaN(parsedQty) ? 0 : parsedQty);
    const specifiedBottleSize =
      itemType === 'consumable'
        ? Math.max(0.1, parsedContainer > 0 ? parsedContainer : 16)
        : undefined;
    const purchaseDateStr = datePurchased || new Date().toISOString().slice(0, 10);
    const crossRefArray = crossRefsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const buildInitialContainers = (
      totalAmt: number,
      bSize: number,
      dateStr: string,
      price?: number
    ): ConsumableContainer[] => {
      const result: ConsumableContainer[] = [];
      let left = totalAmt;
      let cnt = 1;
      while (left > 0) {
        const fill = Math.min(bSize, Number(left.toFixed(2)));
        result.push({
          id: `cont-${Date.now()}-${cnt++}`,
          datePurchased: dateStr,
          containerSize: bSize,
          quantityRemaining: fill,
          pricePaid: price,
        });
        left = Number((left - fill).toFixed(2));
      }
      if (result.length === 0) {
        result.push({
          id: `cont-${Date.now()}-1`,
          datePurchased: dateStr,
          containerSize: bSize,
          quantityRemaining: 0,
          pricePaid: price,
        });
      }
      return result;
    };

    if (editingPart) {
      onUpdateDb((prev) => ({
        ...prev,
        parts: prev.parts.map((p) => {
          if (p.id !== editingPart.id) return p;

          let updatedContainers = p.containers;
          let newTotalQty = validQty;
          let finalPurchaseDate = purchaseDateStr;
          let finalLastPrice = parseFloat(lastPrice) > 0 ? parseFloat(lastPrice) : undefined;

          if (itemType === 'consumable') {
            const safeContainers: ConsumableContainer[] = modalContainers.map((mc, idx) => {
              const bSize = Math.max(0.1, mc.containerSize || specifiedBottleSize || 16);
              const qRem = Math.min(bSize, Math.max(0, mc.quantityRemaining || 0));
              return {
                id: mc.id || `cont-${editingPart.id}-${idx + 1}`,
                datePurchased: mc.datePurchased || purchaseDateStr,
                containerSize: bSize,
                quantityRemaining: qRem,
                pricePaid: mc.pricePaid,
              };
            });

            updatedContainers =
              safeContainers.length > 0
                ? safeContainers
                : buildInitialContainers(
                    validQty,
                    specifiedBottleSize || 16,
                    purchaseDateStr,
                    finalLastPrice
                  );

            newTotalQty = Number(
              updatedContainers.reduce((sum, c) => sum + c.quantityRemaining, 0).toFixed(2)
            );

            if (updatedContainers.length > 0) {
              const latestCont = updatedContainers[updatedContainers.length - 1];
              if (latestCont.datePurchased) finalPurchaseDate = latestCont.datePurchased;
              if (latestCont.pricePaid !== undefined) finalLastPrice = latestCont.pricePaid;
            }
          } else {
            updatedContainers = undefined;
          }

          return {
            ...p,
            name: name.trim(),
            itemType,
            unit: itemType === 'consumable' ? unit.trim() || 'oz' : unit.trim() || 'each',
            containerSize: specifiedBottleSize,
            containers: updatedContainers,
            dosageHint:
              itemType === 'consumable' && dosageHint.trim() ? dosageHint.trim() : undefined,
            category,
            equipmentModel: equipmentModel.trim() || db.vessel.engineMakeModel,
            oemPartNumber:
              oemPartNumber.trim() ||
              (itemType === 'consumable'
                ? name.trim().toUpperCase().replace(/\s+/g, '-')
                : 'N/A'),
            crossRefNumbers: crossRefArray,
            trackQuantity: trackQuantity,
            quantityOnBoard: newTotalQty,
            minQuantity: Math.max(0, isNaN(parsedMin) ? 1 : parsedMin),
            datePurchased: finalPurchaseDate,
            lastPricePaid: finalLastPrice,
            preferredVendorUrl: vendorUrl.trim() || undefined,
            locationOnBoat: locationOnBoat.trim() || undefined,
            notes: notes.trim() || undefined,
            manualId: manualId || undefined,
            manualPage: manualPage.trim() || undefined,
          };
        }),
        customCategories:
          !CATEGORIES.includes(category) && !prev.customCategories?.includes(category)
            ? [...(prev.customCategories || []), category]
            : prev.customCategories,
      }));
    } else {
      const newId = 'part-' + Date.now();
      let finalPurchaseDate = purchaseDateStr;
      let finalLastPrice = parseFloat(lastPrice) > 0 ? parseFloat(lastPrice) : undefined;
      let initialContainers: ConsumableContainer[] | undefined = undefined;
      let initialQty = validQty;

      if (itemType === 'consumable') {
        const safeContainers: ConsumableContainer[] = modalContainers.map((mc, idx) => {
          const bSize = Math.max(0.1, mc.containerSize || specifiedBottleSize || 16);
          const qRem = Math.min(bSize, Math.max(0, mc.quantityRemaining || 0));
          return {
            id: mc.id || `cont-${newId}-${idx + 1}`,
            datePurchased: mc.datePurchased || purchaseDateStr,
            containerSize: bSize,
            quantityRemaining: qRem,
            pricePaid: mc.pricePaid,
          };
        });

        initialContainers =
          safeContainers.length > 0
            ? safeContainers
            : buildInitialContainers(
                validQty,
                specifiedBottleSize || 16,
                purchaseDateStr,
                finalLastPrice
              );

        initialQty = Number(
          initialContainers.reduce((sum, c) => sum + c.quantityRemaining, 0).toFixed(2)
        );

        if (initialContainers.length > 0) {
          const latestCont = initialContainers[initialContainers.length - 1];
          if (latestCont.datePurchased) finalPurchaseDate = latestCont.datePurchased;
          if (latestCont.pricePaid !== undefined) finalLastPrice = latestCont.pricePaid;
        }
      }

      const newPart: PartItem = {
        id: newId,
        name: name.trim(),
        itemType,
        unit: itemType === 'consumable' ? unit.trim() || 'oz' : unit.trim() || 'each',
        containerSize: specifiedBottleSize,
        containers: initialContainers,
        dosageHint:
          itemType === 'consumable' && dosageHint.trim() ? dosageHint.trim() : undefined,
        category,
        equipmentModel:
          equipmentModel.trim() ||
          (itemType === 'consumable' ? 'Shipboard Consumables' : db.vessel.engineMakeModel),
        oemPartNumber:
          oemPartNumber.trim() ||
          (itemType === 'consumable'
            ? name.trim().toUpperCase().replace(/\s+/g, '-')
            : 'N/A'),
        crossRefNumbers: crossRefArray,
        trackQuantity: trackQuantity,
        quantityOnBoard: initialQty,
        minQuantity: Math.max(0, isNaN(parsedMin) ? 1 : parsedMin),
        datePurchased: finalPurchaseDate,
        lastPricePaid: finalLastPrice,
        preferredVendorUrl: vendorUrl.trim() || undefined,
        locationOnBoat: locationOnBoat.trim() || undefined,
        notes: notes.trim() || undefined,
        manualId: manualId || undefined,
        manualPage: manualPage.trim() || undefined,
      };

      onUpdateDb((prev) => ({
        ...prev,
        parts: [newPart, ...prev.parts],
        customCategories:
          !CATEGORIES.includes(category) && !prev.customCategories?.includes(category)
            ? [...(prev.customCategories || []), category]
            : prev.customCategories,
      }));
    }

    setIsAddingCustomCategory(false);
    setCustomCategoryInput('');
    setShowAddPartModal(false);
    setEditingPart(null);
  };

  const handleDeletePart = (id: string) => {
    onUpdateDb((prev) => ({
      ...prev,
      parts: prev.parts.filter((p) => p.id !== id),
    }));
  };

  const filteredParts = db.parts.filter((part) => {
    if (highlightedPartId && part.id === highlightedPartId) return true;

    // 1. Vessel System multi-filter
    if (selectedSystems.length > 0) {
      const matchesAnySystem = systemTabs.some(
        (tab) => selectedSystems.includes(tab.id) && tab.matches(part.category)
      );
      if (!matchesAnySystem) return false;
    }

    // 2. Item Type multi-filter
    if (selectedItemTypes.length > 0) {
      const pType = part.itemType || 'part';
      if (!selectedItemTypes.includes(pType)) return false;
    }

    if (filterLowStockOnly && (part.trackQuantity === false || part.quantityOnBoard > part.minQuantity)) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      part.name.toLowerCase().includes(q) ||
      part.oemPartNumber.toLowerCase().includes(q) ||
      part.equipmentModel.toLowerCase().includes(q) ||
      part.category.toLowerCase().includes(q) ||
      (part.datePurchased && part.datePurchased.toLowerCase().includes(q)) ||
      (part.containers &&
        part.containers.some((c) => c.datePurchased.toLowerCase().includes(q))) ||
      (part.dosageHint && part.dosageHint.toLowerCase().includes(q)) ||
      part.crossRefNumbers.some((cr) => cr.toLowerCase().includes(q))
    );
  });

  const lowStockCount = db.parts.filter(
    (p) => p.trackQuantity !== false && p.quantityOnBoard <= p.minQuantity
  ).length;
  const consumableCount = db.parts.filter((p) => p.itemType === 'consumable').length;
  const discretePartCount = db.parts.filter((p) => p.itemType !== 'consumable').length;

  const filteredManuals = (db.manuals || []).filter((manual) => {
    if (selectedSystems.length > 0) {
      const matchesAnySystem = systemTabs.some(
        (tab) => selectedSystems.includes(tab.id) && tab.matches(manual.category)
      );
      if (!matchesAnySystem) return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      manual.title.toLowerCase().includes(q) ||
      manual.equipmentModel.toLowerCase().includes(q) ||
      manual.category.toLowerCase().includes(q) ||
      (manual.fileName && manual.fileName.toLowerCase().includes(q)) ||
      (manual.pageHints && manual.pageHints.toLowerCase().includes(q)) ||
      (manual.notes && manual.notes.toLowerCase().includes(q))
    );
  });

  // Track total parts and consumables purchase costs across on-board inventory
  const inventoryCosts = useMemo(() => {
    let partsCost = 0;
    let consumablesCost = 0;
    let totalBottles = 0;
    let reorderEstimatedCost = 0;

    for (const p of db.parts) {
      const isConsumable = p.itemType === 'consumable';
      if (isConsumable) {
        if (p.containers && p.containers.length > 0) {
          totalBottles += p.containers.length;
          let contSum = 0;
          let hasPrice = false;
          for (const c of p.containers) {
            if (c.pricePaid !== undefined && c.pricePaid > 0) {
              contSum += c.pricePaid;
              hasPrice = true;
            }
          }
          if (hasPrice) {
            consumablesCost += contSum;
          } else if (p.lastPricePaid && p.lastPricePaid > 0) {
            consumablesCost += p.lastPricePaid * p.containers.length;
          }
        } else if (p.lastPricePaid && p.lastPricePaid > 0) {
          totalBottles += 1;
          consumablesCost += p.lastPricePaid;
        }

        if (p.trackQuantity !== false && p.quantityOnBoard <= p.minQuantity && p.lastPricePaid && p.lastPricePaid > 0) {
          reorderEstimatedCost += p.lastPricePaid;
        }
      } else {
        // Discrete parts
        if (p.lastPricePaid && p.lastPricePaid > 0) {
          const count = Math.max(1, p.quantityOnBoard);
          partsCost += p.lastPricePaid * count;
          if (p.trackQuantity !== false && p.quantityOnBoard <= p.minQuantity) {
            const needToBuy = Math.max(1, p.minQuantity - p.quantityOnBoard);
            reorderEstimatedCost += p.lastPricePaid * needToBuy;
          }
        }
      }
    }

    const totalCost = partsCost + consumablesCost;
    return {
      totalCost,
      partsCost,
      consumablesCost,
      totalBottles,
      reorderEstimatedCost,
    };
  }, [db.parts]);

  // Compute subtotal matching current active search/filter
  const filteredCost = useMemo(() => {
    let cost = 0;
    for (const p of filteredParts) {
      if (p.itemType === 'consumable') {
        if (p.containers && p.containers.length > 0) {
          let contSum = 0;
          let hasPrice = false;
          for (const c of p.containers) {
            if (c.pricePaid !== undefined && c.pricePaid > 0) {
              contSum += c.pricePaid;
              hasPrice = true;
            }
          }
          cost += hasPrice ? contSum : (p.lastPricePaid || 0) * p.containers.length;
        } else {
          cost += p.lastPricePaid || 0;
        }
      } else {
        cost += (p.lastPricePaid || 0) * Math.max(1, p.quantityOnBoard);
      }
    }
    return cost;
  }, [filteredParts]);

  return (
    <div className="space-y-4">
      {/* Total Purchase Costs & Inventory Investment Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold">Total Inventory Value</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-black font-mono text-emerald-400">
            ${inventoryCosts.totalCost.toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-500 mt-1">
            Across {db.parts.length} catalog items
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold">Spare Parts Costs</span>
            <Package className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-xl font-black font-mono text-sky-400">
            ${inventoryCosts.partsCost.toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-500 mt-1">
            {discretePartCount} discrete spares on board
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold">Consumables & Fluids</span>
            <FlaskConical className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-xl font-black font-mono text-teal-300">
            ${inventoryCosts.consumablesCost.toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-500 mt-1">
            {inventoryCosts.totalBottles} bottles & containers
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-semibold">
              {selectedSystems.length > 0 || searchQuery.trim() || selectedItemTypes.length > 0 || filterLowStockOnly
                ? 'Filtered Subtotal'
                : 'Need to Reorder'}
            </span>
            <ShoppingCart className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-black font-mono text-amber-300">
            {selectedSystems.length > 0 || searchQuery.trim() || selectedItemTypes.length > 0 || filterLowStockOnly
              ? `$${filteredCost.toFixed(2)}`
              : `$${inventoryCosts.reorderEstimatedCost.toFixed(2)}`}
          </div>
          <span className="text-[10px] text-slate-500 mt-1 truncate">
            {selectedSystems.length > 0 || searchQuery.trim() || selectedItemTypes.length > 0 || filterLowStockOnly
              ? `${filteredParts.length} matching item(s)`
              : `${lowStockCount} items below min threshold`}
          </span>
        </div>
      </div>

      {/* Search & Filter Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-3 relative z-20">
        {/* Segmented Sub-Tab Switcher: Spares & Consumables vs Manuals & PDFs */}
        <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setCatalogSubView('parts')}
            className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              catalogSubView === 'parts'
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Package className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Spares & Fluids ({filteredParts.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setCatalogSubView('manuals')}
            className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              catalogSubView === 'manuals'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Manuals & PDFs ({filteredManuals.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={
                catalogSubView === 'manuals'
                  ? 'Search manuals, engine model, page hint (e.g. Impeller)...'
                  : 'Search part name, consumable, OEM #, Sierra #, system...'
              }
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (onClearHighlight) onClearHighlight();
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          {catalogSubView === 'parts' && (
            <button
              onClick={() => openAddPartModal(activeSystemTab.defaultCategory)}
              className="flex items-center gap-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs px-3 py-2 rounded-lg transition shrink-0 shadow"
            >
              <Plus className="w-4 h-4" />
              Add Item
            </button>
          )}
        </div>

        {/* Dropdown Filters (Vessel System & Item Type) */}
        <div className="flex items-center justify-between flex-wrap gap-2.5 pt-1 border-t border-slate-800/80">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
            {/* 1. Vessel System Pull-down (Multi-Select) */}
            <div className="relative flex-1 sm:flex-initial" ref={systemDropdownRef}>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Vessel System
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsSystemDropdownOpen((prev) => !prev);
                  setIsTypeDropdownOpen(false);
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
                    {filteredParts.length}
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
                        onClick={() => {
                          setSelectedSystems([]);
                          if (onClearHighlight) onClearHighlight();
                        }}
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
                    onClick={() => {
                      setSelectedSystems([]);
                      if (onClearHighlight) onClearHighlight();
                    }}
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
                      {db.parts.length}
                    </span>
                  </button>

                  {systemTabs
                    .filter((t) => t.id !== 'all')
                    .map((tab) => {
                      const Icon = tab.icon;
                      const isSelected = selectedSystems.includes(tab.id);
                      const systemParts = db.parts.filter((p) => tab.matches(p.category));
                      const systemLowCount = systemParts.filter(
                        (p) => p.trackQuantity !== false && p.quantityOnBoard <= p.minQuantity
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
                            if (onClearHighlight) onClearHighlight();
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
                          <div className="flex items-center gap-1.5">
                            {systemLowCount > 0 && (
                              <span
                                title={`${systemLowCount} low stock`}
                                className="w-2 h-2 rounded-full bg-rose-500 shrink-0"
                              />
                            )}
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
                              {systemParts.length}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>

            {/* 2. Item Type Pull-down (Multi-Select) */}
            <div className="relative flex-1 sm:flex-initial" ref={typeDropdownRef}>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Item Category
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsTypeDropdownOpen((prev) => !prev);
                  setIsSystemDropdownOpen(false);
                }}
                className={`w-full sm:w-auto flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition shadow-sm sm:min-w-[190px] ${
                  selectedItemTypes.length > 0
                    ? 'bg-sky-500/20 text-sky-200 border-sky-400'
                    : 'bg-slate-950 text-slate-200 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Package className="w-4 h-4 text-sky-400 shrink-0" />
                  <span className="truncate">
                    {selectedItemTypes.length === 0
                      ? 'All Item Types'
                      : selectedItemTypes.length === 1
                      ? selectedItemTypes[0] === 'consumable'
                        ? 'Consumables & Fluids'
                        : 'Spare Parts'
                      : `${selectedItemTypes.length} Types Selected`}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
                    {filteredParts.length}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                      isTypeDropdownOpen ? 'rotate-180 text-sky-400' : ''
                    }`}
                  />
                </div>
              </button>

              {isTypeDropdownOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-60 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-50 space-y-0.5">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 mb-1 flex items-center justify-between">
                    <span>Select Item Type (Multi)</span>
                    {selectedItemTypes.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setSelectedItemTypes([])}
                        className="text-[10px] text-sky-400 hover:underline"
                      >
                        Select All
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-500">All Active</span>
                    )}
                  </div>

                  {/* "All Items" row */}
                  <button
                    type="button"
                    onClick={() => setSelectedItemTypes([])}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs transition text-left ${
                      selectedItemTypes.length === 0
                        ? 'bg-sky-500/20 text-sky-100 font-bold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className={`w-4 h-4 rounded flex items-center justify-center border transition ${
                          selectedItemTypes.length === 0
                            ? 'bg-sky-500 border-sky-400 text-slate-950'
                            : 'border-slate-700 bg-slate-950'
                        }`}
                      >
                        {selectedItemTypes.length === 0 && <Check className="w-3 h-3 stroke-[3]" />}
                      </span>
                      <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">All Item Types</span>
                    </div>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
                      {db.parts.length}
                    </span>
                  </button>

                  {[
                    {
                      id: 'consumable',
                      label: 'Consumables & Fluids',
                      icon: FlaskConical,
                      color: 'text-teal-400',
                      count: consumableCount,
                    },
                    {
                      id: 'part',
                      label: 'Spare Parts',
                      icon: Package,
                      color: 'text-sky-400',
                      count: discretePartCount,
                    },
                  ].map((opt) => {
                    const Icon = opt.icon;
                    const isSelected = selectedItemTypes.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setSelectedItemTypes((prev) =>
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

          {/* Low Stock Toggle Button */}
          <div className="pt-3 sm:pt-0">
            <button
              onClick={() => setFilterLowStockOnly((v) => !v)}
              className={`text-xs px-3.5 py-2 rounded-xl border font-semibold flex items-center gap-1.5 transition ${
                filterLowStockOnly
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-sm'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>Low Stock / Reorder</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  lowStockCount > 0
                    ? 'bg-rose-500/30 text-rose-200'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {lowStockCount}
              </span>
            </button>
          </div>
        </div>

        {highlightedPartId && (
          <div className="flex items-center justify-between bg-sky-950/40 border border-sky-500/30 rounded-lg px-3 py-1.5 text-xs">
            <span className="text-sky-300">Showing highlighted item linked to task</span>
            <button onClick={onClearHighlight} className="text-sky-400 underline font-semibold">
              Clear highlight
            </button>
          </div>
        )}
      </div>

      {catalogSubView === 'manuals' ? (
        <ManualsLibrarySection
          db={db}
          onUpdateDb={onUpdateDb}
          filteredManuals={filteredManuals}
          customCategoryNames={customCategoryNames}
          defaultCategory={activeSystemTab.defaultCategory}
          onJumpToPart={(partId) => {
            setCatalogSubView('parts');
            setExpandedPartIds((prev) => ({ ...prev, [partId]: true }));
          }}
        />
      ) : (
        <>
          {/* Empty State if no items in selected system */}
          {filteredParts.length === 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center space-y-2">
              <div className="text-sm font-bold text-slate-200">
                No items found in {activeSystemTab.label}
              </div>
              <p className="text-xs text-slate-400">
                Add spare parts or tracked consumables to this system to monitor stock and prices.
              </p>
              <button
                onClick={() => openAddPartModal(activeSystemTab.defaultCategory)}
                className="inline-flex items-center gap-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs px-3.5 py-2 rounded-lg transition mt-1"
              >
                <Plus className="w-4 h-4" />
                Add Item to {activeSystemTab.label}
              </button>
            </div>
          )}

          {/* Parts & Consumables Cards */}
          <div className="space-y-3">
            {filteredParts.map((part) => {
              const isConsumable = part.itemType === 'consumable';
              const totals = getConsumableTotals(part);
              const effectiveQty = isConsumable ? totals.totalRemaining : part.quantityOnBoard;
              const isTracked = part.trackQuantity !== false;
              const isLow = isTracked && effectiveQty <= part.minQuantity;
              const isHighlighted = highlightedPartId === part.id;
              const activeSearchNumber = selectedQueryByPart[part.id] || part.oemPartNumber;
              const vendorLinks = getVendorSearchLinks(part, activeSearchNumber);
              const unitLabel = part.unit || (isConsumable ? 'oz' : 'each');
              const stepDelta =
                isConsumable && ['oz', 'liters', 'quarts', 'gal'].includes(unitLabel) ? 0.5 : 1;
              const linkedManual = findMatchingManual(db.manuals, part);

              // Sorted containers (oldest purchase date first)
              const sortedContainers = isConsumable
                ? [...(part.containers || [])].sort((a, b) =>
                    (a.datePurchased || '').localeCompare(b.datePurchased || '')
                  )
                : [];
              const isPartExpanded = Boolean(expandedPartIds[part.id]) || isHighlighted;

              return (
                <div
                  key={part.id}
                  className={`bg-slate-900 rounded-xl p-4 space-y-3 transition border ${
                    isHighlighted
                      ? 'border-sky-400 ring-2 ring-sky-500/30'
                      : isLow
                      ? 'border-rose-500/50'
                      : 'border-slate-800'
                  }`}
                >
                  {/* Top Row: Badges and Tags */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {!isTracked && (
                        <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded flex items-center gap-1 bg-slate-800 text-slate-400 border border-slate-700">
                          Untracked
                        </span>
                      )}
                      <span
                        className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded flex items-center gap-1 ${
                          isConsumable
                            ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {isConsumable ? (
                          <>
                            <FlaskConical className="w-3 h-3 text-teal-400" />
                            Consumable ({sortedContainers.length}{' '}
                            {sortedContainers.length === 1 ? 'container' : 'containers'})
                          </>
                        ) : (
                          <>
                            <Package className="w-3 h-3 text-sky-400" />
                            Spare Part
                          </>
                        )}
                      </span>
                      <span className="text-[11px] font-medium uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {part.category}
                      </span>

                      {/* For discrete parts, show Date Purchased tag in header (consumables show per-container dates below) */}
                      {!isConsumable &&
                        (editingDatePartId === part.id ? (
                          <input
                            type="date"
                            autoFocus
                            defaultValue={
                              part.datePurchased || new Date().toISOString().slice(0, 10)
                            }
                            onBlur={(e) => handleUpdatePurchaseDate(part.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleUpdatePurchaseDate(
                                  part.id,
                                  (e.target as HTMLInputElement).value
                                );
                              }
                            }}
                            className="bg-slate-950 border border-amber-500 rounded px-2 py-0.5 text-[11px] font-mono text-amber-200"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingDatePartId(part.id)}
                            title="Date Purchased tag (Tap to update purchase date)"
                            className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:border-amber-400 flex items-center gap-1 transition"
                          >
                            <Calendar className="w-3 h-3 text-amber-400" />
                            <span>Purchased: {part.datePurchased || 'Set Date'}</span>
                          </button>
                        ))}

                      <span className="text-xs text-sky-400 font-medium">
                        {part.equipmentModel}
                      </span>

                      {linkedManual && (
                        <button
                          type="button"
                          onClick={() => openOrShareManualPdf(linkedManual, part.manualPage)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-500/40 hover:bg-indigo-500/30 transition cursor-pointer"
                          title={`Open ${linkedManual.title}${
                            part.manualPage ? ` (${part.manualPage})` : ''
                          }`}
                        >
                          <BookOpen className="w-3 h-3 text-indigo-300" />
                          <span>
                            Manual PDF{part.manualPage ? ` (${part.manualPage})` : ''}
                          </span>
                        </button>
                      )}

                      {part.photos && part.photos.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setLightboxPhoto(part.photos![0])}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition cursor-pointer"
                          title="Click to view part photo"
                        >
                          <Camera className="w-3 h-3 text-emerald-400" />
                          <span>
                            {part.photos.length} {part.photos.length === 1 ? 'Photo' : 'Photos'}
                          </span>
                        </button>
                      )}
                    </div>

                {/* Dedicated Full-Width Title Row: 100% width with NO widgets on the right */}
                <button
                  type="button"
                  onClick={() => togglePartExpanded(part.id)}
                  className="text-left group cursor-pointer block w-full pt-0.5"
                  title={isPartExpanded ? 'Click to collapse item details' : 'Click to expand item details'}
                >
                  <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-sky-300 transition leading-snug flex items-start gap-1.5 w-full">
                    {isPartExpanded ? (
                      <ChevronDown className="w-4 h-4 text-sky-400 shrink-0 mt-1" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-sky-400 shrink-0 mt-1" />
                    )}
                    <span className="w-full break-words">{part.name}</span>
                  </h3>
                </button>

                {/* Sub-row: Summary Badge & Quantity Controls placed below the full-width title */}
                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="flex-1 min-w-0">
                    {isPartExpanded && part.dosageHint && (
                      <div className="text-xs text-teal-300/90 font-medium flex items-center gap-1.5 pl-5">
                        <span className="text-teal-400 font-bold">Usage / Dosage:</span>
                        <span>{part.dosageHint}</span>
                      </div>
                    )}
                  </div>

                  {/* Summary / Counter Controls */}
                  {isConsumable ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1 text-right">
                        <div
                          className={`text-sm font-extrabold font-mono ${
                            !isTracked
                              ? 'text-slate-200'
                              : isLow
                              ? 'text-rose-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {totals.totalRemaining}{' '}
                          <span className="text-[10px] font-normal">{unitLabel} total</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {isTracked
                            ? `min ${part.minQuantity} ${unitLabel} • cap ${totals.totalCapacity} ${unitLabel}`
                            : `cap ${totals.totalCapacity} ${unitLabel} • Untracked`}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => openAddContainerForm(part)}
                        className="text-[11px] text-teal-300 hover:text-white font-semibold bg-teal-600/20 hover:bg-teal-600/40 border border-teal-500/40 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition shrink-0"
                      >
                        <Plus className="w-3 h-3" />
                        Add Bottle
                      </button>
                    </div>
                  ) : (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => adjustQuantity(part.id, -stepDelta)}
                        className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition"
                        title={`Deduct ${stepDelta} ${unitLabel}`}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      <div className="text-center min-w-[50px]">
                        <div
                          className={`text-sm font-extrabold font-mono ${
                            !isTracked
                              ? 'text-slate-200'
                              : isLow
                              ? 'text-rose-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {part.quantityOnBoard}{' '}
                          <span className="text-[10px] font-normal">{unitLabel}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {isTracked ? `min ${part.minQuantity} ${unitLabel}` : 'Untracked'}
                        </div>
                      </div>

                      <button
                        onClick={() => adjustQuantity(part.id, stepDelta)}
                        className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition"
                        title={`Add ${stepDelta} ${unitLabel}`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {isPartExpanded && (
                <>
              {/* Master Horizontal Level Indicator & Individual Containers Breakdown for Consumables */}
              {isConsumable && (
                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/90 space-y-2.5">
                  {/* Combined Sum Horizontal Level Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px] text-slate-300">
                      <span>
                        Combined Total Level ({sortedContainers.length}{' '}
                        {sortedContainers.length === 1 ? 'container' : 'containers'}):{' '}
                        <strong className="text-white font-mono">
                          {totals.totalRemaining} / {totals.totalCapacity} {unitLabel} (
                          {totals.fillPercent}%)
                        </strong>
                      </span>
                      {isLow && (
                        <span className="text-rose-400 font-bold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Low Stock — Time to buy another!
                        </span>
                      )}
                    </div>
                    <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className={`h-full transition-all ${
                          isLow ? 'bg-rose-500' : 'bg-teal-500'
                        }`}
                        style={{
                          width: `${
                            totals.totalRemaining > 0
                              ? Math.max(4, Math.min(100, totals.fillPercent))
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Separate Per-Container Rows by Purchase Date & Volume */}
                  <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
                    {sortedContainers.map((c, idx) => {
                      const cPct =
                        c.containerSize > 0
                          ? Math.min(100, Math.round((c.quantityRemaining / c.containerSize) * 100))
                          : 0;
                      const isEmpty = c.quantityRemaining <= 0;

                      return (
                        <div
                          key={c.id}
                          className={`flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-xs ${
                            isEmpty
                              ? 'bg-slate-900/40 border-slate-800/60 opacity-60'
                              : idx === 0
                              ? 'bg-slate-900 border-teal-500/30'
                              : 'bg-slate-900/80 border-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                              #{idx + 1} ({c.containerSize} {unitLabel} size)
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                setEditingContainerData({
                                  partId: part.id,
                                  partName: part.name,
                                  unit: unitLabel,
                                  container: { ...c },
                                })
                              }
                              title="Click to edit purchase date, bottle size, remaining fluid, and price"
                              className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:border-amber-400 flex items-center gap-1.5 transition"
                            >
                              <Calendar className="w-3 h-3 text-amber-400" />
                              <span>Purchased: {c.datePurchased}</span>
                              {c.pricePaid !== undefined && <span>• ${c.pricePaid.toFixed(2)}</span>}
                              <Pencil className="w-2.5 h-2.5 opacity-60 ml-0.5" />
                            </button>

                            {idx === 0 && !isEmpty && sortedContainers.length > 1 && (
                              <span className="text-[10px] text-teal-400 font-semibold">
                                • Active (Drains 1st)
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 ml-auto">
                            {/* Mini per-bottle level bar */}
                            <div className="w-16 h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 hidden sm:block">
                              <div
                                className="h-full bg-teal-400"
                                style={{ width: `${cPct}%` }}
                              />
                            </div>

                            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-1.5 py-0.5">
                              <button
                                type="button"
                                disabled={c.quantityRemaining <= 0}
                                onClick={() =>
                                  adjustContainerQuantity(part.id, c.id, -stepDelta)
                                }
                                className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 flex items-center justify-center transition"
                                title={
                                  c.quantityRemaining <= 0
                                    ? 'Container is empty (0.0)'
                                    : `Deduct ${stepDelta} ${unitLabel} from this container`
                                }
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="font-mono font-bold text-white min-w-[68px] text-center text-[11px]">
                                {c.quantityRemaining} / {c.containerSize} {unitLabel}
                              </span>
                              <button
                                type="button"
                                disabled={c.quantityRemaining >= c.containerSize}
                                onClick={() =>
                                  adjustContainerQuantity(part.id, c.id, stepDelta)
                                }
                                className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 flex items-center justify-center transition"
                                title={
                                  c.quantityRemaining >= c.containerSize
                                    ? `Container is at full bottle capacity (${c.containerSize} ${unitLabel})`
                                    : `Add ${stepDelta} ${unitLabel} to this container`
                                }
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                setEditingContainerData({
                                  partId: part.id,
                                  partName: part.name,
                                  unit: unitLabel,
                                  container: { ...c },
                                })
                              }
                              className="text-slate-500 hover:text-amber-400 p-1 transition"
                              title="Edit this purchase lot (date, size, price, remaining)"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteContainer(part.id, c.id)}
                              className="text-slate-500 hover:text-rose-400 p-1 transition"
                              title="Remove empty/discarded container"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Inline Form to Add Another Container with Custom Purchase Date & Volume */}
                  {addingContainerForPartId === part.id && (
                    <div className="bg-slate-900 border border-teal-500/40 rounded-lg p-2.5 space-y-2 mt-2">
                      <div className="text-[11px] font-bold text-teal-300">
                        Add New Bottle / Container to {part.name}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">
                            Date Purchased
                          </label>
                          <input
                            type="date"
                            value={newContDate}
                            onChange={(e) => setNewContDate(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">
                            Container Size ({unitLabel})
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            min="0.1"
                            value={newContSize}
                            onChange={(e) => {
                              const newSize = e.target.value;
                              setNewContSize(newSize);
                              const parsedSize = parseFloat(newSize);
                              if (!isNaN(parsedSize) && parseFloat(newContQty) > parsedSize) {
                                setNewContQty(newSize);
                              }
                            }}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">
                            Qty Remaining ({unitLabel})
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max={newContSize}
                            value={newContQty}
                            onChange={(e) => {
                              const val = e.target.value;
                              const maxVal = parseFloat(newContSize);
                              if (!isNaN(maxVal) && parseFloat(val) > maxVal) {
                                setNewContQty(String(maxVal));
                              } else {
                                setNewContQty(val);
                              }
                            }}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setAddingContainerForPartId(null)}
                          className="px-2.5 py-1 text-xs text-slate-400 hover:text-white"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleConfirmAddContainer(part.id)}
                          className="px-3 py-1 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded transition"
                        >
                          Save Container
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Low stock callout for discrete parts */}
              {!isConsumable && isLow && (
                <div className="flex items-center gap-2 bg-rose-950/40 border border-rose-600/40 text-rose-300 text-xs px-3 py-1.5 rounded-lg">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>
                    Stock below minimum threshold ({part.quantityOnBoard} on board vs{' '}
                    {part.minQuantity} required) — order spare replacements.
                  </span>
                </div>
              )}

              {/* Part Number Chips (Tap to switch active lookup number!) */}
              <div className="bg-slate-950/80 border border-slate-800/90 rounded-lg p-2.5 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Tag className="w-3 h-3 text-sky-400" />
                    Tap OEM / Product # to look up prices & reorder:
                  </span>
                  {part.lastPricePaid !== undefined && (
                    <span>
                      Last Paid:{' '}
                      <strong className="text-emerald-400">${part.lastPricePaid.toFixed(2)}</strong>
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedQueryByPart((prev) => ({
                        ...prev,
                        [part.id]: part.oemPartNumber,
                      }))
                    }
                    className={`text-xs font-mono px-2.5 py-1 rounded-md border transition ${
                      activeSearchNumber === part.oemPartNumber
                        ? 'bg-sky-500/20 border-sky-400 text-sky-200 font-bold'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    OEM: {part.oemPartNumber}
                  </button>

                  {part.crossRefNumbers.map((cr) => (
                    <button
                      key={cr}
                      type="button"
                      onClick={() =>
                        setSelectedQueryByPart((prev) => ({
                          ...prev,
                          [part.id]: cr,
                        }))
                      }
                      className={`text-xs font-mono px-2.5 py-1 rounded-md border transition ${
                        activeSearchNumber === cr
                          ? 'bg-sky-500/20 border-sky-400 text-sky-200 font-bold'
                          : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {cr}
                    </button>
                  ))}
                </div>
              </div>

              {/* Online Price Lookup & Marine Supplier Links */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                  <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
                  Look Up Live Price & Reorder{' '}
                  <code className="text-sky-300 bg-slate-950 px-1.5 py-0.5 rounded font-mono">
                    {activeSearchNumber}
                  </code>
                  :
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {part.preferredVendorUrl && (
                    <a
                      href={part.preferredVendorUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border bg-emerald-500/20 text-emerald-200 border-emerald-500/40 hover:bg-emerald-500/30 flex items-center gap-1 transition"
                    >
                      Saved Product Link
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}

                  {vendorLinks.map((vendor) => (
                    <a
                      key={vendor.id}
                      href={vendor.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={vendor.description}
                      className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border flex items-center gap-1 transition ${vendor.badgeColor}`}
                    >
                      {vendor.shortLabel}
                      <ExternalLink className="w-3 h-3 opacity-80" />
                    </a>
                  ))}
                </div>
              </div>

              {/* Part Photos & Reference Images */}
              {part.photos && part.photos.length > 0 && (
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-emerald-400" />
                    Part Photos ({part.photos.length})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {part.photos.map((photo) => (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => setLightboxPhoto(photo)}
                        className="group relative rounded-lg overflow-hidden border border-slate-700 hover:border-sky-400 transition bg-slate-950 text-left max-w-[180px] cursor-pointer"
                        title="Click to enlarge photo"
                      >
                        <img
                          src={photo.dataUrl}
                          alt={photo.caption || part.name}
                          className="h-24 w-36 object-cover group-hover:scale-105 transition duration-200"
                        />
                        {photo.caption && (
                          <div className="px-2 py-1 text-[10px] text-slate-300 truncate bg-slate-950/90">
                            {photo.caption}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Locker Location & Notes */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs text-slate-400 gap-2 flex-wrap">
                <div className="space-y-0.5">
                  {part.locationOnBoat && (
                    <div className="flex items-center gap-1 text-slate-300">
                      <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Stowed in: {part.locationOnBoat}</span>
                    </div>
                  )}
                  {part.notes && <div className="text-slate-400">{part.notes}</div>}
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={() => openEditPartModal(part)}
                    className="flex items-center gap-1 text-slate-300 hover:text-sky-300 bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg px-2.5 py-1 text-xs transition font-semibold"
                    title="Edit part details"
                  >
                    <Pencil className="w-3.5 h-3.5 text-sky-400" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleDeletePart(part.id)}
                    className="text-slate-600 hover:text-rose-400 p-1.5 transition rounded-lg hover:bg-rose-500/10"
                    title="Delete item"
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
        </>
      )}

      {/* Modal: Add / Edit Part or Consumable */}
      {showAddPartModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSavePart}
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-3.5 shadow-2xl my-auto"
          >
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              {itemType === 'consumable' ? (
                <FlaskConical className="w-5 h-5 text-teal-400" />
              ) : (
                <Package className="w-5 h-5 text-sky-400" />
              )}
              {editingPart ? "Edit Item in Ship's Catalog" : "Add Item to Ship's Catalog"}
            </h3>

            {/* Item Type Selector */}
            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setItemType('part');
                  setUnit('each');
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  itemType === 'part'
                    ? 'bg-sky-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                Spare Part
              </button>
              <button
                type="button"
                onClick={() => {
                  setItemType('consumable');
                  setUnit('oz');
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  itemType === 'consumable'
                    ? 'bg-teal-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FlaskConical className="w-3.5 h-3.5" />
                Consumable / Fluid
              </button>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                {itemType === 'consumable' ? 'Consumable / Fluid Name' : 'Part Name'}
              </label>
              <input
                type="text"
                required
                placeholder={
                  itemType === 'consumable'
                    ? 'e.g., Star brite Aqua Water Tank Freshener'
                    : 'e.g., Raw Water Pump Impeller'
                }
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
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
                      className="text-[10px] text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" />
                      <span>+ New</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingCustomCategory(false);
                        setCustomCategoryInput('');
                      }}
                      className="text-[10px] text-slate-400 hover:text-slate-200"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                {isAddingCustomCategory ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      placeholder="e.g., Electronics & Nav..."
                      value={customCategoryInput}
                      onChange={(e) => setCustomCategoryInput(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const trimmed = customCategoryInput.trim();
                        if (trimmed) {
                          setCategory(trimmed);
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
                      className="px-2.5 py-1.5 bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-lg transition"
                    >
                      Add
                    </button>
                  </div>
                ) : (
                  <select
                    value={category}
                    onChange={(e) => {
                      if (e.target.value === '__add_custom__') {
                        setIsAddingCustomCategory(true);
                        setCustomCategoryInput('');
                      } else {
                        setCategory(e.target.value as SystemCategory);
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
              <div>
                <label className="block text-xs text-slate-400 mb-1">Equipment / System</label>
                <input
                  type="text"
                  placeholder={
                    itemType === 'consumable'
                      ? 'e.g., Freshwater Tanks'
                      : 'e.g., Yanmar 3YM30'
                  }
                  value={equipmentModel}
                  onChange={(e) => setEquipmentModel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
            </div>

            {/* Consumable-specific attributes */}
            {itemType === 'consumable' ? (
              <div className="bg-slate-950 p-3 rounded-xl border border-teal-500/30 space-y-2.5">
                <div className="text-xs font-bold text-teal-300">
                  Fluid Measurement & Container Specifications
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Unit</label>
                    <input
                      type="text"
                      placeholder="oz, liters, quarts..."
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Bottle / Can Size</label>
                    <input
                      type="number"
                      step="0.5"
                      placeholder="16"
                      value={containerSize}
                      onChange={(e) => setContainerSize(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Advise to Buy At</label>
                    <input
                      type="number"
                      step="0.5"
                      disabled={!trackQuantity}
                      placeholder={trackQuantity ? '4' : 'Untracked'}
                      value={trackQuantity ? minQty : ''}
                      onChange={(e) => setMinQty(e.target.value)}
                      className={`w-full bg-slate-900 border rounded px-2.5 py-1.5 text-xs font-mono ${
                        !trackQuantity
                          ? 'border-slate-800 text-slate-500 cursor-not-allowed'
                          : 'border-slate-700 text-white'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">
                    Usage / Dosage Rule
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., 1 oz per 20 gal fresh water (2 oz for 40 gal tank)"
                    value={dosageHint}
                    onChange={(e) => setDosageHint(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
              </div>
            ) : null}

            {/* Tracking Quantity Toggle */}
            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-1">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={trackQuantity}
                  onChange={(e) => setTrackQuantity(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded text-sky-500 bg-slate-900 border-slate-700 focus:ring-sky-500 focus:ring-offset-0"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-200">Track On-Board Quantity & Spares</span>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    When checked, Captain's Logger monitors inventory and alerts you when stock is below minimum. Uncheck for catalog reference-only items.
                  </p>
                </div>
              </label>
            </div>

            {itemType === 'consumable' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">OEM / Product #</label>
                    <input
                      type="text"
                      placeholder="e.g., 032316"
                      value={oemPartNumber}
                      onChange={(e) => setOemPartNumber(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      Advise to Buy Threshold ({unit || 'oz'})
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      disabled={!trackQuantity}
                      value={trackQuantity ? minQty : ''}
                      placeholder={trackQuantity ? '4' : 'Untracked'}
                      onChange={(e) => setMinQty(e.target.value)}
                      className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-sm font-mono ${
                        !trackQuantity
                          ? 'border-slate-800/80 bg-slate-900/50 text-slate-500 cursor-not-allowed'
                          : 'border-slate-700 text-white'
                      }`}
                    />
                  </div>
                </div>

                {/* All Past Container Purchases Section */}
                <div className="bg-slate-950 p-3.5 rounded-2xl border border-teal-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-teal-300">
                        All Past Container Purchases ({modalContainers.length} lot{modalContainers.length === 1 ? '' : 's'})
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        Edit purchase dates, bottle sizes, remaining fluid, and prices paid for each purchase.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddModalContainer}
                      className="flex items-center gap-1 px-2.5 py-1 bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 text-teal-300 rounded-lg text-xs font-bold transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Purchase</span>
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                    {modalContainers.map((mc, idx) => (
                      <div
                        key={mc.id || idx}
                        className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-200">
                            Bottle #{idx + 1}{' '}
                            {idx === 0 && (
                              <span className="text-teal-400 font-semibold">(Active First)</span>
                            )}
                          </span>
                          {modalContainers.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveModalContainer(idx)}
                              className="text-slate-500 hover:text-rose-400 transition"
                              title="Remove this purchase entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">
                              Purchase Date
                            </label>
                            <input
                              type="date"
                              required
                              value={mc.datePurchased}
                              onChange={(e) =>
                                handleUpdateModalContainer(idx, { datePurchased: e.target.value })
                              }
                              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">
                              Bottle Size ({unit || 'oz'})
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              min="0.1"
                              required
                              value={mc.containerSize}
                              onChange={(e) => {
                                const newSize = Math.max(0.1, parseFloat(e.target.value) || 0.1);
                                handleUpdateModalContainer(idx, {
                                  containerSize: newSize,
                                  quantityRemaining: Math.min(newSize, mc.quantityRemaining),
                                });
                              }}
                              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">
                              Remaining ({unit || 'oz'})
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max={mc.containerSize}
                              value={mc.quantityRemaining}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                const safeVal = isNaN(val)
                                  ? 0
                                  : Math.min(mc.containerSize, Math.max(0, val));
                                handleUpdateModalContainer(idx, { quantityRemaining: safeVal });
                              }}
                              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">
                              Price Paid ($)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={mc.pricePaid !== undefined ? mc.pricePaid : ''}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                handleUpdateModalContainer(idx, {
                                  pricePaid: isNaN(val) ? undefined : val,
                                });
                              }}
                              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/80 text-slate-300 font-medium">
                    <span>
                      Total Fluid On Board:{' '}
                      <strong className="text-emerald-400 font-mono">
                        {modalTotalQty.toFixed(1)} {unit || 'oz'}
                      </strong>
                    </span>
                    <span>
                      Total Bottles:{' '}
                      <strong className="text-white font-mono">{modalContainers.length}</strong>
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* For discrete parts, render standard single date & price fields */
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">OEM / Product #</label>
                    <input
                      type="text"
                      placeholder="e.g., 032316"
                      value={oemPartNumber}
                      onChange={(e) => setOemPartNumber(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Date Purchased</label>
                    <input
                      type="date"
                      value={datePurchased}
                      onChange={(e) => setDatePurchased(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Last Price ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="14.99"
                      value={lastPrice}
                      onChange={(e) => setLastPrice(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">
                      {trackQuantity ? 'Spares On Board (Count)' : 'Spares On Board (Optional)'}
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={qtyOnBoard}
                      onChange={(e) => setQtyOnBoard(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Minimum Required Spares</label>
                    <input
                      type="number"
                      step="1"
                      disabled={!trackQuantity}
                      value={trackQuantity ? minQty : ''}
                      placeholder={trackQuantity ? '1' : 'Untracked'}
                      onChange={(e) => setMinQty(e.target.value)}
                      className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-sm font-mono ${
                        !trackQuantity
                          ? 'border-slate-800/80 bg-slate-900/50 text-slate-500 cursor-not-allowed'
                          : 'border-slate-700 text-white'
                      }`}
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs text-slate-400 mb-1">Locker Location on Boat</label>
              <input
                type="text"
                placeholder="e.g., Galley Sink Locker or Lazarette"
                value={locationOnBoat}
                onChange={(e) => setLocationOnBoat(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Direct Buy URL (Optional)
              </label>
              <input
                type="url"
                placeholder="https://www.defender.com/..."
                value={vendorUrl}
                onChange={(e) => setVendorUrl(e.target.value)}
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
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                >
                  <option value="">Auto-match by equipment or None</option>
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
                  placeholder="e.g., p. 42"
                  value={manualPage}
                  onChange={(e) => setManualPage(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Notes</label>
              <textarea
                rows={2}
                placeholder="Notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddPartModal(false);
                  setEditingPart(null);
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950"
              >
                {editingPart ? 'Save Changes' : 'Save to Catalog'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Quick Edit Individual Consumable Purchase Lot Modal */}
      {editingContainerData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Edit Consumable Purchase</h3>
                <p className="text-xs text-slate-400 truncate mt-0.5">
                  {editingContainerData.partName}
                </p>
              </div>
              <button
                onClick={() => setEditingContainerData(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveContainerDetails(
                  editingContainerData.partId,
                  editingContainerData.container
                );
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs text-slate-400 mb-1">Date Purchased</label>
                <input
                  type="date"
                  required
                  value={editingContainerData.container.datePurchased}
                  onChange={(e) =>
                    setEditingContainerData({
                      ...editingContainerData,
                      container: {
                        ...editingContainerData.container,
                        datePurchased: e.target.value,
                      },
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Bottle Size ({editingContainerData.unit})
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={editingContainerData.container.containerSize}
                    onChange={(e) => {
                      const newSize = Math.max(0.1, parseFloat(e.target.value) || 0.1);
                      setEditingContainerData({
                        ...editingContainerData,
                        container: {
                          ...editingContainerData.container,
                          containerSize: newSize,
                          quantityRemaining: Math.min(
                            newSize,
                            editingContainerData.container.quantityRemaining
                          ),
                        },
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Remaining ({editingContainerData.unit})
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max={editingContainerData.container.containerSize}
                    required
                    value={editingContainerData.container.quantityRemaining}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      const safeVal = isNaN(val)
                        ? 0
                        : Math.min(
                            editingContainerData.container.containerSize,
                            Math.max(0, val)
                          );
                      setEditingContainerData({
                        ...editingContainerData,
                        container: {
                          ...editingContainerData.container,
                          quantityRemaining: safeVal,
                        },
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Price Paid ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={
                    editingContainerData.container.pricePaid !== undefined
                      ? editingContainerData.container.pricePaid
                      : ''
                  }
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setEditingContainerData({
                      ...editingContainerData,
                      container: {
                        ...editingContainerData.container,
                        pricePaid: isNaN(val) ? undefined : val,
                      },
                    });
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingContainerData(null)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-xl transition"
                >
                  Save Purchase Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Modal for Part Photos with Zoom & Download */}
      {lightboxPhoto && (
        <PhotoLightboxModal
          imageUrl={lightboxPhoto.dataUrl}
          title={lightboxPhoto.caption || 'Part Reference Photo'}
          caption={lightboxPhoto.caption}
          dateAdded={lightboxPhoto.addedAt}
          onClose={() => setLightboxPhoto(null)}
        />
      )}
    </div>
  );
};
