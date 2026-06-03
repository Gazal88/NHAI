# context.md - FaceAuthModule Current Handoff

Date: 03 June 2026
Project: FaceAuthModule
Hackathon: Hackathon 7.0
Deadline: 05 June 2026
Role: Person 2 - App Dev Lead
Repo branch: app/person2
Remote: https://github.com/Gazal88/NHAI.git

---

## One Line Status
Working offline-first Android prototype. All core features implemented: login, enrollment, face recognition, liveness check, gesture challenge, GPS attendance, SQLite, Supabase sync, admin mode, history, account. Models loaded and running on-device. Face matching works at threshold 0.45. Sync fixed with explicit column mapping. No internal scores shown to users.

---

## CRITICAL: Non-Negotiable Before Writing Any Code
Read exact SDK docs first: https://docs.expo.dev/versions/v56.0.0/

---

## What Is Left To Do (Deadline: 05 June 2026)

### Must Do Before Submission
1. **iOS EAS build** — run `eas build --platform ios --profile preview`, upload .ipa to appetize.io
2. **INTEGRATION.md** — how Datalake 3.0 imports the module, props API, npm install steps
3. **PPT 12 slides** — problem, solution, architecture, liveness design, model specs, benchmarks, innovation, limitations, demo plan, integration, team, tech stack
4. **Demo video** — 6 steps on Vivo V30 (airplane mode, spoof rejected, real face accepted, outdoor, WiFi on, sync, Supabase dashboard)
5. **README update** — inference pipeline description is slightly outdated (still mentions crop)
6. **Re-enroll worker after rebuild** — new models from Person 1 = old embeddings invalid

### Nice To Have
- Update benchmark table in README with real Vivo V30 numbers once tested

---

## Demo Credentials
- Worker: EMP001 / 1234 (Rajesh Kumar, Engineering)
- Admin PIN: ADMIN1234

---

## Current Tech Stack
- Expo SDK 56.0.4, React Native 0.85.3, React 19.2.3
- Camera: react-native-vision-camera v4
- TFLite: react-native-fast-tflite v3
- Frame resize: vision-camera-resize-plugin v3
- Worklets: react-native-worklets-core v1
- SQLite: expo-sqlite SDK 56
- GPS: expo-location SDK 56
- Sync: @supabase/supabase-js v2 + @react-native-community/netinfo v12
- Navigation: @react-navigation/native + bottom tabs

---

## Model Files (Person 1 Final — Pull From ml/person1 Branch)

Pull command:
```bat
git fetch origin ml/person1
git checkout FETCH_HEAD -- ml/models/tflite
copy ml\models\tflite\*.tflite assets\models\
```

| Model | File | Size | Input | Output | Notes |
|---|---|---|---|---|---|
| BlazeFace | blazeface.tflite | 229 KB | [1,128,128,3] float32 | [1,896,16] float32 | Face detection only, MediaPipe unmodified |
| FaceMesh | facemesh.tflite | 1.2 MB | [1,192,192,3] float32 | [1,1,1,1404] float32 | Bundled, NOT used in live path |
| Liveness | liveness.tflite | 1.71 MB | [1,224,224,3] float32 | [1,1] float32 | Raw LOGIT output — MUST apply sigmoid |
| MobileFaceNet | mobilefacenet.tflite | 2.89 MB | [1,112,112,3] float32 | [1,128] float32 | L2-normalised output — dot product = cosine |
| **Total** | | **6.08 MB** | | | Under 20 MB ✓ |

### CRITICAL Model Facts From Person 1
- **Liveness outputs RAW LOGITS** — NOT sigmoid probabilities. MUST apply sigmoid in JS:
  `score = 1 / (1 + Math.exp(-rawLogit))`
  Real face after sigmoid: > 0.65. Spoof: < 0.40.
