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
    <!-- Geolocation & GPS permissions for Passage Log AutoLeg (Foreground & Background when locked) -->
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-feature android:name="android.hardware.location.gps" android:required="false" />
</manifest>`;

if (!xml.includes('android.permission.ACCESS_BACKGROUND_LOCATION')) {
  xml = xml.replace('</manifest>', permissions);
  fs.writeFileSync(manifestPath, xml, 'utf8');
  console.log('Successfully injected Background GPS and WakeLock permissions into AndroidManifest.xml');
} else {
  console.log('Background GPS permissions already present in AndroidManifest.xml');
}

// Inject notification channel string for Background Geolocation into strings.xml
const stringsPath = path.resolve(__dirname, '../../android/app/src/main/res/values/strings.xml');
if (fs.existsSync(stringsPath)) {
  let stringsXml = fs.readFileSync(stringsPath, 'utf8');
  if (!stringsXml.includes('capacitor_background_geolocation_notification_channel_name')) {
    stringsXml = stringsXml.replace(
      '</resources>',
      '    <string name="capacitor_background_geolocation_notification_channel_name">Passage Tracking</string>\n</resources>'
    );
    fs.writeFileSync(stringsPath, stringsXml, 'utf8');
    console.log('Successfully injected background tracking channel name into strings.xml');
  }
}
