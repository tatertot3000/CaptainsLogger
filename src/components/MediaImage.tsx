import React, { useEffect, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import {
  getMediaDisplayUrl,
  MEDIA_RESTORED_EVENT,
  sanitizeMediaFilename,
} from '../db/mediaStorage';

export interface MediaImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  mediaKey?: string;
  fallbackSrc?: string;
}

/**
 * Renders a photo backed by the persistent local binary store (native Filesystem or IndexedDB)
 * with transparent fallback to inline dataUrl or relative demo asset URLs.
 */
export const MediaImage: React.FC<MediaImageProps> = ({
  mediaKey,
  fallbackSrc,
  alt = 'Photo',
  className = '',
  ...imgProps
}) => {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(() => {
    if (!mediaKey && fallbackSrc) return fallbackSrc;
    return null;
  });

  useEffect(() => {
    let active = true;

    if (!mediaKey) {
      setResolvedSrc(fallbackSrc || null);
      return;
    }

    const loadUrl = () => {
      void getMediaDisplayUrl(mediaKey, fallbackSrc).then((url) => {
        if (active) {
          setResolvedSrc(url);
        }
      });
    };

    loadUrl();

    const safeTarget = sanitizeMediaFilename(mediaKey);
    const handleRestored = (e: Event) => {
      const detail = (e as CustomEvent<{ mediaKey?: string }>).detail;
      if (!detail?.mediaKey || detail.mediaKey === safeTarget) {
        loadUrl();
      }
    };
    window.addEventListener(MEDIA_RESTORED_EVENT, handleRestored);

    return () => {
      active = false;
      window.removeEventListener(MEDIA_RESTORED_EVENT, handleRestored);
    };
  }, [mediaKey, fallbackSrc]);

  if (!resolvedSrc) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-900 text-slate-600 ${className}`}
        aria-label={alt}
      >
        <ImageIcon className="w-5 h-5" />
      </div>
    );
  }

  return <img src={resolvedSrc} alt={alt} className={className} {...imgProps} />;
};