- **MobileFaceNet is L2-normalised** — dot product equals cosine similarity. Different people score 0.00 to -0.18. Same person (ideal): ~0.99 but real camera captures score 0.50-0.70.
- **Liveness trained on SYNTHETIC data** (3000 real + 3000 spoof synthetic images, NOT CelebA-Spoof — Google Drive was rate limited). 100% TPR/TNR on synthetic test set only. Real-world performance unknown.
- **Recognition tested on same-image+noise only** — NOT real diverse face pairs. 99% was unrealistic lab number.
- FaceMesh output shape is [1,1,1,1404] — reshape to 468×3 landmarks if ever used.
- CoreML not available (coremltools requires Mac OS). iOS uses same TFLite files via react-native-fast-tflite.

---

## Current Inference Pipeline (CameraView.js)

Two separate ticks per camera frame:

**Tick A — BlazeFace (every 250ms):**
- Runs BlazeFace on full frame at 128×128
- Updates `faceDetectedFlag` shared value
- Does NOT affect liveness or recognition input
- Used only for "Face ✓" indicator in UI

**Tick B — Liveness + Recognition (every 350ms):**
- Always uses FULL FRAME — no crop
- This is critical: enroll and verify must use same input distribution so embeddings match
- Liveness: resize to 224×224, run model, apply sigmoid to raw logit output
- Recognition: resize to 112×112, run model, get 128-float L2-normalised embedding
- Reports to UI: `{ ready, livenessScore (sigmoid), embedding, faceDetected }`

Models are preloaded during LaunchScreen via ModelCache.js (background, fire-and-forget).

---

## Current Thresholds

| Constant | Value | Location | Notes |
|---|---|---|---|
| LIVENESS_THRESHOLD | 0.55 | AuthScreen.js | After sigmoid. Real face > 0.65 per Person 1, relaxed to 0.55 for camera variation |
| RECOGNITION_THRESHOLD | 0.45 | AuthScreen.js | Dot product. Real camera same-person scores 0.50-0.70, different people 0.00 to -0.18 |
| CHALLENGE_CONFIDENCE_MIN | 0.65 | AuthScreen.js | Min liveness during 3s challenge window — requires 2+ readings above this |
| BLAZEFACE_SCORE_THRESHOLD | 0.35 | CameraView.js | Face detection confidence |
| ACTIVE_CHECK_MS | 3000 | AuthScreen.js | Challenge window duration |
| RECOGNITION_THRESHOLD | 0.75 | CameraView.js | Reported in inference object (not used for matching — AuthScreen uses its own 0.45) |
| Duplicate face threshold | 0.45 | DatabaseService.js | findPotentialDuplicateWorker default |

---

## Challenge / Liveness System

### How it works
1. User taps "Start Verification" — random challenge shown (Blink / Turn Left / Turn Right)
2. 3 second window starts — liveness scores collected every 350ms
3. At window end: check if at least 2 readings >= 0.65 (CHALLENGE_CONFIDENCE_MIN)
4. If yes → challenge confirmed, "Mark Attendance" button enabled
5. If no → challenge resets, user must retry with better lighting/positioning
6. On capture: liveness score must be >= 0.55 AND face match >= 0.45

### Why smile was removed
The liveness model cannot detect smile — it's a binary real/spoof classifier, not a gesture detector. Smile doesn't cause any change in real/spoof score. Only blink and head turn cause brief score changes (face partially occluded).

### Why variance detection was abandoned
Liveness was trained on synthetic JPEG-artifact data — score variance on a real camera is too small and inconsistent. The timed window + minimum liveness score approach is more reliable.

---

## Current App Flow
1. LaunchScreen (DB init + model preload)
2. OnboardingScreen (Worker login: ID + passcode | Admin login: PIN)
3. **Worker Dashboard** (3 tabs):
   - **Verify** — face recognition attendance. Shows "already marked today" guard if attendance already logged. Shows "face not enrolled" warning if no embedding.
   - **MyHistory** — filtered to this worker's records only. No sync banner.
   - **Profile** — name, ID, dept, face enrolled status, today's attendance status, explicit red Logout button.
