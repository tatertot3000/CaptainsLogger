# Captain's Logger — Sailboat Maintenance, Passage & Fuel Log PWA

An offline-first Progressive Web App (PWA) designed for Android, desktop, and offshore tablets to replace paper sailboat logbooks, maintenance logs, fuel tracking, and spare parts catalogs.

Designed & Developed by **Eddie Fiorelli**.  
*Copyright © 2026 Eddie Fiorelli. All rights reserved.*

---

## Key Features

### ⛵ Sail & Passage Logbook (New)
* **Multi-Leg Voyages & Cruises**: Organize seasonal cruises and multi-day voyages into sequential passage legs with live status tracking (*Underway* vs *Completed*).
* **Rollup Navigation Metrics**: Tracks total distance in **Nautical Miles (NM)**, hours underway, engine run hours, and sail-to-motor propulsion ratio.
* **Marine Conditions & Sail Trim**: Record wind speed, gusts, direction, sea state (*Calm*, *Slight*, *Moderate*, *Rough*, *Heavy*), sky conditions, barometric pressure, point of sail, and sails hoisted.
* **Engine Hours & Fuel Tracking**: Auto-calculates engine run time and fuel burn delta per leg, with one-click automatic synchronization with the vessel's master engine hours log.
* **Crew Manifest & Mooring Details**: Keep a crew/guest manifest, record marina slips, mooring balls, anchor scope, and holding notes.
* **Photo Journal & Lightbox**: Attach photos of your passage with automatic client-side compression and a full-screen image preview lightbox.

### 🏷️ Customizable Vessel Insignia & Builder Logos (New)
* **Quick-Tap Title Bar Emblems**: Tap the header emblem to instantly pick your builder's insignia or nautical symbol:
  * **Hunter Marine** (chevron & sail sweep)
  * **Catalina Yachts** (diamond & sail insignia)
  * **Bénéteau** (seahorse insignia)
  * **Jeanneau** (compass star emblem)
  * **Bavaria Yachts** (crossed sails & crest)
  * **Island Packet** (anchor & cutter crest)
  * **Nautical Classics** (Classic Compass, Fouled Anchor, Sloop Underway, Ship's Helm)
* **Custom Burgee / Emblem Upload**: Upload your yacht club burgee or custom boat graphic with client-side image compression.

### 🖼️ Optional Vessel Wallpaper & Background Themes (New)
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
# Install dependencies
npm install

# Start local development server with network access for phones/tablets
npm run dev -- --host

# Build production bundle with PWA service worker
npm run build
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

**Copyright (c) 2026 Eddie Fiorelli. All rights reserved.**  
This source code and application are the proprietary property of Eddie Fiorelli. See the [`LICENSE`](./LICENSE) file for details.
