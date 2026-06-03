# FaceAuthModule

Offline facial recognition and liveness detection module for NHAI field workers.
Built for **Hackathon 7.0** — Submission: 05 June 2026.

---

## Overview

FaceAuthModule enables field workers to mark attendance using face recognition — entirely offline, with no network dependency at the point of capture. Records sync automatically to the cloud when connectivity returns.

**Key capabilities**

- Fully offline face recognition using on-device MobileFaceNet embeddings
- Real-time liveness detection to reject photo and screen spoofing attacks
- Active anti-spoofing challenge (random blink / head turn per session)
- BlazeFace face detection running alongside inference
- Worker enrollment with 5-frame averaged embeddings and duplicate-face guard
- Admin mode — enroll workers, manage roster, view attendance history
- GPS-tagged attendance records
- Automatic cloud sync with purge on confirmation

---

## Tech Stack

| Layer | Library | Version |
|---|---|---|
| Framework | React Native (Expo) | 0.85.3 / SDK 56.0.4 |
| Camera | react-native-vision-camera | v4 |
| TFLite inference | react-native-fast-tflite | v3 |
| Frame resize | vision-camera-resize-plugin | v3 |
| Worklets | react-native-worklets-core | v1 |
| Local DB | expo-sqlite | SDK 56 |
| GPS | expo-location | SDK 56 |
| Cloud sync | @supabase/supabase-js | v2 |
| Network detection | @react-native-community/netinfo | v12 |

---

## Model Bundle

All models are open-source, bundled in `assets/models/`, and run fully on-device.

| Model | File | Size | Purpose |
|---|---|---|---|
| BlazeFace | `blazeface.tflite` | 229 KB | Real-time face detection |
| FaceMesh | `facemesh.tflite` | 1.2 MB | Landmark detection (bundled) |
| Liveness | `liveness.tflite` | 1.7 MB | Real vs spoof classification |
| MobileFaceNet | `mobilefacenet.tflite` | 2.9 MB | 128-dim face embedding |
| **Total** | | **~6.1 MB** | Well under 20 MB brief requirement |

---

## Performance

| Metric | Target | Result |
|---|---|---|
| Model bundle size | < 20 MB | 6.1 MB |
| End-to-end pipeline | < 1000 ms | ~119 ms |
| BlazeFace latency | — | 2.6 ms |
| Liveness latency | — | 29.6 ms |
| MobileFaceNet latency | — | 6.4 ms |
| Cold start to camera | < 3 s | ~2 s (with preload) |

---

## Requirements

- Android 8.0+ (API 26+) or iOS 12+
- Minimum 3 GB RAM
- Front camera
- No GPU required — CPU inference only

---

## Setup

### 1. Clone and install

```bat
git clone https://github.com/Gazal88/NHAI.git
cd NHAI
git checkout app/person2
npm install
```

### 2. Supabase credentials

```bat
copy src\services\config.example.js src\services\config.js
```

Edit `src/services/config.js` with your Supabase project URL and anon key.

### 3. Run on Android

```bat
set JAVA_HOME=C:\Users\hp\.gradle\jdks\eclipse_adoptium-17-amd64-windows.2
npm run android
```

### 4. Run on iOS (EAS cloud build — no Mac required)

```bat
eas build --platform ios --profile preview
```