4. **Admin Dashboard** (4 tabs):
   - **Overview** — today count, active workers, pending sync, recent 5 records, Sync Now button.
   - **Workers** — searchable list, "✓ Enroll" button opens EnrollScreen as a modal slide-up, Remove per worker.
   - **Attendance** — full log (all workers), date filter (Today/Week/All), sync banner, failure log section.
   - **Settings** — session info, app version, failure log count, clear failures, explicit red Logout button.

## New Screens Added
- `src/screens/AdminOverviewScreen.js` — admin stats dashboard
- `src/screens/ProfileScreen.js` — worker profile + logout
- `src/screens/SettingsScreen.js` — admin settings + logout
- `src/screens/WorkersScreen.js` — updated with search + Enroll button

## RBAC Changes
- Worker tabs: Verify, MyHistory, Profile (no Enroll tab, no admin data)
- Admin tabs: Overview, Workers, Attendance, Settings (no Verify tab)
- Worker History filtered by employee_id — cannot see other workers' records
- Enroll is admin-only — no standalone tab, opened as modal from Workers tab
- Explicit Logout button in Profile (worker) and Settings (admin)

## New Features
- Already-marked-today guard in AuthScreen — if worker marked attendance today, camera is replaced with green confirmation screen, button disabled
- No-template warning in AuthScreen — if worker has no face enrolled, shows amber warning instead of camera
- Date filter in Admin Attendance (Today / This Week / All)
- Search in Workers list by name or ID
- Enroll as modal slide-up from Workers tab (not standalone tab)
- onDone callback on EnrollScreen — modal closes after successful enrollment
- Close button (✕) on EnrollScreen when opened as modal

---

## Database (SQLite — faceauth.db)

Tables: workers, attendance, app_config, failure_log

Key: workers.embedding is JSON array of 128 floats (L2-normalised MobileFaceNet output)

DatabaseService uses **dot product** (not full cosine) for similarity — correct for L2-normalised vectors.

---

## Sync (SyncService.js)

- NetInfo listener — fires syncNow() only on offline→online transition
- syncNow() maps SQLite records to exact Supabase columns (id, worker_id, employee_id, worker_name, timestamp, gps_lat, gps_lng, confidence)
- Drops local-only `synced` field before sending
- Full error logging: code, message, details, hint all logged to Metro console
- onSyncStateChange() pub/sub — HistoryScreen subscribes and shows live banner
- deleteSynced() keeps records for 24h after sync so UI can show "✓ Synced"

### Supabase Table: attendance
All columns exist and confirmed:
id TEXT, worker_id TEXT NOT NULL, employee_id TEXT, worker_name TEXT,
timestamp BIGINT NOT NULL, gps_lat FLOAT, gps_lng FLOAT, confidence FLOAT,
synced INTEGER, device_id TEXT, created_at TIMESTAMP

RLS must have these policies (run in SQL Editor if sync fails):
```sql
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon insert" ON attendance;
DROP POLICY IF EXISTS "Allow anon select" ON attendance;
CREATE POLICY "Allow anon insert" ON attendance FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon select" ON attendance FOR SELECT TO anon USING (true);
```

### Sync Troubleshooting
If "[Sync] No unsynced records found" — mark attendance first, then check History tab for "Pending" banner
If sync fails silently — check Metro console for [Sync] error/code/message/hint lines
Supabase credentials in src/services/config.js (gitignored)

---

