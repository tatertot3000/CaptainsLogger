import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const androidResSrc = path.resolve(__dirname, '../../resources/android');
const androidResDest = path.resolve(__dirname, '../../android/app/src/main/res');

// Sync custom app icons & adaptive icon background color from resources/android into android/
if (fs.existsSync(androidResSrc) && fs.existsSync(androidResDest)) {
  fs.cpSync(androidResSrc, androidResDest, { recursive: true, force: true });
  for (const unusedDefault of [
    path.join(androidResDest, 'drawable/ic_launcher_background.xml'),
    path.join(androidResDest, 'drawable-v24/ic_launcher_foreground.xml'),
  ]) {
    if (fs.existsSync(unusedDefault)) {
      fs.rmSync(unusedDefault, { force: true });
    }
  }
  console.log('Successfully copied custom app icons from resources/android to android/app/src/main/res');
}

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

// Inject Native CPU WakeLock + NativePdfViewerPlugin into MainActivity.java
const mainActivityPath = path.resolve(__dirname, '../../android/app/src/main/java/com/captainslogger/app/MainActivity.java');
if (fs.existsSync(mainActivityPath)) {
  const mainActivityJava = `package com.captainslogger.app;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.PowerManager;
import android.view.View;
import android.webkit.WebView;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;

public class MainActivity extends BridgeActivity {
    private PowerManager.WakeLock cpuWakeLock;

    @CapacitorPlugin(name = "NativePdfViewer")
    public static class NativePdfViewerPlugin extends Plugin {
        @PluginMethod
        public void openPdf(PluginCall call) {
            String fileUriStr = call.getString("fileUri");
            if (fileUriStr == null || fileUriStr.isEmpty()) {
                call.reject("Missing fileUri");
                return;
            }
            try {
                Uri rawUri = Uri.parse(fileUriStr);
                String path = rawUri.getPath();
                if (path == null || path.isEmpty()) {
                    call.reject("Invalid file path");
                    return;
                }
                File file = new File(path);
                Uri contentUri = FileProvider.getUriForFile(
                    getContext(),
                    getContext().getPackageName() + ".fileprovider",
                    file
                );
                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(contentUri, "application/pdf");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().startActivity(intent);
                call.resolve();
            } catch (ActivityNotFoundException e) {
                call.reject("No PDF viewer app installed on this device", e);
            } catch (Exception e) {
                call.reject("Failed to open PDF: " + e.getMessage(), e);
            }
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativePdfViewerPlugin.class);
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
    public void onPause() {
        super.onPause();
        keepWebViewAwake();
    }

    @Override
    public void onStop() {
        super.onStop();
        keepWebViewAwake();
    }

    @Override
    public void onResume() {
        super.onResume();
        keepWebViewAwake();
    }

    private void keepWebViewAwake() {
        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                WebView wv = this.bridge.getWebView();
                wv.resumeTimers();
                wv.dispatchWindowVisibilityChanged(View.VISIBLE);
                wv.setVisibility(View.VISIBLE);
            }
        } catch (Exception e) {
            e.printStackTrace();
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
  console.log('Successfully injected NativePdfViewerPlugin, CPU WakeLock, and WebView timer keep-alive into MainActivity.java');
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

  // Ensure ALL batched locations from FusedLocationProvider are broadcast, not just the single last location
  if (bgCode.includes('Location location = locationResult.getLastLocation();')) {
    bgCode = bgCode.replace(
      `Location location = locationResult.getLastLocation();
                    Intent intent = new Intent(ACTION_BROADCAST);
                    intent.putExtra("location", location);
                    intent.putExtra("id", id);
                    LocalBroadcastManager.getInstance(
                            getApplicationContext()
                    ).sendBroadcast(intent);`,
      `if (locationResult == null) return;
                    for (Location location : locationResult.getLocations()) {
                        if (location == null) continue;
                        Intent intent = new Intent(ACTION_BROADCAST);
                        intent.putExtra("location", location);
                        intent.putExtra("id", id);
                        LocalBroadcastManager.getInstance(
                                getApplicationContext()
                        ).sendBroadcast(intent);
                    }`
    );
  }

  fs.writeFileSync(bgServicePath, bgCode, 'utf8');
  console.log('Successfully patched BackgroundGeolocationService.java for Android 14+ location type and WakeLock');
}

// Patch BackgroundGeolocation.java for safe notification icon fallback and runtime permissions
const bgPluginPath = path.resolve(
  __dirname,
  '../../node_modules/@capacitor-community/background-geolocation/android/src/main/java/com/equimaps/capacitor_background_geolocation/BackgroundGeolocation.java'
);
if (fs.existsSync(bgPluginPath)) {
  let pluginCode = fs.readFileSync(bgPluginPath, 'utf8');

  // Ensure safe icon fallback so adaptive XML icons do not crash Notification.Builder
  if (!pluginCode.includes('android.R.drawable.ic_menu_mylocation')) {
    pluginCode = pluginCode.replace(
      'builder.setSmallIcon(\n                        getAppResourceIdentifier(parts[1], parts[0])\n                );',
      `int resId = getAppResourceIdentifier(parts[1], parts[0]);
                if (resId != 0) {
                    builder.setSmallIcon(resId);
                } else {
                    builder.setSmallIcon(android.R.drawable.ic_menu_mylocation);
                }`
    );
  }

  // Ensure POST_NOTIFICATIONS and ACCESS_BACKGROUND_LOCATION are requested in the plugin permission alias
  if (!pluginCode.includes('Manifest.permission.POST_NOTIFICATIONS')) {
    pluginCode = pluginCode.replace(
      'Manifest.permission.ACCESS_FINE_LOCATION',
      'Manifest.permission.ACCESS_FINE_LOCATION,\n                                Manifest.permission.POST_NOTIFICATIONS,\n                                Manifest.permission.ACCESS_BACKGROUND_LOCATION'
    );
  }

  fs.writeFileSync(bgPluginPath, pluginCode, 'utf8');
  console.log('Successfully patched BackgroundGeolocation.java for notification icon resilience and permissions');
}
