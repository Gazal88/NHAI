# AGENTS.md - FaceAuthModule App Dev Lead Context

## Non-Negotiable Instruction
Before writing Expo/React Native code, read the exact versioned Expo docs for this project:
https://docs.expo.dev/versions/v56.0.0/

## Project
- App name: FaceAuthModule
- Hackathon: Hackathon 7.0
- Deadline: 05 June 2026
- Role owner: Person 2, App Dev Lead
- Teammate: Person 1, ML models and training
- Repo branch: app/person2
- Remote: https://github.com/Gazal88/NHAI.git
- Objective: React Native offline facial recognition attendance module for field workers in zero-network areas.

## Brief / PRD Requirements
Source files:
- `C:\Users\hp\Downloads\hackathon_doc7.pdf`
- `C:\Users\hp\Downloads\Person2_AppDev_Workplan.docx`
- `C:\Users\hp\Downloads\files (2)\Hackathon7_PRD_Final.docx`

Mandatory requirements:
- React Native cross-platform prototype for Android and iOS.
- Offline facial recognition and offline liveness detection.
- Basic anti-spoofing: blink, smile, or head turn.
- Model footprint target around 20 MB or less.
- Face recognition + liveness under 1 second on mid-range devices.
- Android 8+, iOS 12+, minimum 3 GB RAM, no high-end GPU.
- Accuracy target above 95%.
- Reliable outdoor lighting and diverse Indian demographics.
- Open-source technologies only.
- Sync/purge mechanism after network connectivity returns.
- Source code, PPT/PDF, technical docs, model architecture, integration steps, benchmarks.

## Current Tech Stack
- Expo SDK: 56.0.4
- React Native: 0.85.3
- React: 19.2.3
- Navigation: `@react-navigation/native` + bottom tabs
- Camera: `react-native-vision-camera` v4
- Inference: `react-native-fast-tflite` v3
- Frame resize: `vision-camera-resize-plugin`
- Worklets: `react-native-worklets-core`
- Local DB: `expo-sqlite`
- Location: `expo-location`
- Secure storage: `expo-secure-store` installed, not yet fully used
- Sync: `@supabase/supabase-js` + `@react-native-community/netinfo`

## Current App Flow
1. Launch screen shows FaceAuth branding while DB initializes.
2. `App.js` initializes SQLite before rendering login.
3. `App.js` lazy-loads TFLite models after boot to avoid Nitro startup crashes.
4. First page has two modes:
   - Worker login: Employee ID + worker passcode.
   - Admin login: Admin PIN.
5. Seed worker:
   - Employee ID: `EMP001`
   - Name: Rajesh Kumar
   - Department: Engineering
   - Passcode: `1234`
6. Admin PIN:
   - `ADMIN1234`
7. Worker mode tabs:
   - Verify
   - Enroll
   - History
   - Account
8. Admin mode tabs:
   - Enroll
   - History
   - Account
   - No Verify tab because admin may not be a field worker.
9. Account tab:
   - Shows current worker/admin session.
   - Allows Switch Worker / Exit Admin.

## Current Models
Model files exist in both:
- `assets/models/`
- `ml/models/tflite/`

Files:
- `blazeface.tflite` - 229,032 bytes
- `facemesh.tflite` - 1,242,398 bytes
- `liveness.tflite` - 1,709,800 bytes
- `mobilefacenet.tflite` - 2,894,904 bytes

Total app model bundle is about 6.08 MB, below the 20 MB target.

ModelBridge status:
- `loadModels()` loads all four with `react-native-fast-tflite` using CPU delegates `[]`.
- `react-native-fast-tflite` is required lazily inside `ModelBridge.js`.
- `App.js` does not import `ModelBridge.js` at top level.
- `runLiveness(imageData)` and `runRecognition(imageData)` remain available helper APIs.
- BlazeFace and FaceMesh are loaded, but no detection/landmark post-processing pipeline is implemented.
- `CameraView.js` now uses VisionCamera frame processors to resize live frames and run liveness + MobileFaceNet directly.
- Live inference returns latest liveness score and embedding to `AuthScreen.js` / `EnrollScreen.js`.

## Current Database
SQLite database name: `faceauth.db`

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

Implemented DatabaseService APIs:
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
  - Branded launch/loading screen.
- `OnboardingScreen.js`
  - Worker/Admin mode selector.
  - Worker login with employee ID + passcode.
  - Admin login with PIN.
- `AuthScreen.js`
  - Worker dashboard with greeting, name, initials profile badge.
  - CameraView mounted.
- Verify flow now shows a random active liveness challenge before capture.
- Challenge options: blink, turn left, turn right, smile.
- Challenge is currently a UI gate only; FaceMesh/liveness-model validation is still pending.
- After challenge is armed, Verify captures a photo, requires live liveness score, requires a stored worker embedding, compares embeddings, and only logs attendance on pass.
  - GPS is attempted via `expo-location`.
  - Failure attempts are logged and can trigger short lockout.
  - Not yet true biometric auth.