## UI Notes
- Theme: olive green (#5C6B3A) + off-white (#F5F5E8) — DO NOT change
- NO internal scores shown to users (no liveness %, no match %)
- Scores still logged to Metro console for debugging
- Camera overlay shows "Face detected" (not "Face detected · 73% live")
- Success alert shows: worker name + time + "Location recorded"
- Fail alert (face): "We could not verify your identity. Face camera directly..."
- Fail alert (liveness): "Please face the camera directly in good lighting..."

---

## Files Changed (Dirty Worktree)
- App.js — full rewrite: worker 3 tabs, admin 4 tabs, EnrollScreen as modal
- src/components/BottomNav.js — unicode icons, new tab names
- src/screens/AuthScreen.js — already-marked-today guard, no-template guard, checkTodayRecord
- src/screens/HistoryScreen.js — workerFilter prop, showSync prop, showFailures prop, date filter
- src/screens/EnrollScreen.js — onDone prop, close button for modal use
- src/screens/WorkersScreen.js — search bar, Enroll button, onEnrollNew prop
- src/screens/OnboardingScreen.js — removed demo hint
- src/screens/ProfileScreen.js — NEW: worker profile + logout
- src/screens/SettingsScreen.js — NEW: admin settings + logout
- src/screens/AdminOverviewScreen.js — NEW: admin stats dashboard
- src/services/DatabaseService.js — added getAttendanceByEmployee, getTodayAttendanceByEmployee, getAttendanceSummary, getRecentAttendanceAll
- src/services/SyncService.js — explicit column mapping, full error logging, pub/sub state
- src/services/ModelCache.js — background model preload during launch
- src/services/config.js — Supabase credentials (NOT gitignored — needed for EAS build)
- src/services/config.example.js — template for teammates
- src/screens/AccountScreen.js — REPLACED by ProfileScreen + SettingsScreen (file still exists but no longer used)

---

## Important Commands

Build + run on Vivo V30:
```bat
set JAVA_HOME=C:\Users\hp\.gradle\jdks\eclipse_adoptium-17-amd64-windows.2
set ANDROID_SERIAL=10BE6DF610008Z
npm run android
```

Metro clean:
```bat
npx expo start --clear --dev-client
```

ADB check:
```bat
%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe devices
```

Kotlin compile check:
```bat
cd android
set JAVA_HOME=C:\Users\hp\.gradle\jdks\eclipse_adoptium-17-amd64-windows.2
gradlew.bat :app:compileDebugKotlin --console=plain
```

iOS EAS build (run this — takes ~20 min on Expo servers, no Mac needed):
```bat
eas build --platform ios --profile preview
```

Pull Person 1 models:
```bat
git fetch origin ml/person1
git checkout FETCH_HEAD -- ml/models/tflite
copy ml\models\tflite\*.tflite assets\models\
```

---

## Known Remaining Gaps

| Priority | Gap | Notes |
|---|---|---|
| HIGH | iOS build not done | Run eas build command above |
| HIGH | INTEGRATION.md missing | How Datalake 3.0 imports module |
| HIGH | PPT 12 slides missing | Person 1's benchmark numbers available |
| HIGH | Demo video not recorded | 6-step script in README |
| MEDIUM | Sync pending issue | If "No unsynced records" — records may already be synced or not logged yet |
| MEDIUM | Recognition accuracy on real diverse faces unknown | Person 1 tested on synthetic only |
| MEDIUM | Liveness on real spoofs unknown | Trained on synthetic JPEG-artifact data |
| LOW | Worker passcodes in plain SQLite | expo-secure-store installed but unused |
| LOW | README inference pipeline description slightly outdated | Still mentions crop |

---

## Person 1 (ML Lead) Status
- Available: NO (offline from 03 June 2026)
- All models pushed to ml/person1 branch ✅
- Benchmark numbers available (synthetic test — see ACTUAL-EXECUTION-REPORT.md)
- Pipeline speed: ~119ms total (BlazeFace 2.6ms, FaceMesh 80ms, Liveness 29.6ms, MobileFaceNet 6.4ms)
- No CoreML — TFLite works on iOS via react-native-fast-tflite

---

## Collaboration Rules
- DO NOT edit /ml/ folder
- Copy models from ml/models/tflite to assets/models — never move
- Keep olive green/off-white theme
- DO NOT expose Supabase keys in docs or messages
- Preserve dirty worktree — do not revert unrelated changes
- Always Babel syntax check after editing JS: node -e "const babel=require('@babel/core');const fs=require('fs');babel.transformSync(fs.readFileSync('FILE','utf8'),{filename:'FILE',presets:['babel-preset-expo']});console.log('OK')"
