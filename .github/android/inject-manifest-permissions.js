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

// Inject Native CPU WakeLock into MainActivity.java to keep WebView JS engine alive when screen is locked
const mainActivityPath = path.resolve(__dirname, '../../android/app/src/main/java/com/captainslogger/app/MainActivity.java');
if (fs.existsSync(mainActivityPath)) {
  const mainActivityJava = `package com.captainslogger.app;

import android.content.Context;
import android.os.Bundle;
import android.os.PowerManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private PowerManager.WakeLock cpuWakeLock;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        try {
            PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (powerManager != null) {
                cpuWakeLock = powerManager.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    "CaptainsLogger:CpuWakeLock"
                );
                cpuWakeLock.acquire();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().resumeTimers();
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        try {
            if (cpuWakeLock != null && cpuWakeLock.isHeld()) {
                cpuWakeLock.release();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
`;
  fs.writeFileSync(mainActivityPath, mainActivityJava, 'utf8');
  console.log('Successfully injected Native CPU WakeLock and WebView timer keep-alive into MainActivity.java');
}

// Patch BackgroundGeolocationService.java for Android 14+ (FOREGROUND_SERVICE_TYPE_LOCATION) and WakeLock
const bgServicePath = path.resolve(
  __dirname,
  '../../node_modules/@capacitor-community/background-geolocation/android/src/main/java/com/equimaps/capacitor_background_geolocation/BackgroundGeolocationService.java'
);
if (fs.existsSync(bgServicePath)) {
  let bgCode = fs.readFileSync(bgServicePath, 'utf8');

  if (!bgCode.includes('import android.os.PowerManager;')) {
    bgCode = bgCode.replace(
      'import android.os.IBinder;',
      'import android.os.IBinder;\nimport android.os.PowerManager;\nimport android.content.Context;'
    );
  }

  // Ensure Android 14+ FOREGROUND_SERVICE_TYPE_LOCATION is passed to startForeground
  if (!bgCode.includes('ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION')) {
    bgCode = bgCode.replace(
      'startForeground(NOTIFICATION_ID, notification);',
      `if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }`
    );
  }

  // Ensure WakeLock is held in BackgroundGeolocationService
  if (!bgCode.includes('private PowerManager.WakeLock wakeLock = null;')) {
    bgCode = bgCode.replace(
      'public class BackgroundGeolocationService extends Service {',
      `public class BackgroundGeolocationService extends Service {
    private PowerManager.WakeLock wakeLock = null;

    private void acquireWakeLock() {
        if (wakeLock == null) {
            try {
                PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (powerManager != null) {
                    wakeLock = powerManager.newWakeLock(
                            PowerManager.PARTIAL_WAKE_LOCK,
                            "BackgroundGeolocationService:WakeLock"
                    );
                    wakeLock.acquire();
                }
            } catch (Exception e) {
                Logger.error("Failed to acquire wake lock in BackgroundGeolocationService", e);
            }
        }
    }

    private void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        } catch (Exception e) {
            Logger.error("Failed to release wake lock in BackgroundGeolocationService", e);
        } finally {
            wakeLock = null;
        }
    }`
    );

    bgCode = bgCode.replace(
      'if (backgroundNotification != null) {\n                promote(backgroundNotification);',
      'if (backgroundNotification != null) {\n                acquireWakeLock();\n                promote(backgroundNotification);'
    );

    bgCode = bgCode.replace(
      'if (getNotification() == null) {\n                        stopForeground(true);',
      'if (getNotification() == null) {\n                        releaseWakeLock();\n                        stopForeground(true);'
    );

    bgCode = bgCode.replace(
      'watchers = new HashSet<Watcher>();\n        stopSelf();',
      'watchers = new HashSet<Watcher>();\n        releaseWakeLock();\n        stopSelf();'
    );
  }

  fs.writeFileSync(bgServicePath, bgCode, 'utf8');
  console.log('Successfully patched BackgroundGeolocationService.java for Android 14+ location type and WakeLock');
}
