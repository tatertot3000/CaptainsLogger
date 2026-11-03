import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.resolve(__dirname, '../../android/app/src/main/AndroidManifest.xml');

if (!fs.existsSync(manifestPath)) {
  console.error(`AndroidManifest.xml not found at ${manifestPath}`);
  process.exit(1);
}

let xml = fs.readFileSync(manifestPath, 'utf8');

const permissions = `
    <!-- Geolocation & GPS permissions for Passage Log AutoLeg -->
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-feature android:name="android.hardware.location.gps" android:required="false" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
</manifest>`;

if (!xml.includes('android.permission.ACCESS_FINE_LOCATION')) {
  xml = xml.replace('</manifest>', permissions);
  fs.writeFileSync(manifestPath, xml, 'utf8');
  console.log('Successfully injected GPS and WakeLock permissions into AndroidManifest.xml');
} else {
  console.log('GPS permissions already present in AndroidManifest.xml');
}

