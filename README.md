# Captain's Logger — Sailboat Navigation, Passage & Maintenance PWA

An offline-first Progressive Web App (PWA) and Android application designed for cruisers, coastal skippers, and offshore sailors to replace paper logbooks, maintenance binders, fuel logs, and spare parts catalogs.

Designed & Developed by **Eddie Fiorelli**.  
*Copyright © 2026 Eddie Fiorelli. Licensed under the GNU General Public License v3.0 (GPL-3.0).*

---

## About Captain's Logger

**Captain's Logger** is a modern, cockpit-ready digital vessel logbook built specifically for life at sea. Cellular coverage often disappears long before you reach your destination. Engineered from the keel up with an **offline-first architecture** (`IndexedDB`, `localStorage`, and Service Workers), all passage tracking, chart tools, maintenance logs, and equipment catalogs remain 100% accessible offshore with zero network connection.

---

## Key Features

### 🗺️ Interactive Marine Navigation Charts & GPS Tracks
* **Multi-Layer Leaflet Marine Chart**: Switch seamlessly between:
  * **Ocean Chart**: Clean OpenStreetMap base with marine contours.
  * **Satellite Imagery**: High-resolution ESRI World Imagery for harbor entrances and anchorages.
  * **Night Cockpit**: High-contrast, dark-filtered chart designed for red-light preservation at the helm without third-party API keys or watermarks.
* **OpenSeaMap Navigational Seamarks Overlay**: Toggle live seamarks including navigation buoys, lighthouses, sector lights, beacons, and lateral/cardinal marks.
* **Passage Track Visualizer**: Renders completed and underway passage legs with distinct color-coded route lines, departure/arrival markers, and waypoint coordinates.
* **Live Vessel GPS Telemetry**: Real-time GPS vessel position marker with heading arrow, pulsating fix ring, and continuous breadcrumb track logging.
* **Cockpit HUD & Modal Modes**: View maps inline within the active AutoLeg HUD or expand to full-screen interactive modal view.

### 📥 Offline Marine Chart Pack Downloader
* **Offshore Tile Caching**: Download and store high-resolution chart tile packs directly onto your device before dropping lines.
* **Custom Nautical Mile Radius**: Quick-select **10 NM** (~3 MB), **25 NM** (~10 MB), or **50 NM** (~18 MB) presets, or adjust a custom radius slider up to 50 NM.
* **Multi-Zoom Coverage**: Packages zoom levels 7 through 13 covering coastal cruising areas and harbor approaches.
* **Storage & Cache Manager**: Real-time progress bar during downloads, estimated download sizes, cached tile count display, and one-tap cache clearing.
* **Offline Fallback Tile Layer**: Automatically serves cached tiles when operating out of cellular range.

