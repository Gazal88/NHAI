# Pehchaan — Integration Guide

How to integrate the Pehchaan face recognition attendance module into the existing Datalake 3.0 React Native app.

---

## Install

```bash
npm install
```

> **Android — First-time setup:** After cloning, create `android/local.properties` with your SDK path (this file is gitignored and must be created on each machine):
> ```bash
> # Windows
> echo sdk.dir=C:\Users\%USERNAME%\AppData\Local\Android\Sdk > android\local.properties
>
> # Mac/Linux
> echo "sdk.dir=$HOME/Library/Android/sdk" > android/local.properties
> ```

Required native dependencies (already in package.json):

```bash
npx expo install react-native-vision-camera
npx expo install react-native-fast-tflite
npx expo install vision-camera-resize-plugin
npx expo install react-native-worklets-core
npx expo install expo-sqlite
npx expo install expo-location
npx expo install expo-image-picker
npm install @supabase/supabase-js @react-native-community/netinfo
```

---

## Required Files

Copy these into your Datalake 3.0 project:

```
src/
├── components/
│   ├── CameraView.js        — VisionCamera + TFLite frame processor
│   └── BottomNav.js         — Tab bar component
├── screens/
│   ├── LaunchScreen.js
│   ├── OnboardingScreen.js  — Worker/Admin login with 3D flip
│   ├── AuthScreen.js        — Face recognition attendance
│   ├── EnrollScreen.js      — Worker face enrollment
│   ├── ProfileScreen.js     — Worker profile
│   ├── HistoryScreen.js     — Attendance log
│   ├── WorkersScreen.js     — Admin worker management
│   ├── AdminOverviewScreen.js
│   └── SettingsScreen.js
├── services/
│   ├── DatabaseService.js   — SQLite (all operations)
│   ├── SyncService.js       — Supabase sync
│   └── config.js            — Supabase credentials (create from config.example.js)
└── theme.js                 — Design tokens (colors, fonts, shadows)

assets/
└── models/
    ├── blazeface.tflite
    ├── facemesh.tflite
    ├── liveness.tflite
    └── mobilefacenet.tflite
```

---

## app.json Plugins

Add to your `app.json`:

```json
{
  "expo": {
    "plugins": [
      "expo-sqlite",
      "expo-secure-store",
      ["react-native-vision-camera", {
        "cameraPermissionText": "App needs camera for face recognition."
      }],
      ["expo-location", {
        "locationAlwaysAndWhenInUsePermission": "App uses location to tag attendance."
      }],
      ["expo-image-picker", {
        "photosPermission": "App needs photo library for profile pictures."
      }]
    ],
    "android": {
      "permissions": ["CAMERA", "ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION"]
    }
  }
}
```

---

## metro.config.js

Add `.tflite` to asset extensions:

```js
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('tflite');
module.exports = config;
```

---

## Supabase Config

Create `src/services/config.js`:

```js
export const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
export const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
```

Run the attendance table SQL in your Supabase SQL Editor (see README.md).

---

## Usage in Datalake 3.0

### Option A — Full standalone app (current implementation)

`App.js` handles the full lifecycle. Import and use as-is.

### Option B — Drop-in attendance component

```jsx
import AuthScreen from './src/screens/AuthScreen';
import { initDB } from './src/services/DatabaseService';
import { startSyncLoop } from './src/services/SyncService';

// In your app boot sequence:
await initDB();
startSyncLoop();

// Render the attendance screen:
<AuthScreen
  worker={currentWorker}      // worker object from your DB
  pendingCount={pendingCount}
  onAttendanceLogged={() => { /* refresh your UI */ }}
  refreshWorker={async () => {
    // return fresh worker from your DB
    return await getWorkerByEmployeeId(currentWorker.employee_id);
  }}
/>
```

### Option C — Enrollment only

```jsx
import EnrollScreen from './src/screens/EnrollScreen';

<EnrollScreen
  initialUnlocked={true}    // skip admin PIN if already authed
  onDone={() => { /* navigate back */ }}
/>
```

---

## Worker Object Shape

```js
{
  id:          string,   // internal UUID
  employee_id: string,   // e.g. "EMP001"
  name:        string,
  department:  string | null,
  passcode:    string,
  embedding:   string | null,  // JSON array of 128 floats
  email:       string | null,
  phone:       string | null,
  photo_uri:   string | null,
  enrolled_at: number,   // timestamp ms
  active:      number,   // 1 = active
}
```

---

## Attendance Record Shape

```js
{
  id:          string,
  worker_id:   string,
  employee_id: string,
  worker_name: string,
  timestamp:   number,  // Unix ms
  gps_lat:     number | null,
  gps_lng:     number | null,
  confidence:  number,  // 0.0 – 1.0
  synced:      number,  // 0 = pending, 1 = synced
}
```

---

## DatabaseService API

```js
import {
  initDB,
  getWorkerByEmployeeId,
  getAllWorkers,
  enrollWorker,
  deactivateWorker,
  logAttendance,
  getRecentAttendance,
  getAttendanceByEmployee,
  getTodayAttendanceByEmployee,
  getPendingCount,
  updateWorkerProfile,
} from './src/services/DatabaseService';
```

---

## SyncService API

```js
import { startSyncLoop, syncNow, onSyncStateChange } from './src/services/SyncService';

// Start background sync listener (call once at boot)
startSyncLoop();

// Manual sync trigger
await syncNow();

// Subscribe to sync state updates
const unsub = onSyncStateChange((state) => {
  // state = { syncing, lastSyncedCount, lastSyncedAt, error }
});
unsub(); // cleanup
```

---

## AWS Migration

Switching from Supabase to AWS requires changing one file — `src/services/config.js`:

```js
// Change these two lines:
export const SUPABASE_URL = 'https://YOUR_AWS_API_GATEWAY_URL';
export const SUPABASE_ANON_KEY = 'YOUR_AWS_CREDENTIALS';
```

All sync logic, retry handling, and purge behavior remain identical.

---

## Live Demo

**iOS on Appetize.io:** https://appetize.io/app/b_q33rh2awdoepy6sylvobkmvrwq

**Build iOS (no Mac needed):**
```bash
eas build --platform ios --profile preview
```
