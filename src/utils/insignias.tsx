import React from 'react';
import { Compass, Anchor, Sailboat } from 'lucide-react';

export interface InsigniaDefinition {
  id: string;
  name: string;
  category: 'builder' | 'classic';
  description: string;
  isSheetLogo?: boolean;
  renderIcon: (className?: string) => React.ReactNode;
}

const BASE_URL = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL || './';
const SHEET_URL = `${BASE_URL.replace(/\/+$/, '')}/insignias/sailboat-logos.webp`;
const SHEET_WIDTH = 1024;
const SHEET_HEIGHT = 771;

interface SheetCrop {
  id: string;
  name: string;
  description: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const BUILDER_SHEET_CROPS: SheetCrop[] = [
  {
    id: 'hunter',
    name: 'Hunter Yachts',
    description: 'Official Hunter Yachts emblem & wordmark',
    x: 196,
    y: 18,
    w: 224,
    h: 74,
  },
  {
    id: 'hunter-emblem',
    name: 'Hunter (Round Emblem)',
    description: 'Hunter circular sail insignia only',
    x: 198,
    y: 18,
    w: 74,
    h: 74,
  },
  {
    id: 'catalina',
    name: 'Catalina Yachts',
    description: 'Official Catalina Yachts wordmark & stripes',
    x: 12,
    y: 32,
    w: 168,
    h: 46,
  },
  {
    id: 'beneteau',
    name: 'Bénéteau',
    description: 'Official Bénéteau seahorse crest & wordmark',
    x: 602,
    y: 644,
    w: 158,
    h: 106,
  },
  {
    id: 'jeanneau',
    name: 'Jeanneau Yachts',
    description: 'Official Jeanneau compass rose & wordmark',
    x: 48,
    y: 118,
    w: 160,
    h: 94,
  },
  {
    id: 'island-packet',
    name: 'Island Packet Yachts',
    description: 'Official Island Packet compass crest',
    x: 256,
    y: 428,
    w: 196,
    h: 62,
  },
  {
    id: 'hallberg-rassy',
    name: 'Hallberg-Rassy',
    description: 'Official Hallberg-Rassy HR sail logo',
    x: 682,
    y: 218,
    w: 272,
    h: 78,
  },
  {
    id: 'hanse',
    name: 'Hanse Yachts',
    description: 'Official Hanse script & twin wave emblem',
    x: 422,
    y: 135,
    w: 225,
    h: 72,
  },
  {
    id: 'dufour',
    name: 'Dufour Yachts',
    description: 'Official Dufour Yachts crest & wordmark',
    x: 292,
    y: 326,
    w: 130,
    h: 68,
  },
  {
    id: 'lagoon',
    name: 'Lagoon Catamarans',
    description: 'Official Lagoon emblem & wordmark',
    x: 454,
    y: 24,
    w: 192,
    h: 82,
  },
  {
    id: 'leopard',
    name: 'Leopard Catamarans',
    description: 'Official Leopard Catamarans paw & wordmark',
    x: 250,
    y: 508,
    w: 218,
    h: 122,
  },
  {
    id: 'fountaine-pajot',
    name: 'Fountaine Pajot',
    description: 'Official Fountaine Pajot Catamarans logo',
    x: 236,
    y: 656,
    w: 274,
    h: 92,
  },
  {
    id: 'moody',
    name: 'Moody Yachts',
    description: 'Official Moody twin gold sails & wordmark',
    x: 688,
    y: 12,
    w: 294,
    h: 108,
  },
  {
    id: 'hylas',
    name: 'Hylas Yachts',
    description: 'Official Hylas script & wave logo',
    x: 258,
    y: 128,
    w: 128,
    h: 66,
  },
  {
    id: 'oyster',
    name: 'Oyster Yachts',
    description: 'Official Oyster Yachts wordmark',
    x: 476,
    y: 228,
    w: 196,
    h: 48,
  },
  {
    id: 'dehler',
    name: 'Dehler',
    description: 'Official Dehler wordmark & sail emblem',
    x: 468,
    y: 322,
    w: 174,
    h: 68,
  },
  {
    id: 'freedom',
    name: 'Freedom Yachts',
    description: 'Official Freedom Yachts oval badge',
    x: 738,
    y: 318,
    w: 132,
    h: 68,
  },
  {
    id: 'grand-soleil',
    name: 'Grand Soleil',
    description: 'Official Grand Soleil emblem & wordmark',
    x: 32,
    y: 598,
    w: 184,
    h: 46,
  },
  {
    id: 'southerly',
    name: 'Southerly Yachts',
    description: 'Official Southerly variable draft yachts logo',
    x: 750,
    y: 148,
    w: 212,
    h: 52,
  },
  {
    id: 'cnb',
    name: 'CNB Yacht Builders',
    description: 'Official CNB Yacht Builders logo',
    x: 28,
    y: 242,
    w: 156,
    h: 62,
  },
  {
    id: 'farr',
    name: 'Farr Yacht Design',
    description: 'Official Farr Yacht Design logo',
    x: 258,
    y: 232,
    w: 126,
    h: 68,
  },
  {
    id: 'maxi',
    name: 'Maxi Yachts',
    description: 'Official Maxi Yachts burgee & wordmark',
    x: 66,
    y: 325,
    w: 186,
    h: 56,
  },
  {
    id: 'contest',
    name: 'Contest Yachts',
    description: 'Official Contest Yachts sail crest',
    x: 32,
    y: 394,
    w: 152,
    h: 92,
  },
  {
    id: 'etap',
    name: 'Etap Yachting',
    description: 'Official Etap gull emblem & wordmark',
    x: 490,
    y: 404,
    w: 142,
    h: 92,
  },
  {
    id: 'voyager',
    name: 'Voyager Yachts',
    description: 'Official Voyager compass banner',
    x: 732,
    y: 416,
    w: 234,
    h: 52,
  },
  {
    id: 'antares',
    name: 'Antares Yachts',
    description: 'Official Antares Yachts monogram',
    x: 24,
    y: 492,
    w: 204,
    h: 98,
  },
  {
    id: 'elan',
    name: 'Elan Yachts',
    description: 'Official Elan Yachts wordmark',
    x: 472,
    y: 545,
    w: 198,
    h: 46,
  },
  {
    id: 'prout',
    name: 'Prout Catamarans',
    description: 'Official Prout Catamarans script logo',
    x: 716,
    y: 498,
    w: 196,
    h: 66,
  },
];

export const BUILDER_INSIGNIAS: InsigniaDefinition[] = BUILDER_SHEET_CROPS.map((crop) => ({
  id: crop.id,
  name: crop.name,
  category: 'builder',
  description: crop.description,
  isSheetLogo: true,
  renderIcon: (className = 'h-7 w-auto') => (
    <svg
      viewBox={`${crop.x} ${crop.y} ${crop.w} ${crop.h}`}
      className={className}
      style={{ aspectRatio: `${crop.w} / ${crop.h}` }}
      role="img"
      aria-label={crop.name}
    >
      <image
        href={SHEET_URL}
        xlinkHref={SHEET_URL}
        x="0"
        y="0"
        width={SHEET_WIDTH}
        height={SHEET_HEIGHT}
        preserveAspectRatio="none"
      />
    </svg>
  ),
}));

export const CLASSIC_INSIGNIAS: InsigniaDefinition[] = [
  {
    id: 'compass',
    name: 'Classic Compass',
    category: 'classic',
    description: 'Traditional nautical compass rose (Default)',
    renderIcon: (className = 'w-5 h-5') => <Compass className={className} />,
  },
  {
    id: 'anchor',
    name: 'Fouled Anchor',
    category: 'classic',
    description: 'Maritime anchor symbol',
    renderIcon: (className = 'w-5 h-5') => <Anchor className={className} />,
  },
  {
    id: 'sailboat',
    name: 'Sloop Underway',
    category: 'classic',
    description: 'Sailboat hull and sails',
    renderIcon: (className = 'w-5 h-5') => <Sailboat className={className} />,
  },
  {
    id: 'ship-wheel',
    name: "Ship's Helm",
    category: 'classic',
    description: '8-spoke traditional wooden wheel',
    renderIcon: (className = 'w-5 h-5') => (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <circle cx="12" cy="12" r="5" fill="currentColor" fillOpacity="0.15" />
        <circle cx="12" cy="12" r="2" />
        <path d="M12 2v5" />
        <path d="M12 17v5" />
        <path d="M2 12h5" />
        <path d="M17 12h5" />
        <path d="M4.93 4.93l3.54 3.54" />
        <path d="M15.54 15.54l3.53 3.53" />
        <path d="M19.07 4.93l-3.53 3.54" />
        <path d="M8.46 15.54l-3.53 3.53" />
      </svg>
    ),
  },
];

export const ALL_INSIGNIAS: InsigniaDefinition[] = [
  ...CLASSIC_INSIGNIAS,
  ...BUILDER_INSIGNIAS,
];

/**
 * Checks whether the given insignia ID or URL is a wide/custom image badge
 * (from the builder logo sheet or a custom user upload) vs a square classic vector icon.
 */
export const isBadgeLogoInsignia = (insigniaIdOrUrl?: string): boolean => {
  if (!insigniaIdOrUrl || insigniaIdOrUrl === 'compass') return false;
  if (
    insigniaIdOrUrl.startsWith('data:image/') ||
    insigniaIdOrUrl.startsWith('http://') ||
    insigniaIdOrUrl.startsWith('https://') ||
    insigniaIdOrUrl.startsWith('blob:')
  ) {
    return true;
  }
  const found = ALL_INSIGNIAS.find((item) => item.id === insigniaIdOrUrl);
  return Boolean(found?.isSheetLogo);
};

/**
 * Renders the chosen insignia SVG or custom uploaded image dataUrl.
 */
export const renderVesselInsignia = (
  insigniaIdOrUrl?: string,
  className = 'w-5 h-5 text-sky-400'
): React.ReactNode => {
  if (!insigniaIdOrUrl || insigniaIdOrUrl === 'compass') {
    return <Compass className={className} />;
  }

  // Custom user image upload (data URL or http URL)
  if (
    insigniaIdOrUrl.startsWith('data:image/') ||
    insigniaIdOrUrl.startsWith('http://') ||
    insigniaIdOrUrl.startsWith('https://') ||
    insigniaIdOrUrl.startsWith('blob:')
  ) {
    return (
      <img
        src={insigniaIdOrUrl}
        alt="Vessel Insignia"
        className={`${className} object-contain rounded`}
      />
    );
  }

  // Predefined insignia (builder sheet crop or classic vector)
  const found = ALL_INSIGNIAS.find((item) => item.id === insigniaIdOrUrl);
  if (found) {
    return found.renderIcon(className);
  }

  // Fallback to Compass
  return <Compass className={className} />;
};
