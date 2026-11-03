import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Trash2,
  X,
  Maximize2,
  Calendar,
  Share2,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

export interface PhotoLightboxModalProps {
  imageUrl: string;
  title?: string;
  caption?: string;
  dateAdded?: string;
  onClose: () => void;
  onDelete?: () => void;
  downloadFilename?: string;
}

export const PhotoLightboxModal: React.FC<PhotoLightboxModalProps> = ({
  imageUrl,
  title,
  caption,
  dateAdded,
  onClose,
  onDelete,
  downloadFilename,
}) => {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isDownloading, setIsDownloading] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const touchStartDistRef = useRef<number | null>(null);
  const initialScaleRef = useRef<number>(1);

  // Reset transform
  const handleReset = useCallback(() => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(5, Number((prev + 0.35).toFixed(2))));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => {
      const next = Math.max(0.5, Number((prev - 0.35).toFixed(2)));
      if (next <= 1) {
        setPosition({ x: 0, y: 0 });
      }
      return next;
    });
  }, []);

  const handleRotate = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  // Double click / tap to toggle zoom between 1x and 2.5x
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setScale((prev) => {
      if (prev > 1) {
        setPosition({ x: 0, y: 0 });
        return 1;
      } else {
        return 2.5;
      }
    });
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        handleZoomOut();
      } else if (e.key === '0') {
        handleReset();
      } else if (e.key === 'r' || e.key === 'R') {
        handleRotate();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleZoomIn, handleZoomOut, handleReset, handleRotate, onClose]);

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  // Drag-to-pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    e.preventDefault();
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile (drag + pinch-to-zoom)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // 2-finger pinch
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDistRef.current = dist;
      initialScaleRef.current = scale;
    } else if (e.touches.length === 1 && scale > 1) {
      // 1-finger pan
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDistRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / touchStartDistRef.current;
      const nextScale = Math.min(5, Math.max(0.5, Number((initialScaleRef.current * factor).toFixed(2))));
      setScale(nextScale);
      if (nextScale <= 1) {
        setPosition({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  };

  const handleTouchEnd = () => {
    touchStartDistRef.current = null;
    setIsDragging(false);
  };

  // Download / Save photo handler
  const handleDownload = async () => {
    try {
      setIsDownloading(true);

      const cleanTitle = (title || caption || 'photo')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const datePart = dateAdded ? `-${dateAdded}` : '';
      const finalFilename = downloadFilename || `captains-logger-${cleanTitle}${datePart}.jpg`;

      // On native mobile APK, support native Share sheet so user can save directly to device photo gallery
      if (Capacitor.isNativePlatform()) {
        try {
          await Share.share({
            title: title || 'Captain\'s Logger Photo',
            text: caption || 'Saved from Captain\'s Logger',
            url: imageUrl,
            dialogTitle: 'Save or Share Photo',
          });
          setIsDownloading(false);
          return;
        } catch {
          // fallback to web download if user cancelled share or share failed
        }
      }

      // Web / standard download
      if (imageUrl.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = finalFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = finalFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }
    } catch (err) {
      console.warn('Failed to download photo:', err);
      // Fallback: direct window open
      window.open(imageUrl, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-md flex flex-col justify-between select-none animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Top Header Controls Bar */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-slate-950/80 border-b border-slate-800/80 z-20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0 pr-4">
          <h3 className="text-sm font-bold text-slate-100 truncate">
            {title || caption || 'Photo Preview'}
          </h3>
          {dateAdded && (
            <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
              <Calendar className="w-3 h-3 text-slate-500" />
              <span>Added {dateAdded}</span>
            </p>
          )}
        </div>

        {/* Toolbar: Zoom In/Out, Rotate, Download, Delete, Close */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Zoom controls */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5 text-slate-300">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={scale <= 0.5}
              className="p-1.5 hover:text-white hover:bg-slate-800 rounded-lg transition disabled:opacity-30 cursor-pointer"
              title="Zoom Out (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <span className="text-[11px] font-mono px-2 min-w-[44px] text-center font-bold text-sky-400">
              {Math.round(scale * 100)}%
            </span>

            <button
              type="button"
              onClick={handleZoomIn}
              disabled={scale >= 5}
              className="p-1.5 hover:text-white hover:bg-slate-800 rounded-lg transition disabled:opacity-30 cursor-pointer"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer border-l border-slate-800 ml-0.5"
              title="Reset Zoom (Fit)"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Rotate button */}
          <button
            type="button"
            onClick={handleRotate}
            className="p-2 text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl transition cursor-pointer"
            title="Rotate 90° Clockwise (R)"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Download button */}
          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-xl transition shadow cursor-pointer disabled:opacity-50"
            title="Download full resolution photo"
          >
            {Capacitor.isNativePlatform() ? (
              <Share2 className="w-3.5 h-3.5 stroke-[2.5]" />
            ) : (
              <Download className="w-3.5 h-3.5 stroke-[2.5]" />
            )}
            <span className="hidden sm:inline">
              {Capacitor.isNativePlatform() ? 'Save / Share' : 'Download'}
            </span>
          </button>

          {/* Optional Delete button */}
          {onDelete && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Delete this photo permanently?')) {
                  onDelete();
                  onClose();
                }
              }}
              className="p-2 text-rose-400 hover:text-rose-200 bg-rose-950/40 hover:bg-rose-900 border border-rose-600/50 rounded-xl transition cursor-pointer"
              title="Delete photo"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl transition cursor-pointer ml-1"
            title="Close viewer (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Image Surface (Zoomable & Pannable) */}
      <div
        ref={containerRef}
        className="relative flex-1 w-full h-full overflow-hidden flex items-center justify-center cursor-default"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="relative transition-transform ease-out duration-75 flex items-center justify-center w-full h-full p-2 sm:p-6"
          style={{
            cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
          }}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={handleDoubleClick}
        >
          <img
            src={imageUrl}
            alt={caption || title || 'Photo'}
            draggable={false}
            className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl transition-transform duration-100 will-change-transform"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
            }}
          />
        </div>
      </div>

      {/* Bottom Caption Bar */}
      {caption && (
        <div
          className="px-6 py-3 bg-slate-950/90 border-t border-slate-800/80 text-center z-20"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-xs sm:text-sm text-slate-200 font-medium max-w-3xl mx-auto">
            {caption}
          </p>
        </div>
      )}
    </div>
  );
};