### 📡 GPS AutoLeg & Hands-Free Passage Recording
* **Live Cockpit Telemetry**: Tracks real-time **Speed Over Ground (SOG)** in knots, **Course Over Ground (COG)** with 16-point compass rose degrees, and distance run in **Nautical Miles (NM)** via Haversine calculation.
* **Native Android GPS with Wake-Lock**: Background location tracking powered by `@capacitor/geolocation` and native Android permissions (`ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `WAKE_LOCK`), preventing screen sleep while underway.
* **Pause / Resume Controls**: Pause tracking during lunch stops, waiting for bridge openings, or temporary anchoring without fragmenting your passage log.
* **One-Tap Finish & Sync**: Automatically populates departure and arrival times, ports, coordinates, distance, max/average speeds, and attaches high-resolution GPS breadcrumb tracks directly into the Leg Logbook.

### ⚠️ GPS Navigational Safety Warning & Maritime Disclaimer
* **Prominent Advisory Splash**: Displays an amber maritime safety modal before activating GPS tracking.
* **Informational Aid Notice**: Explicitly clarifies that Captain's Logger is an electronic logbook and supplemental aid, **not a certified ECDIS** or primary navigation system.
* **Prudent Seamanship & COLREGS**: Reminds the skipper of their legal duty under Rule 5 of the International Regulations for Preventing Collisions at Sea (COLREGS) to maintain a proper look-out at all times and cross-reference official government hydrographic charts (NOAA, UKHO, CHS).
* **Voyage Memory**: *"Do not prompt again during this voyage"* option persists your acknowledgement in `localStorage` per passage so subsequent leg tracking remains seamless.

### 📷 Interactive Photo Lightbox with Zoom, Rotate & Download
* **High-Resolution Inspection & Passage Photos**: Full-screen lightbox viewer integrated across the Passage Journal, Maintenance Logbook, and Parts Catalog.
* **Multi-Touch & Mouse Zoom**: Pinch-to-zoom on mobile or use mouse wheel / zoom buttons up to **5x magnification**.
* **Pan & Inspect**: Click-and-drag or touch-drag across enlarged photos to inspect engine serial numbers, rigging details, or passage photos.
* **90° Rotation**: Rotate photos on the fly to correct mobile orientation.
* **Export & Sharing**: One-tap direct file download, plus native Android Share Sheet integration via `@capacitor/share`.

### ⛵ Sail & Passage Logbook
* **Multi-Leg Voyages & Cruises**: Organize seasonal cruises and multi-day voyages into sequential passage legs with live status tracking (*Underway* vs *Completed*).
* **Rollup Navigation Metrics**: Tracks total distance in **Nautical Miles (NM)**, hours underway, engine run hours, and sail-to-motor propulsion ratio.
* **Marine Conditions & Sail Trim**: Record wind speed, gusts, direction, sea state (*Calm*, *Slight*, *Moderate*, *Rough*, *Heavy*), sky conditions, barometric pressure, point of sail, and sails hoisted.
* **Engine Hours & Fuel Tracking**: Auto-calculates engine run time and fuel burn delta per leg, with one-click automatic synchronization with the vessel's master engine hours log.
* **Crew Manifest & Mooring Details**: Keep a crew/guest manifest, record marina slips, mooring balls, anchor scope, and holding notes.

### 🤖 Automated Android APK CI/CD
* **GitHub Actions Workflow**: Automated build pipeline (`.github/workflows/build-android-apk.yml`) compiles debug and signed release APKs on every tag or push.
* **Manifest Permissions Injection**: Automated build script (`.github/android/inject-manifest-permissions.js`) injects required GPS, location, and wake-lock permissions during CI.
* **GitHub Releases**: Automatically attaches installable `.apk` assets to GitHub Releases for direct side-loading onto boat phones and cockpit tablets.

### 🏷️ Customizable Vessel Insignia & Builder Logos
* **Quick-Tap Title Bar Emblems**: Tap the header emblem to instantly pick your builder's insignia or nautical symbol:
  * **Hunter Marine** (chevron & sail sweep)
  * **Catalina Yachts** (diamond & sail insignia)
  * **Bénéteau** (seahorse insignia)
  * **Jeanneau** (compass star emblem)
  * **Bavaria Yachts** (crossed sails & crest)
  * **Island Packet** (anchor & cutter crest)
  * **Nautical Classics** (Classic Compass, Fouled Anchor, Sloop Underway, Ship's Helm)
* **Custom Burgee / Emblem Upload**: Upload your yacht club burgee or custom boat graphic with client-side image compression.

### 🖼️ Optional Vessel Wallpaper & Background Themes
* **100% Optional & Default-Off**: Keeps the sleek dark slate theme unless explicitly enabled.
* **Custom Boat Photo Upload**: Upload a photo of your sailboat at anchor or underway to use as a personalized background.
* **Curated Presets**: Quick-select from presets like *Deep Ocean Wake*, *Golden Sunset*, *Glassy Anchorage*, and *Night Ocean*.
* **Backdrop Dimming & Opacity Slider**: Adjust brightness (`5% - 45%`) with a live preview box to keep all gauges, dials, and text crisp and readable.
* **Night-Vision Protected**: The wallpaper automatically turns red-monochrome when night watch mode is engaged.

### 🔧 Maintenance Schedules & Service Logbook
* **Hourly & Calendar Intervals**: Track tasks by engine hours (e.g., every 100h), calendar days (e.g., 365d), or as-needed.
* **Smart Alert Flags**: Automatically highlights **Overdue** and **Due Soon** items.
* **Auto-Inventory Deduction**: Deducts parts and consumable additives (quarts, ounces, liters) from your on-board spares when logging maintenance.
* **Inspection Photos**: Attach before/after service photos to any log entry.

### ⛽ Diesel & Gasoline Fuel Log & Tank Level Estimator
* **Selectable Fuel Type**: Supports both **Diesel** and **Gasoline (Gas)** auxiliary engines and outboards.
* **Fill-Up Logging**: Log fuel additions with engine hours, gallons, price/gal, and fuel treatment additives.
* **Burn Rate & Range Estimations**: Calculates average GPH (gallons per hour), estimated fuel remaining in the tank, and remaining motoring range.

### 📦 Equipment & Parts Catalog with Live Vendor Lookup
* **OEM & Aftermarket Cross-References**: Store part numbers across `Yanmar`, `Racor`, `Sierra`, `Baldwin`, `Wix`, and `Jabsco`.
* **On-Board Locker Mapping**: Record the exact shelf, bin, or locker location on your vessel.
* **One-Tap Vendor Shopping**: Instantly check price & availability across **Defender Marine**, **West Marine**, **Fisheries Supply**, **Amazon**, and **Google Shopping**.

### 🔴 Red-Light Night Watch Mode
* Built-in red night-vision toggle in the top bar to preserve night vision during overnight passages.

### 💾 100% Offline Storage + Multi-Layer Sync
* **Layer 1 (Offline Device Storage)**: Powered by `IndexedDB` and `localStorage` so it functions offshore with zero cellular connection.
* **Layer 2 (Option A — PC Hard Drive Auto-Save)**: Automatic local backup to `data/captains-log.json`.
* **Layer 3 (Option B — Supabase Cloud Sync)**: Real-time cloud synchronization between your phone, tablet, and PC.
* **Export & Backup**: Full `.json` database backups and `.csv` spreadsheet exports (compatible with Android's native share sheet for Google Drive).

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start local development server with network access for phones/tablets
npm run dev -- --host

# 3. Build production bundle with PWA service worker
npm run build

# 4. Build demo bundle (with preloaded sample voyages, tracks & maintenance records)
npm run build:demo
```

---

## Documentation Guides

* [**WINDOWS_INSTALL_GUIDE.md**](./WINDOWS_INSTALL_GUIDE.md) — Beginner-friendly guide for installing Node.js, setting up dependencies, and running the app as a standalone Windows desktop app.
* [**STORAGE_AND_SYNC_GUIDE.md**](./STORAGE_AND_SYNC_GUIDE.md) — Complete guide on local offline storage, PC hard drive auto-saving, and Supabase cloud synchronization.

---

## Contact & Feedback

Have questions, feedback, or feature requests? Reach out directly via GitHub:
* **GitHub Profile & Repository**: [github.com/tatertot3000/CaptainsLogger](https://github.com/tatertot3000/CaptainsLogger)
* **Questions & Issue Tracker**: [Open an Issue on GitHub](https://github.com/tatertot3000/CaptainsLogger/issues)

---

## License & Copyright

**Copyright (C) 2026 Eddie Fiorelli.**  
This program is free software: you can redistribute it and/or modify it under the terms of the **GNU General Public License v3.0 (GPL-3.0)** as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but **WITHOUT ANY WARRANTY**; without even the implied warranty of **MERCHANTABILITY** or **FITNESS FOR A PARTICULAR PURPOSE**. See the [`LICENSE`](./LICENSE) file for the full license text.
