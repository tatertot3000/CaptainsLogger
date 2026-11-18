import { Capacitor, registerPlugin } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { VesselManual } from '../types';
import {
  buildPdfMediaKey,
  deleteMediaFile,
  getMediaBlob,
  saveMediaBlob,
} from './mediaStorage';

interface NativePdfViewerPlugin {
  openPdf(options: { fileUri: string }): Promise<void>;
}

const NativePdfViewer = registerPlugin<NativePdfViewerPlugin>('NativePdfViewer');

const PDF_IDB_NAME = 'CaptainsLoggerManualsDB';
const PDF_IDB_STORE = 'pdf_files';

function openPdfIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }
    const req = window.indexedDB.open(PDF_IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PDF_IDB_STORE)) {
        db.createObjectStore(PDF_IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open PDF IndexedDB'));
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.includes(',') ? base64.split(',')[1] : base64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function readLegacyIdbPdf(legacyIdbKey: string): Promise<Blob | null> {
  try {
    const db = await openPdfIdb();
    const record = await new Promise<{ buffer?: ArrayBuffer; mimeType?: string } | undefined>(
      (resolve, reject) => {
        const tx = db.transaction(PDF_IDB_STORE, 'readonly');
        const req = tx.objectStore(PDF_IDB_STORE).get(legacyIdbKey);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }
    );
    if (record?.buffer) {
      return new Blob([record.buffer], { type: record.mimeType || 'application/pdf' });
    }
  } catch (err) {
    console.warn('Failed to read PDF from legacy IndexedDB:', err);
  }
  return null;
}

async function readLegacyNativePdf(nativeSubPath: string): Promise<Blob | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const read = await Filesystem.readFile({
      path: nativeSubPath,
      directory: Directory.Data,
    });
    if (typeof read.data === 'string') {
      const bytes = base64ToUint8Array(read.data);
      return new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    }
    if (read.data instanceof Blob) {
      return read.data;
    }
  } catch {
    // Not found in legacy native storage
  }
  return null;
}

async function deleteLegacyPdf(legacyIdbKey: string, nativeSubPath: string): Promise<void> {
  try {
    const db = await openPdfIdb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PDF_IDB_STORE, 'readwrite');
      tx.objectStore(PDF_IDB_STORE).delete(legacyIdbKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore
  }

  if (Capacitor.isNativePlatform()) {
    try {
      await Filesystem.deleteFile({
        path: nativeSubPath,
        directory: Directory.Data,
      });
    } catch {
      // Ignore
    }
  }
}

export async function saveManualPdfFile(manualId: string, file: File): Promise<string> {
  const mediaKey = buildPdfMediaKey('manual', manualId);
  await saveMediaBlob(mediaKey, file, {
    fileName: file.name,
    mimeType: file.type || 'application/pdf',
  });
  return mediaKey;
}

export async function getManualPdfBlob(manualId: string): Promise<Blob | null> {
  const unified = await getMediaBlob(buildPdfMediaKey('manual', manualId));
  if (unified) return unified;

  const legacyIdb = await readLegacyIdbPdf(manualId);
  if (legacyIdb) return legacyIdb;

  return readLegacyNativePdf(`manuals/${manualId}.pdf`);
}

