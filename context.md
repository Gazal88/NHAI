# context.md - FaceAuthModule Current Handoff

Date: 30 May 2026
Project: FaceAuthModule
Hackathon: Hackathon 7.0
Role: Person 2 - App Dev Lead
Repo branch: app/person2
Remote: https://github.com/Gazal88/NHAI.git

## One Line Status
The app is now a usable Android prototype with launch screen, worker/admin login, SQLite, model assets, defensive camera/model loading, live liveness + embedding inference, embedding-based enrollment/verify checks, history, sync fallback, and account/logout flow. It still needs real FaceMesh gesture validation, BlazeFace cropping, threshold validation, and full device testing.

## Source Documents / PRD
- `C:\Users\hp\Downloads\hackathon_doc7.pdf`
- `C:\Users\hp\Downloads\Person2_AppDev_Workplan.docx`
- `C:\Users\hp\Downloads\files (2)\Hackathon7_PRD_Final.docx`

Core PRD requirements:
- React Native Android + iOS prototype.
- Offline face recognition.
- Offline liveness detection.
- Active anti-spoofing such as blink, smile, or head turn.
- Model bundle around 20 MB or less.
- Recognition + liveness under 1 second on mid-range devices.
- Android 8+, iOS 12+, minimum 3 GB RAM.
- Accuracy target above 95%.
- Works outdoors and across diverse Indian demographics.
- Sync/purge when network returns.
- Submit source, PPT/PDF, docs, architecture, integration steps, benchmarks.

## Current Stack
- Expo SDK 56.0.4
- React Native 0.85.3
- React 19.2.3
- Navigation: `@react-navigation/native`, bottom tabs
- Camera: `react-native-vision-camera` v4
- TFLite: `react-native-fast-tflite` v3
- Frame resize: `vision-camera-resize-plugin`
- Worklets: `react-native-worklets-core`
- SQLite: `expo-sqlite`
- GPS: `expo-location`
- Secure storage installed: `expo-secure-store`
- Sync: `@supabase/supabase-js`, `@react-native-community/netinfo`

## Current App Flow
1. App opens to `LaunchScreen`.
2. `App.js` initializes SQLite first.
3. App restores saved `employee_id` from `app_config` if available.
4. First usable page is `OnboardingScreen`.
5. Login modes:
   - Worker login: Employee ID + worker passcode.
   - Admin login: Admin PIN.
6. Worker tabs:
   - Verify
   - Enroll
   - History
   - Account
7. Admin tabs:
   - Enroll
   - History
   - Account
   - No Verify tab, because admin may not be a field worker.
8. Account tab supports Switch Worker / Exit Admin.

## Demo Credentials
Worker:
- Employee ID: `EMP001`
- Passcode: `1234`
- Name: Rajesh Kumar
- Department: Engineering

Admin:
- PIN: `ADMIN1234`

## Current Model Files
TFLite files exist in both:
- `assets/models/`
- `ml/models/tflite/`

Files:
- `blazeface.tflite` - 229,032 bytes
- `facemesh.tflite` - 1,242,398 bytes
- `liveness.tflite` - 1,709,800 bytes
- `mobilefacenet.tflite` - 2,894,904 bytes

Total bundle is about 6.08 MB, under the 20 MB target.

## Current ModelBridge Status
- `ModelBridge.js` lazy-requires `react-native-fast-tflite` for startup loading/logging.
- This was done to avoid early Nitro boot crashes like:
  `Failed to install Nitro! ReactApplicationContext.javaScriptContextHolder is null`.
- `App.js` no longer imports `ModelBridge` at top level.
- `App.js` calls model loading after DB/app boot using a delayed `loadAppModels`.
- `loadModels()` attempts to load:
  - BlazeFace
  - FaceMesh
  - Liveness
  - MobileFaceNet
- CPU delegates are passed as `[]`.
- `runLiveness(imageData)` and `runRecognition(imageData)` remain available helper APIs.
- No face detection post-processing exists yet.
- No FaceMesh landmark parsing exists yet.
- No embedding comparison exists yet.
- `CameraView.js` now also runs live frame inference with:
  - `react-native-worklets-core`
  - `vision-camera-resize-plugin`
  - `react-native-fast-tflite`
- It resizes live frames to model input sizes, runs liveness + MobileFaceNet, and reports latest liveness score + embedding to screens.
- This requires full native rebuild after installing dependencies.

## Current Database
SQLite DB: `faceauth.db`

Tables:
- `workers`
  - `id TEXT PRIMARY KEY`
  - `employee_id TEXT UNIQUE NOT NULL`
  - `name TEXT NOT NULL`
  - `department TEXT`
  - `passcode TEXT`
  - `embedding TEXT`
  - `enrolled_at INTEGER`