- `CameraView.js`
  - Defensive VisionCamera wrapper.
  - Lazy-requires native camera module.
  - Shows fallback if native camera module is not ready or no front camera exists.
  - Exposes `capturePhoto()` through ref.
- `EnrollScreen.js`
  - Admin PIN flow when opened by worker mode.
  - Skips PIN if already in admin mode.
  - Captures simulated 5-frame progress.
  - Requires name, employee ID, optional department, worker passcode.
- Enroll captures 5 live embeddings from camera inference, averages them, and stores them in SQLite.
- Duplicate worker-name guard is active.
- Duplicate face guard exists in DatabaseService and will work once embeddings are supplied.
- `HistoryScreen.js`
  - Reads real local SQLite attendance.
  - Pull-to-refresh.
  - Shows records, pending count, synced/pending status.
  - Shows recent failures from `failure_log`.
- `AccountScreen.js`
  - Shows worker/admin session.
  - Switch Worker / Exit Admin.
- `BottomNav.js`
  - React Navigation custom tab bar.
- `SuccessScreen.js`
  - Exists but is not currently central to navigation.

## Current Sync
- `SyncService.js` listens to NetInfo and syncs unsynced attendance rows to Supabase.
- Uses `syncInProgress` guard.
- Marks synced and deletes local synced rows only after Supabase insert succeeds.
- Has fallback for older Supabase attendance table missing `employee_id` column.
- Supabase schema should still be updated properly; fallback is a prototype compatibility patch.

## Native / Config Notes
- `metro.config.js` includes `.tflite` in asset extensions.
- `app.json` includes Android permissions for camera and location.
- `android/app/src/main/AndroidManifest.xml` includes camera, audio, coarse location, and fine location permissions.
- Physical phone detected by ADB:
  - Vivo V30 serial: `10BE6DF610008Z`
  - Emulator: `emulator-5554`
- If both are connected and Expo cannot target by `--device`, use:
  ```bat
  set ANDROID_SERIAL=10BE6DF610008Z
  npx expo run:android
  ```

## Known Current Problems / Gaps
High priority:
- Verify asks for blink/head-turn/smile, but does not yet detect the specific gesture from FaceMesh output.
- Verify does not run real BlazeFace, FaceMesh, liveness, or MobileFaceNet on camera frames.
- Same real person should now be blocked during enrollment if embeddings match above threshold, but threshold still needs validation with Person 1 data.
- Enrollment blocks same normalized worker name now.
- Enrollment can block duplicate face once real embeddings are generated and passed to `enrollWorker`.
- No real face crop preprocessing/resizing for model inputs.
- Enroll captures simulated frames only.
- Supabase remote schema is not fully aligned with local schema.
- iOS EAS/Appetize build not completed.

Medium priority:
- SecureStore is installed but worker passcodes are stored plain in SQLite for prototype.
- Need production-safe auth design if this goes beyond demo.
- Camera permission/no-device UX exists but needs more physical-device testing.
- README, integration guide, benchmark table, PPT, demo video not done.
- Public repo/open-source compliance cleanup still pending.

## Next Recommended Implementation
1. Rebuild Android after native dependency changes:
   ```bat
   npx expo run:android
   ```
2. Re-enroll EMP001 so it has a real face embedding.
3. Verify EMP001 using the enrolled template.
4. Wire active challenge to actual FaceMesh output:
   - Blink via EAR.
   - Head turn via landmark geometry.
   - Smile if model/landmarks support it.
5. Add BlazeFace crop instead of current center crop.
6. Confirm liveness and recognition thresholds with Person 1.
7. Update Supabase schema.
8. Finish docs, benchmark table, PPT/PDF, and demo video.

## Important Commands
Use JDK 17:
`JAVA_HOME` should point to:
`C:\Users\hp\AppData\Local\Programs\Eclipse Adoptium\jdk-17.0.19.10-hotspot`

Run app:
```bat
npx expo run:android
```

Target Vivo V30:
```bat
set ANDROID_SERIAL=10BE6DF610008Z
npx expo run:android
```

Start Metro clean:
```bat
npx expo start --clear --dev-client
```

Check ADB:
```bat
adb devices
```

If `adb` is unavailable:
```bat
%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe devices
```

Focused Android Kotlin check:
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

## Collaboration Rules
- Preserve user changes. The worktree is dirty and contains active hackathon work.
- Do not revert unrelated files.
- Do not edit `/ml` except when explicitly checking out or copying model files from Person 1.
- Copy models from `ml/models/tflite` to `assets/models`; do not move them.
- Keep UI olive green/off-white theme.
- Avoid exposing Supabase keys in docs or final messages.
- Use `apply_patch` for manual edits.

## Current Status Tag
Working prototype shell: DB, login, admin mode, model assets/loading, camera wrapper, local attendance logging, history, sync fallback, launch/account polish, Android permissions.

Not yet PRD-complete: active liveness, real offline biometric verification, duplicate-face prevention, real enrollment embeddings, iOS build, benchmarks, docs, PPT, and demo video.