export async function deleteManualPdfFile(manualId: string): Promise<void> {
  await deleteMediaFile(buildPdfMediaKey('manual', manualId));
  await deleteLegacyPdf(manualId, `manuals/${manualId}.pdf`);
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function saveInvoicePdfFile(invoiceId: string, file: File): Promise<string> {
  const mediaKey = buildPdfMediaKey('invoice', invoiceId);
  await saveMediaBlob(mediaKey, file, {
    fileName: file.name,
    mimeType: file.type || 'application/pdf',
  });
  return mediaKey;
}

export async function getInvoicePdfBlob(
  invoiceId: string,
  fallbackDataUrl?: string
): Promise<Blob | null> {
  const unified = await getMediaBlob(buildPdfMediaKey('invoice', invoiceId));
  if (unified) return unified;

  const legacyIdb = await readLegacyIdbPdf(`invoice_${invoiceId}`);
  if (legacyIdb) return legacyIdb;

  const legacyNative = await readLegacyNativePdf(`invoices/${invoiceId}.pdf`);
  if (legacyNative) return legacyNative;

  if (fallbackDataUrl && fallbackDataUrl.startsWith('data:')) {
    try {
      const bytes = base64ToUint8Array(fallbackDataUrl);
      const mime = fallbackDataUrl.split(';')[0]?.replace('data:', '') || 'application/pdf';
      return new Blob([bytes.buffer as ArrayBuffer], { type: mime });
    } catch {
      // Ignore
    }
  }

  return null;
}

export async function deleteInvoicePdfFile(invoiceId: string): Promise<void> {
  await deleteMediaFile(buildPdfMediaKey('invoice', invoiceId));
  await deleteLegacyPdf(`invoice_${invoiceId}`, `invoices/${invoiceId}.pdf`);
}

async function openPdfBlobOnDevice(
  blob: Blob,
  safeFilename: string,
  title: string,
  dialogTitle: string,
  pageHint?: string
): Promise<void> {
  // Native Android / iOS APK: write PDF to cache and open directly in native PDF viewer (`ACTION_VIEW`)
  if (Capacitor.isNativePlatform()) {
    try {
      const buffer = await blob.arrayBuffer();
      const base64Data = arrayBufferToBase64(buffer);
      const written = await Filesystem.writeFile({
        path: safeFilename,
        data: base64Data,
        directory: Directory.Cache,
      });
      try {
        await NativePdfViewer.openPdf({ fileUri: written.uri });
        return;
      } catch (viewerErr) {
        console.warn('NativePdfViewer unavailable, falling back to Share sheet:', viewerErr);
      }
      await Share.share({
        title,
        files: [written.uri],
        dialogTitle,
      });
      return;
    } catch (err) {
      const msg = String((err as Error)?.message || err);
      if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('dismiss')) {
        return;
      }
      console.warn('Native PDF open failed, falling back to browser viewer:', err);
    }
  }

  // Web Browser: open PDF Blob URL in a new tab (with optional #page=N hint)
  const blobUrl = URL.createObjectURL(blob);
  const pageMatch = pageHint?.match(/(\d+)/);
  const finalUrl = pageMatch ? `${blobUrl}#page=${pageMatch[1]}` : blobUrl;

  const newWin = window.open(finalUrl, '_blank');
  if (!newWin) {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = safeFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

export async function openOrShareInvoicePdf(
  invoice: { id: string; fileName: string; dataUrl?: string },
  contextTitle?: string
): Promise<void> {
  const blob = await getInvoicePdfBlob(invoice.id, invoice.dataUrl);
  if (!blob) {
    alert(`Invoice PDF "${invoice.fileName}" is not available locally on this device.`);
    return;
  }

  const safeFilename =
    (invoice.fileName && invoice.fileName.endsWith('.pdf')
      ? invoice.fileName
      : `${invoice.fileName.replace(/[^a-zA-Z0-9_-]+/g, '-')}.pdf`) || 'invoice.pdf';

  await openPdfBlobOnDevice(
    blob,
    safeFilename,
    contextTitle ? `${contextTitle} - ${invoice.fileName}` : invoice.fileName,
    contextTitle ? `Open Invoice: ${contextTitle}` : `Open ${invoice.fileName}`
  );
}

/**
 * Generates a lightweight, standards-compliant single-page PDF reference card
 * when a sample manual or quick-spec entry is opened without an uploaded binary PDF.
 */
export function buildReferenceSpecPdfBlob(manual: VesselManual, pageRef?: string): Blob {
  const esc = (s: string) =>
    s
      .replace(/[^\x20-\x7E]/g, ' ')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');

  const lines: string[] = [
    `CAPTAIN'S LOGGER - SHIPBOARD TECHNICAL MANUAL SUMMARY`,
    `========================================================`,
    `Manual Title: ${manual.title}`,
    `System Category: ${manual.category}`,
    `Equipment / Model: ${manual.equipmentModel || 'General Ship System'}`,
    pageRef ? `Referenced Section / Page: ${pageRef}` : '',
    `--------------------------------------------------------`,
    `KEY PAGE REFERENCES & TORQUE / SERVICE INDEX:`,
    ...(manual.pageHints ? manual.pageHints.split(/[•\n]/).map((s) => `  * ${s.trim()}`) : ['  * No page index recorded']),
    `--------------------------------------------------------`,
    `CAPTAIN'S NOTES & SPECIFICATIONS:`,
    ...(manual.notes ? manual.notes.split('\n').map((s) => `  ${s.trim()}`) : ['  Attach your full manufacturer PDF file in Manuals & PDFs']),
    `--------------------------------------------------------`,
    `Tip: Use "Attach / Replace PDF File" on this manual card to store`,
    `the full manufacturer PDF offline on your phone or computer.`,
  ].filter(Boolean);

  let textOps = 'BT\n/F1 14 Tf\n50 745 Td\n';
  lines.forEach((line, idx) => {
    if (idx === 0) {
      textOps += `(${esc(line)}) Tj\n/F1 10 Tf\n0 -20 Td\n`;
    } else {
      textOps += `(${esc(line)}) Tj\n0 -16 Td\n`;
    }
  });
  textOps += 'ET';

  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${textOps.length} >>\nstream\n${textOps}\nendstream\nendobj\n`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
}

export async function openOrShareManualPdf(
  manual: VesselManual,
  pageHint?: string
): Promise<void> {
  // 1. Check if we have an offline stored PDF blob
  let blob = await getManualPdfBlob(manual.id);

  // 2. If no local binary PDF is stored yet and an external URL is provided, open the external URL
  if (!blob && manual.externalUrl) {
    window.open(manual.externalUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  // 3. Otherwise generate a clean on-the-fly PDF reference sheet from the manual's notes & page index
  if (!blob) {
    blob = buildReferenceSpecPdfBlob(manual, pageHint);
  }

  const safeFilename =
    (manual.fileName && manual.fileName.endsWith('.pdf')
      ? manual.fileName
      : `${manual.title.replace(/[^a-zA-Z0-9_-]+/g, '-')}.pdf`) || 'manual.pdf';

  await openPdfBlobOnDevice(
    blob,
    safeFilename,
    pageHint ? `${manual.title} (${pageHint})` : manual.title,
    pageHint ? `Open ${manual.title} (${pageHint})` : `Open ${manual.title}`,
    pageHint
  );
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function findMatchingManual(
  manuals: VesselManual[] | undefined,
  item: { manualId?: string; equipmentModel?: string; category?: string }
): VesselManual | undefined {
  if (!manuals || manuals.length === 0) return undefined;
  if (item.manualId) {
    const exact = manuals.find((m) => m.id === item.manualId);
    if (exact) return exact;
  }
  if (item.equipmentModel && item.equipmentModel.trim()) {
    const eq = item.equipmentModel.toLowerCase();
    const byModel = manuals.find((m) => {
      if (!m.equipmentModel) return false;
      const mEq = m.equipmentModel.toLowerCase();
      return (
        mEq.includes(eq) ||
        eq.includes(mEq) ||
        (eq.includes('yanmar') && mEq.includes('yanmar')) ||
        (eq.includes('racor') && mEq.includes('racor'))
      );
    });
    if (byModel) return byModel;
  }
  return undefined;
}