- `attendance`
  - `id TEXT PRIMARY KEY`
  - `worker_id TEXT NOT NULL`
  - `employee_id TEXT NOT NULL`
  - `worker_name TEXT`
  - `timestamp INTEGER NOT NULL`
  - `gps_lat REAL`
  - `gps_lng REAL`
  - `confidence REAL`
  - `synced INTEGER DEFAULT 0`
- `app_config`
  - `key TEXT PRIMARY KEY`
  - `value TEXT`
- `failure_log`
  - `id TEXT PRIMARY KEY`
  - `type TEXT NOT NULL`
  - `timestamp INTEGER NOT NULL`
  - `details TEXT`

Implemented APIs:
- `initDB()`
- `getWorkerByEmployeeId(employeeId)`
- `getAllWorkers()`
- `saveWorker()`
- `enrollWorker(employeeId, name, department, passcode, embedding)`
- `logAttendance({ workerId, employeeId, workerName, gpsLat, gpsLng, confidence })`
- `getAttendanceHistory(limit)`
- `getRecentAttendance(limit)`
- `getPendingCount()`
- `getUnsyncedCount()`
- `getUnsyncedAttendance()`
- `getUnsyncedRecords()`
- `markSynced(ids)`
- `deleteSynced()`
- `logFailure(type, details)`
- `getFailureLog(limit)`
- `setConfig(key, value)`
- `getConfig(key)`
- `deleteConfig(key)`

## Current Screens
- `LaunchScreen.js`
  - FaceAuth branded launch/loading screen.
- `OnboardingScreen.js`
  - Worker/admin mode selector.
  - Worker login with employee ID + passcode.
  - Admin login with PIN.
- `AuthScreen.js`
  - Worker dashboard.
  - Good Morning/Afternoon/Evening greeting.
  - Worker name and initials profile badge.
  - Pending count badge.
  - Mounts `CameraView`.
- Current Verify flow shows a random active liveness prompt before capture.
- Challenge options: blink, turn left, turn right, smile.
- The challenge is currently a UI gate only; it still needs FaceMesh/liveness-model validation.
- After challenge is armed, Verify captures a photo, requires live model output, checks liveness score, checks stored worker embedding, and only logs attendance on match.
  - GPS is attempted through `expo-location`.
  - Logs failures to `failure_log`.
  - Has basic failed-attempt count and short lockout.
- Important gap: it asks for blink/turn/smile, but does not yet detect that gesture from model output.
- `CameraView.js`
  - Defensive VisionCamera wrapper.
  - Lazy-requires `react-native-vision-camera`.
  - Shows fallback if camera module is unavailable, permission missing, or no front camera.
  - Exposes `capturePhoto()` through ref.
- `EnrollScreen.js`
  - Worker enrollment form.
  - Admin PIN flow when opened from worker mode.
  - Admin mode skips PIN.
  - Requires name, employee ID, optional department, worker passcode.
  - Simulates 5-frame capture.
  - Saves worker to SQLite.
- Important gap: does not capture real frames or create embedding yet.
- Duplicate guard now blocks same normalized worker name.
- Duplicate face guard exists in `DatabaseService.findPotentialDuplicateWorker()` and will block when embeddings are supplied.
- Enroll now mounts live camera inference and captures 5 live embeddings, averages them, and stores the average in `workers.embedding`.
- `HistoryScreen.js`
  - Reads SQLite attendance.
  - Pull-to-refresh.
  - Shows pending/synced counts.
  - Shows recent failure issues.
- `AccountScreen.js`
  - Shows current worker/admin session.
  - Switch Worker / Exit Admin.
- `BottomNav.js`
  - Custom React Navigation tab bar.
- `SuccessScreen.js`
  - Exists but is not currently central to navigation.

## Current Sync
- `SyncService.js` listens to NetInfo.
- Uses `syncInProgress` guard.
- Uploads unsynced attendance to Supabase.
- Marks synced and deletes local synced rows after success.
- Has fallback for old Supabase schema missing `employee_id`.
- Important gap: remote Supabase attendance table should still be updated properly.

## Native / Config State
- `metro.config.js` includes `.tflite` asset extension.
- `app.json` includes:
  - `expo-sqlite`
  - `expo-secure-store`
  - `react-native-vision-camera`
  - Android permissions: Camera, coarse location, fine location.
- `android/app/src/main/AndroidManifest.xml` includes:
  - Camera permission
  - Record audio permission
  - Coarse location permission
  - Fine location permission

