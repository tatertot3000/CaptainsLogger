# Captain's Logger — Mobile Vessel Maintenance & Passage Logbook

A mobile application for boat owners to manage vessel maintenance, track spare parts inventory, and log passages with GPS.

Designed & Developed by **Eddie Fiorelli**  
*Copyright © 2026 Eddie Fiorelli. Licensed under the GNU General Public License v3.0 (GPL-3.0).*

---

## Overview

Captain's Logger started as a personal project to move to a digital and portable maintenance logbook. 

What began as a tool to digitize mechanical service records and manage spare parts inventory expanded into a complete digital ship's logbook. In addition to preventative maintenance, the app now handles real-time GPS passage recording (including background tracking with the phone locked), offline marine charts, equipment manuals, inspection photos, fuel burn tracking, and optional multi-device cloud synchronization.

The app works 100% offline using local device storage, making it fully functional offshore without cell coverage. When you back to service, seamless online backup options are available. Look at your logbook from your phone on the boat or at home on your PC via the webapp. If enabled, the app remains synced at all times. The ability to download and save human readability JSON files, also is avialble to those who dont want online integration.

---

## 1. Vessel Maintenance & Systems Management

The primary focus of Captain's Logger is keeping your vessel mechanically sound and organized.

### Service Schedules & Maintenance Logging
* **Engine Hour & Calendar Tracking**: Set service intervals by engine hours (e.g. every 100 hrs), calendar days (e.g. annual winterization), or one-off tasks.
* **Overdue & Due Soon Alerts**: Automated status warnings calculate remaining hours and days for every scheduled item.
* **Automatic Inventory Deduction**: Completing a service task (such as an oil or impeller change) automatically deducts the required parts and fluid volumes from your on-board stock.
* **PDF Equipment Manuals Locker**: Store and view manufacturer service manuals, wiring schematics, and parts catalogs directly in the app for offline troubleshooting in the engine compartment.

### Spare Parts & Consumables Inventory
* **Locker & Bin Location Mapping**: Log the exact stowage location (locker, bin, shelf) for every part so items can be located quickly.
* **Cross-Reference Part Numbers**: Save OEM and aftermarket alternatives (Yanmar, Racor, Sierra, Baldwin, Wix, Jabsco).
* **Fluid Tracking**: Track bulk fluids (oil, coolant, transmission fluid, fuel additives) with fractional quantity tracking (quarts, ounces, liters).
* **Vendor Lookup**: Quick links to search part availability and pricing on Defender, West Marine, Fisheries Supply, and Amazon.

### Fuel Logging & Engine Telemetry
* **Fill-Up Records**: Log gallons added, price per gallon, engine hours, and fuel treatments.
* **Burn Rate & Range**: Computes average Gallons Per Hour (GPH), variance against baseline burn rate, and estimated remaining motoring range.
* **Diesel & Gasoline**: Configurable for diesel inboards, gasoline engines, and outboard motors.

---

## 2. Passage Logging & GPS Tracking

Once vessel systems are managed, Captain's Logger handles passage recording underway.

### GPS AutoLeg Passage Tracking
* **Locked-Screen Background Tracking**: Records GPS position, Speed Over Ground (SOG), and Course Over Ground (COG) even when the phone is locked or in your pocket. Uses an Android foreground service with a persistent status notification to prevent the OS from killing the GPS stream.
* **High-Precision Distance**: Tracks nautical miles in **`0.01` NM increments** (~18.5 meters).
* **Autofill for Recurring Trips**: Dropdown menus remember previous voyage and leg names, auto-populating departure port, arrival port, distance, and propulsion mode for frequent routes.
* **Underway Conditions**: Record wind speed, gusts, direction, sea state, barometric pressure, sail trim, engine run hours, and crew manifests.
* **Anchor Watch & Dragging Alarm**: Set an allowed swing radius or use the built-in rode scope calculator (depth + freeboard × 5:1 or 7:1 scope). Monitors boat drift with real-time distance readouts, visual swing circle on charts, swing breadcrumb trails, and an audible marine siren with vibration alerts.
* **Configurable GPS Polling & Battery Profiles**: Select between Real-Time (1s), Balanced (5s), Cruising (15s), Offshore (30s), or Ocean (60s) to balance tracking resolution against device battery life.

### Marine Charts & Offline Navigation
* **Multi-Layer Charts**: Switch between standard marine contours, satellite imagery for harbor approaches, and a high-contrast night chart.
* **OpenSeaMap Seamarks**: Toggle navigational aids including buoys, lighthouses, sector lights, and beacons.
* **Recenter Boat & Fit Route**: One-tap buttons to center the chart on the vessel's live GPS fix or zoom out to view the entire passage route.
* **Offline Chart Packs**: Download and cache chart tiles for offline navigation before heading offshore (select 10 NM, 25 NM, or 50 NM radii).

---

## Additional Capabilities

* **Inspection Photo Lightbox**: Attach high-resolution photos to maintenance logs, parts, or passage entries. View photos with full-screen pinch-to-zoom (up to 5x), rotation, and sharing.
* **Red-Light Night Watch Mode**: Dedicated top-bar toggle switches the interface to red-on-black to preserve night vision.
* **Offline-First Storage**: All data lives locally on your device in `IndexedDB`. No network connection is required.
* **Optional Cloud Sync**: Connect to a free personal [Supabase](https://supabase.com) database to sync logs across phones, tablets, and computers.
* **Data Sovereignty**: Export your entire database to `.json` or spreadsheets to `.csv` at any time. No ads, tracking, or telemetry.
* **Maritime Safety Notice**: Built-in navigational safety disclaimer reminding operators of COLREGS Rule 5 obligations (supplemental aid, not a certified ECDIS).

---

## Installing on Android

1. Download the latest `CaptainsLogger.apk` from [**GitHub Releases**](https://github.com/tatertot3000/CaptainsLogger/releases).
2. Open the file on your device to install (allow *"Install from unknown sources"* if prompted).
3. To enable continuous GPS tracking while the screen is locked, go to:  
   **Android Settings > Apps > Captain's Logger > Permissions > Location** and select **"Allow all the time"**.

---

## Development

```bash
# Clone repository
git clone https://github.com/tatertot3000/CaptainsLogger.git
cd CaptainsLogger

# Install dependencies
npm install

# Start local dev server (accessible across your local Wi-Fi)
npm run dev -- --host

# Build production bundle
npm run build

# Build demo bundle (preloaded with sample vessel data)
npm run build:demo
```

---

## Documentation

* [**STORAGE_AND_SYNC_GUIDE.md**](./STORAGE_AND_SYNC_GUIDE.md) — Offline storage, local backups, and Supabase cloud setup.
* [**WINDOWS_INSTALL_GUIDE.md**](./WINDOWS_INSTALL_GUIDE.md) — Running the app on a Windows PC.

---

## License

**Copyright (C) 2026 Eddie Fiorelli.**  
Licensed under the **GNU General Public License v3.0 (GPL-3.0)**. See the [`LICENSE`](./LICENSE) file for details.