Upload the resulting `.ipa` to [appetize.io](https://appetize.io) to test in browser.

---

## Demo Credentials

| Role | Field | Value |
|---|---|---|
| Worker | Employee ID | `EMP001` |
| Worker | Passcode | `1234` |
| Admin | PIN | `ADMIN1234` |

---

## App Flow

```
LaunchScreen  →  OnboardingScreen
                      ├── Worker Login (ID + passcode)
                      │       └── Verify | Enroll | History | Account
                      └── Admin Login (PIN)
                              └── Enroll | Workers | History | Account
```

### Verify Attendance (Worker)

1. Open Verify tab — camera starts, models load in background
2. Tap **Start Verification** — random challenge shown (Blink or Turn Head)
3. Perform the gesture within 3 seconds while keeping face in frame
4. Liveness check confirms real face presence
5. Tap **Mark Attendance** — face embedding compared to enrolled template
6. On pass: attendance logged to SQLite with GPS and timestamp

### Enroll Worker (Admin)

1. Admin login or admin PIN gate on Enroll tab
2. Enter worker details — name, employee ID, department, passcode
3. Capture 5 live frames — each requires face detected and liveness confirmed
4. Embeddings averaged and stored — duplicate face check runs before save

---

## Inference Pipeline

Two concurrent operations per camera frame:

**Face Detection (every 250 ms):**
BlazeFace runs at 128×128 on the full frame to provide real-time face presence indicator.

**Liveness + Recognition (every 350 ms):**
Full frame is resized to model input dimensions. Liveness model returns real/spoof classification. MobileFaceNet returns 128-dimensional L2-normalised face embedding. Both run on CPU with no GPU dependency.

Models are preloaded during the launch screen so the camera is inference-ready within seconds of login.

---

## Liveness System

The active anti-spoofing system combines two layers:

**Layer 1 — Gesture challenge:**
A random gesture (blink or head turn) is selected each session. The user must perform it within a 3-second window. Random selection per session prevents replay attacks using pre-recorded video.

**Layer 2 — Liveness score:**
The liveness model runs continuously and must confirm real face presence throughout the challenge window and at the moment of capture. Static photos and screen replays fail this check.

---

## Database

SQLite file: `faceauth.db` (WAL mode enabled)

| Table | Purpose |
|---|---|
| `workers` | Worker profiles and face embeddings |
| `attendance` | Attendance records with GPS, timestamp, confidence |
| `app_config` | Key-value store (saved session) |
| `failure_log` | Failed verification attempts for audit |

---

## Sync Architecture

`SyncService.js` monitors network connectivity and syncs automatically when the device comes online.

- Triggers only on offline → online transition (not on every connectivity event)
- Uploads all unsynced attendance rows to Supabase in a single batch
- Marks records as synced and removes them locally **only after server confirmation**
- Never purges on timeout or network error — data safety first
- Live sync status shown in History screen

---

## Architecture

```
App.js
├── LaunchScreen          — splash + DB init + background model preload
├── OnboardingScreen      — worker / admin login
└── NavigationContainer
    ├── AuthScreen        — verify attendance
    │   └── CameraView    — BlazeFace + Liveness + MobileFaceNet
    ├── EnrollScreen      — worker enrollment (admin gated)
    │   └── CameraView
    ├── WorkersScreen     — worker roster management (admin)
    ├── HistoryScreen     — attendance log + sync status
    └── AccountScreen     — session info + logout

src/services/
├── DatabaseService.js    — SQLite operations
├── SyncService.js        — NetInfo + Supabase sync
├── ModelCache.js         — background model preload
└── config.example.js     — credential template

assets/models/            — all TFLite model files
```

---

## Open Source Compliance

| Tool | License |
|---|---|
| React Native (Expo) | MIT |
| react-native-vision-camera | MIT |
| react-native-fast-tflite | MIT |
| BlazeFace (MediaPipe) | Apache 2.0 |
| MobileFaceNet | MIT |
| MobileNetV3 (liveness base) | BSD 3-Clause |
| expo-sqlite | MIT |
| Supabase JS | Apache 2.0 |
| @react-native-community/netinfo | MIT |

No proprietary or licensed dependencies. Fully open-source submission.

---

## Known Limitations

- iOS tested via EAS cloud build on Appetize.io simulator — no physical iOS device available
- Liveness model robustness in extreme low-light conditions not benchmarked
- Identical twins may produce false acceptance (operational policy: admin override)
- Supabase free tier (500 MB storage) — sufficient for prototype, production uses paid tier

---

## License

MIT. All bundled AI models are open-source (Apache 2.0 / MIT / BSD).