## Verified By Codex
On 30 May 2026:
- `node --check` passed for `App.js`.
- `node --check` passed for all `src/**/*.js`.
- `app.json` parsed successfully.
- Model files exist in `assets/models`.
- Expo SDK 56 docs were checked as required by `AGENTS.md`.

## Latest User Concern
User correctly noticed:
- Verify previously approved after one photo capture.
- It did not ask for blink, tilt, smile, or any active liveness challenge.
- It could approve the same real person under different employee names/IDs because real embeddings and duplicate matching were not implemented.

Current patch:
- `AuthScreen.js` now shows a random active challenge before capture.
- `DatabaseService.js` now has duplicate identity helper logic.
- `EnrollScreen.js` now blocks duplicate worker names and is ready to surface duplicate face errors.

Still required: A UI-only challenge prompt is not enough for PRD. The real fix requires:
- Capture frame/image.
- Run FaceMesh or liveness model.
- Detect blink/head turn/smile.
- Run MobileFaceNet.
- Compare embedding against logged-in worker.
- During enrollment, compare new embedding against all existing worker embeddings and block duplicates above threshold.

## Current High-Priority Gaps
1. Real active gesture validation.
   - Need random challenge: blink, turn left/right, smile.
   - Need actual gesture detection using FaceMesh landmarks.
   - Need timeout and failure logging.

2. Real face recognition.
   - Live MobileFaceNet embedding is wired from center-cropped frame.
   - Need proper BlazeFace detection/crop instead of center crop.
   - Need confirm model normalization and threshold with Person 1.
   - Need threshold from Person 1.

3. Real enrollment quality.
   - 5 live embeddings are captured and averaged now.
   - Need proper face crop and quality checks.
   - Need validate duplicate face threshold with real data.

4. Camera validation on physical Vivo V30.
   - ADB sees phone serial: `10BE6DF610008Z`.
   - Emulator also connected: `emulator-5554`.
   - If Expo cannot target serial using `--device`, set:
     `set ANDROID_SERIAL=10BE6DF610008Z`
     then run:
     `npx expo run:android`

5. Supabase schema.
   - Local schema has `employee_id`.
   - Remote schema may not.
   - Fallback exists but proper SQL migration is still needed.

6. Documentation and demo.
   - README, integration guide, benchmark table, PPT/PDF, demo video still needed.

7. iOS.
   - EAS iOS/Appetize build not done.

## Recommended Next Work Order
1. Rebuild Android after new native dependencies:
   `npx expo run:android`
2. Enroll EMP001 again so it has a real `workers.embedding`.
3. Test Verify with the same enrolled worker.
4. Confirm liveness output direction with Person 1.
5. Confirm MobileFaceNet threshold with Person 1.
6. Wire FaceMesh landmark interpretation for blink/head-turn/smile.
7. Add BlazeFace crop instead of center crop.
8. Update Supabase schema.
9. Finish docs and demo video.

## Important Commands
Use Java 17:
`C:\Users\hp\AppData\Local\Programs\Eclipse Adoptium\jdk-17.0.19.10-hotspot`

Start Metro clean:
```bat
npx expo start --clear --dev-client
```

Run Android:
```bat
npx expo run:android
```

Target Vivo V30 when emulator is also attached:
```bat
set ANDROID_SERIAL=10BE6DF610008Z
npx expo run:android
```

Check ADB:
```bat
adb devices
```

If `adb` is not recognized:
```bat
%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe devices
```

Focused Kotlin check:
```bat
cd android
gradlew.bat :app:compileDebugKotlin --console=plain
```

Pull ML branch:
```bat
git fetch origin ml/person1
git checkout FETCH_HEAD -- ml/models/tflite
copy ml\models\tflite\*.tflite assets\models\
```

## Worktree Notes
Worktree is dirty and contains active hackathon work.

Known changed/untracked areas:
- `AGENTS.md`
- `context.md`
- `App.js`
- `app.json`
- `android/app/src/main/AndroidManifest.xml`
- `metro.config.js`
- `package.json`
- `package-lock.json`
- `src/bridges/ModelBridge.js`
- `src/components/CameraView.js`
- `src/components/BottomNav.js`
- `src/screens/LaunchScreen.js`
- `src/screens/OnboardingScreen.js`
- `src/screens/AuthScreen.js`
- `src/screens/EnrollScreen.js`
- `src/screens/HistoryScreen.js`
- `src/screens/AccountScreen.js`
- `src/screens/SuccessScreen.js`
- `src/services/DatabaseService.js`
- `src/services/SyncService.js`
- `assets/models/`
- `ml/models/tflite/`
- `android/.kotlin/` generated logs

Do not revert unrelated changes. Do not expose Supabase keys in messages or docs.
