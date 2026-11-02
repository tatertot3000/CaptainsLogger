import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  FolderOpen,
  Package,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Wrench,
  X,
} from 'lucide-react';
import { CaptainsDatabase, SystemCategory, VesselManual } from '../types';
import {
  deleteManualPdfFile,
  formatFileSize,
  getManualPdfBlob,
  openOrShareManualPdf,
  saveManualPdfFile,
} from '../db/pdfStorage';

const STANDARD_CATEGORIES: SystemCategory[] = [
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

interface ManualsLibrarySectionProps {
  db: CaptainsDatabase;
  onUpdateDb: (updater: (prev: CaptainsDatabase) => CaptainsDatabase) => void;
  filteredManuals: VesselManual[];
  customCategoryNames: string[];
  defaultCategory?: SystemCategory;
  onJumpToPart?: (partId: string) => void;
  showAddModalSignal?: number;
}

export const ManualsLibrarySection: React.FC<ManualsLibrarySectionProps> = ({
  db,
  onUpdateDb,
  filteredManuals,
  customCategoryNames,
  defaultCategory = 'Engine',
  onJumpToPart,
  showAddModalSignal,
}) => {
  const [expandedManualIds, setExpandedManualIds] = useState<Record<string, boolean>>({});
  const [offlineStatusById, setOfflineStatusById] = useState<Record<string, boolean>>({});
  const [showModal, setShowModal] = useState(false);
  const [editingManual, setEditingManual] = useState<VesselManual | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<SystemCategory>(defaultCategory);
  const [equipmentModel, setEquipmentModel] = useState(db.vessel.engineMakeModel || '');
  const [pageHints, setPageHints] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const allCategoryOptions = Array.from(new Set([...STANDARD_CATEGORIES, ...customCategoryNames]));

  // Check which manuals have an offline PDF binary stored in IndexedDB / native storage
  const refreshOfflineStatuses = async () => {
    const manuals = db.manuals || [];
    const statusMap: Record<string, boolean> = {};
    for (const m of manuals) {
      const blob = await getManualPdfBlob(m.id);
      statusMap[m.id] = Boolean(blob);
    }
    setOfflineStatusById(statusMap);
  };

  useEffect(() => {
    refreshOfflineStatuses();
  }, [db.manuals]);

  useEffect(() => {
    if (showAddModalSignal && showAddModalSignal > 0) {
      openAddManualModal();
    }
  }, [showAddModalSignal]);

  const toggleExpanded = (id: string) => {
    setExpandedManualIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const openAddManualModal = () => {
    setEditingManual(null);
    setTitle('');
    setCategory(defaultCategory);
    setEquipmentModel(db.vessel.engineMakeModel || '');
    setPageHints('');
    setExternalUrl('');
    setNotes('');
    setSelectedPdfFile(null);
    setShowModal(true);
  };

  const openEditManualModal = (manual: VesselManual) => {
    setEditingManual(manual);
    setTitle(manual.title);
    setCategory(manual.category);
    setEquipmentModel(manual.equipmentModel || '');
    setPageHints(manual.pageHints || '');
    setExternalUrl(manual.externalUrl || '');
    setNotes(manual.notes || '');
    setSelectedPdfFile(null);
    setShowModal(true);
  };

  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setIsSaving(true);

    try {
      const manualId = editingManual ? editingManual.id : `manual-${Date.now()}`;
      let fileName = editingManual?.fileName;
      let fileSizeBytes = editingManual?.fileSizeBytes;
      let hasLocalPdf = editingManual?.hasLocalPdf || offlineStatusById[manualId] || false;

      if (selectedPdfFile) {
        await saveManualPdfFile(manualId, selectedPdfFile);
        fileName = selectedPdfFile.name;
        fileSizeBytes = selectedPdfFile.size;
        hasLocalPdf = true;
      }

      const updatedManual: VesselManual = {
        id: manualId,
        title: title.trim(),
        category,
        equipmentModel: equipmentModel.trim(),
        fileName,
        fileSizeBytes,
        hasLocalPdf,
        externalUrl: externalUrl.trim() || undefined,
        pageHints: pageHints.trim() || undefined,
        notes: notes.trim() || undefined,
        addedAt: editingManual?.addedAt || new Date().toISOString().slice(0, 10),
      };

      onUpdateDb((prev) => {
        const existing = prev.manuals || [];
        const exists = existing.some((m) => m.id === manualId);
        return {
          ...prev,
          manuals: exists
            ? existing.map((m) => (m.id === manualId ? updatedManual : m))
            : [updatedManual, ...existing],
        };
      });

      await refreshOfflineStatuses();
      setShowModal(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickAttachPdf = async (manual: VesselManual, file: File | undefined) => {
    if (!file) return;
    await saveManualPdfFile(manual.id, file);
    onUpdateDb((prev) => ({
      ...prev,
      manuals: (prev.manuals || []).map((m) =>
        m.id === manual.id
          ? {
              ...m,
              fileName: file.name,
              fileSizeBytes: file.size,
              hasLocalPdf: true,
            }
          : m
      ),
    }));
    await refreshOfflineStatuses();
  };

  const handleDeleteManual = async (manual: VesselManual) => {
    if (!window.confirm(`Delete "${manual.title}" from your shipboard manuals library?`)) return;
    await deleteManualPdfFile(manual.id);
    onUpdateDb((prev) => ({
      ...prev,
      manuals: (prev.manuals || []).filter((m) => m.id !== manual.id),
      parts: prev.parts.map((p) =>
        p.manualId === manual.id ? { ...p, manualId: undefined, manualPage: undefined } : p
      ),
      schedules: prev.schedules.map((s) =>
        s.manualId === manual.id ? { ...s, manualId: undefined, manualPage: undefined } : s
      ),
    }));
  };

  return (
    <div className="space-y-3">
      {/* Info Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-sky-400 shrink-0" />
            Shipboard PDF Manuals, Schematics & Torque Index
          </div>
          <p className="text-[11px] text-slate-400">
            Store full manufacturer PDFs offline on your device and link specific page numbers directly to your parts and maintenance tasks.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddManualModal}
          className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs px-3.5 py-2 rounded-xl flex items-center justify-center gap-1.5 transition shrink-0 shadow"
        >
          <Plus className="w-4 h-4" />
          Add Manual / PDF
        </button>
      </div>

      {filteredManuals.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-2">
          <FileText className="w-8 h-8 text-slate-500 mx-auto" />
          <div className="text-slate-300 font-semibold text-sm">
            No matching PDF manuals found
          </div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Upload your engine, transmission, filter, or electronics PDF manuals to keep them accessible offline in the engine room or at sea.
          </p>
          <button
            type="button"
            onClick={openAddManualModal}
            className="inline-flex items-center gap-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs px-3.5 py-2 rounded-lg transition mt-1"
          >
            <Plus className="w-4 h-4" />
            Add First Manual / PDF
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredManuals.map((manual) => {
            const isExpanded = Boolean(expandedManualIds[manual.id]);
            const hasOfflineBlob = Boolean(offlineStatusById[manual.id]);
            const pageChipList = manual.pageHints
              ? manual.pageHints
                  .split(/[•\n]/)
                  .map((s) => s.trim())
                  .filter(Boolean)
              : [];

            // Find parts and maintenance schedules linked to this manual
            const linkedParts = db.parts.filter(
              (p) =>
                p.manualId === manual.id ||
                (!p.manualId &&
                  manual.equipmentModel &&
                  p.equipmentModel &&
                  manual.equipmentModel.toLowerCase().includes(p.equipmentModel.toLowerCase()))
            );
            const linkedSchedules = db.schedules.filter((s) => s.manualId === manual.id);

            return (
              <div
                key={manual.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2.5 transition"
              >
                {/* Top Metadata Row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                    <FileText className="w-3 h-3 text-sky-400" />
                    PDF Manual
                  </span>

                  <span className="text-[11px] font-medium uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {manual.category}
                  </span>

                  {manual.equipmentModel && (
                    <span className="text-xs text-sky-400 font-medium">
                      {manual.equipmentModel}
                    </span>
                  )}

                  {hasOfflineBlob ? (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-400" />
                      Offline PDF Stored
                      {manual.fileSizeBytes ? ` (${formatFileSize(manual.fileSizeBytes)})` : ''}
                    </span>
                  ) : manual.externalUrl ? (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                      <ExternalLink className="w-3 h-3 text-indigo-400" />
                      Linked Web PDF
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      Spec Index Card (Tap Upload PDF to store full file)
                    </span>
                  )}
                </div>

                {/* Full-Width Title Row */}
                <button
                  type="button"
                  onClick={() => toggleExpanded(manual.id)}
                  className="text-left group cursor-pointer block w-full pt-0.5"
                >
                  <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-sky-300 transition leading-snug flex items-start gap-1.5 w-full">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-sky-400 shrink-0 mt-1" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-sky-400 shrink-0 mt-1" />
                    )}
                    <span className="w-full break-words">{manual.title}</span>
                  </h3>
                </button>

                {/* Quick Page Reference Chips (Always visible for 1-tap jump!) */}
                {pageChipList.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {pageChipList.map((chip, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => openOrShareManualPdf(manual, chip)}
                        title="Tap to open PDF manual at this section"
                        className="text-[11px] bg-slate-950 hover:bg-sky-500/20 text-slate-200 hover:text-sky-200 border border-slate-800 hover:border-sky-500/40 px-2.5 py-1 rounded-lg flex items-center gap-1 transition"
                      >
                        <BookOpen className="w-3 h-3 text-sky-400 shrink-0" />
                        <span>{chip}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Action Row */}
                <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => openOrShareManualPdf(manual)}
                      className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition shadow-sm"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>{hasOfflineBlob ? 'Open Offline PDF' : 'Open Manual PDF'}</span>
                    </button>

                    <label className="cursor-pointer bg-slate-950 hover:bg-slate-800 text-teal-300 border border-teal-500/40 text-xs font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition">
                      <Upload className="w-3.5 h-3.5 text-teal-400" />
                      <span>{hasOfflineBlob ? 'Replace PDF File' : 'Upload PDF File'}</span>
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        className="hidden"
                        onChange={(e) => handleQuickAttachPdf(manual, e.target.files?.[0])}
                      />
                    </label>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditManualModal(manual)}
                      className="flex items-center gap-1 text-slate-300 hover:text-sky-300 bg-slate-950/80 hover:bg-slate-800 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition"
                    >
                      <Pencil className="w-3.5 h-3.5 text-sky-400" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteManual(manual)}
                      className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition"
                      title="Delete manual"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Expanded Details: Notes, Linked Parts & Linked Maintenance Tasks */}
                {isExpanded && (
                  <div className="pt-2 border-t border-slate-800/80 space-y-2.5 text-xs">
                    {manual.notes && (
                      <div className="bg-slate-950/70 border border-slate-800/90 rounded-lg p-2.5 text-slate-300 whitespace-pre-line">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Specifications & Service Notes:
                        </div>
                        {manual.notes}
                      </div>
                    )}

                    {manual.fileName && (
                      <div className="text-[11px] text-slate-400 font-mono">
                        File: <span className="text-slate-200">{manual.fileName}</span>
                      </div>
                    )}

                    {(linkedParts.length > 0 || linkedSchedules.length > 0) && (
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-semibold text-slate-400">
                          Linked Shipboard Parts & Maintenance Tasks:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {linkedParts.map((part) => (
                            <button
                              key={part.id}
                              type="button"
                              onClick={() => onJumpToPart && onJumpToPart(part.id)}
                              className="text-[11px] bg-slate-950 hover:bg-slate-800 text-sky-300 border border-slate-800 px-2.5 py-1 rounded-lg flex items-center gap-1 transition"
                            >
                              <Package className="w-3 h-3 text-sky-400 shrink-0" />
                              <span>{part.name}</span>
                              {part.manualPage && (
                                <span className="text-slate-400 font-mono">({part.manualPage})</span>
                              )}
                            </button>
                          ))}
                          {linkedSchedules.map((sched) => (
                            <span
                              key={sched.id}
                              className="text-[11px] bg-slate-950 text-emerald-300 border border-slate-800 px-2.5 py-1 rounded-lg flex items-center gap-1"
                            >
                              <Wrench className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span>{sched.title}</span>
                              {sched.manualPage && (
                                <span className="text-slate-400 font-mono">({sched.manualPage})</span>
                              )}
                            </span>
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

      {/* Modal: Add / Edit PDF Manual */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveManual}
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 space-y-3.5 shadow-2xl my-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-sky-400" />
                {editingManual ? 'Edit Manual / PDF' : 'Add Equipment Manual (PDF)'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Manual Title *</label>
              <input
                type="text"
                required
                placeholder="e.g., Yanmar 3YM30 Service Manual or Raymarine Axiom Manual"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">System Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as SystemCategory)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                >
                  {allCategoryOptions.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Equipment / Model</label>
                <input
                  type="text"
                  placeholder="e.g., Yanmar 3YM30"
                  value={equipmentModel}
                  onChange={(e) => setEquipmentModel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            {/* PDF File Upload Box */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
              <label className="block text-xs font-semibold text-sky-300">
                Attach Offline PDF File (Stored on Device)
              </label>
              <label className="cursor-pointer w-full border border-dashed border-sky-500/40 hover:border-sky-400 bg-sky-500/10 hover:bg-sky-500/15 rounded-lg p-3 flex items-center justify-center gap-2 text-xs text-sky-200 font-semibold transition">
                <Upload className="w-4 h-4 text-sky-400 shrink-0" />
                <span className="truncate">
                  {selectedPdfFile
                    ? `${selectedPdfFile.name} (${formatFileSize(selectedPdfFile.size)})`
                    : editingManual?.fileName
                    ? `Current: ${editingManual.fileName} (Tap to replace)`
                    : 'Choose .PDF File from Phone or PC'}
                </span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => setSelectedPdfFile(e.target.files?.[0] || null)}
                />
              </label>
              <p className="text-[10px] text-slate-500">
                Saved directly to your device&apos;s IndexedDB / app storage so it opens offline without cell signal.
              </p>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Quick Page Index (Separate sections with • or new lines)
              </label>
              <input
                type="text"
                placeholder="e.g., Oil Change p. 28 • Impeller p. 42 • Belt Tension p. 36"
                value={pageHints}
                onChange={(e) => setPageHints(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Optional Web / Cloud PDF Link (Google Drive, Manufacturer URL)
              </label>
              <input
                type="url"
                placeholder="https://..."
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Key Torque Specs, Capacities & Notes
              </label>
              <textarea
                rows={2}
                placeholder="e.g., Sump capacity 2.8L 15W-40 • Drain plug 17mm • Raw water cover bolts 8mm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-lg transition"
              >
                {isSaving ? 'Saving PDF...' : editingManual ? 'Save Changes' : 'Save Manual'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

