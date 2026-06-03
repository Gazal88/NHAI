# Pehchaan — पहचान

**Offline Facial Recognition Attendance System for NHAI Field Workers**
Hackathon 7.0 · Submission: 05 June 2026

---

## What It Does

Pehchaan lets NHAI field workers mark attendance using face recognition — entirely offline with no network dependency at the point of capture. Records sync automatically to Supabase when connectivity returns.

**Core capabilities**
- Fully offline face recognition using on-device MobileFaceNet
- Real-time liveness detection (anti-spoofing)
- Active gesture challenge — blink or head turn (random per session)
- BlazeFace face detection
- Worker enrollment with 5-frame averaged embeddings and duplicate-face guard
- Role-based dashboards — Worker and Admin with distinct UI and access
- GPS-tagged attendance with timestamp
- Automatic cloud sync with local purge on confirmation
- Profile photo upload and contact details for workers

---

## App Flow

```
Launch Screen (3s)
    └── Login Screen (3D flip: Worker ↔ Admin)
            ├── Worker Dashboard
            │     ├── Verify — face recognition attendance
            │     ├── My Attendance — personal history
            │     └── Profile — photo, email, phone, logout
            └── Admin Dashboard
                  ├── Overview — stats, recent activity, sync
                  ├── Workers — roster, search, enroll new
                  ├── Attendance — full log, date filter, sync
                  └── Settings — session info, logout
```

---

## Demo Credentials

| Role | Field | Value |
|---|---|---|
| Worker | Employee ID | `EMP001` |
| Worker | Passcode | `1234` |
| Admin | PIN | `ADMIN1234` |

---

## Tech Stack

| Layer | Library | Version |
|---|---|---|
| Framework | React Native (Expo) | SDK 56.0.4 |
| Camera | react-native-vision-camera | v4 |
| TFLite inference | react-native-fast-tflite | v3 |
| Frame resize | vision-camera-resize-plugin | v3 |
| Worklets | react-native-worklets-core | v1 |
| Local DB | expo-sqlite | SDK 56 |
| GPS | expo-location | SDK 56 |
| Photo picker | expo-image-picker | SDK 56 |
| Cloud sync | @supabase/supabase-js | v2 |
| Network detection | @react-native-community/netinfo | v12 |

---

## Model Bundle

All models bundled in `assets/models/`. Total: **~6.1 MB** (brief limit: 20 MB).

| Model | File | Size | Purpose |
|---|---|---|---|
| BlazeFace | blazeface.tflite | 229 KB | Face detection |
| FaceMesh | facemesh.tflite | 1.2 MB | Bundled (reserved) |
| Liveness | liveness.tflite | 1.7 MB | Real vs spoof |
| MobileFaceNet | mobilefacenet.tflite | 2.9 MB | Face embedding |

---

## Performance

| Metric | Target | Result |
|---|---|---|
| Model bundle size | < 20 MB | 6.1 MB |
| End-to-end pipeline | < 1000 ms | ~119 ms |
| BlazeFace | — | 2.6 ms |
| Liveness | — | 29.6 ms |
| MobileFaceNet | — | 6.4 ms |
| App cold start | < 3 s | ~2 s |

---

## Setup

### 1. Clone

```bat
git clone https://github.com/Gazal88/NHAI.git
cd NHAI
git checkout app/person2
npm install
```

### 2. Pull ML models

```bat
git fetch origin ml/person1
git checkout FETCH_HEAD -- ml/models/tflite
copy ml\models\tflite\*.tflite assets\models\
```

### 3. Supabase credentials

```bat
copy src\services\config.example.js src\services\config.js
```

Edit `src/services/config.js` with your Supabase URL and anon key.

### 4. Run on Android

```bat
set JAVA_HOME=C:\Users\hp\.gradle\jdks\eclipse_adoptium-17-amd64-windows.2
set ANDROID_SERIAL=YOUR_DEVICE_SERIAL
npm run android
```

### 5. Run on iOS (EAS cloud build — no Mac needed)

```bat
npx eas-cli@latest build --platform ios --profile preview
```

Upload the `.ipa` to appetize.io.

---

## Supabase Setup

Run once in SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS attendance (
  id          TEXT PRIMARY KEY,
  worker_id   TEXT NOT NULL,
  employee_id TEXT,
  worker_name TEXT,
  timestamp   BIGINT NOT NULL,
  gps_lat     FLOAT,
  gps_lng     FLOAT,
  confidence  FLOAT
);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon insert" ON attendance FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon select" ON attendance FOR SELECT TO anon USING (true);
```

---

## Inference Pipeline

Two concurrent operations per camera frame:

**Face Detection (every 250ms):** BlazeFace detects face presence — updates "Face ✓" indicator.

**Liveness + Recognition (every 350ms):** Full frame resized to model input. Liveness model returns real/spoof score (sigmoid applied to raw logit). MobileFaceNet returns 128-dim L2-normalised embedding.

**Active anti-spoofing:** Random gesture prompt (blink or head turn). User performs gesture in a 3-second window. Liveness score must confirm real face presence throughout. Static photos and screens fail this check.

---

## Requirements

- Android 8.0+ or iOS 12+
- Minimum 3 GB RAM
- Front camera
- No GPU required — CPU inference only

---

## Open Source Compliance

All dependencies are MIT / Apache 2.0. No proprietary licenses.

| Tool | License |
|---|---|
| React Native (Expo) | MIT |
| react-native-vision-camera | MIT |
| react-native-fast-tflite | MIT |
| BlazeFace (MediaPipe) | Apache 2.0 |
| MobileFaceNet | MIT |
| expo-sqlite | MIT |
| Supabase JS | Apache 2.0 |
| netinfo | MIT |

---

## Known Limitations

- Liveness model trained on synthetic dataset — extreme real-world spoof robustness not benchmarked
- iOS tested via EAS cloud build on Appetize.io (no physical iOS device available)
- Identical twins may produce false acceptance — admin override available

---

## License

MIT. All bundled AI models are open-source.
