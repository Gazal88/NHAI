# Technical Documentation
## Pehchaan — Offline Facial Recognition Attendance System
### Hackathon 7.0 | Team of 2

---

## System Architecture

```
React Native App (Expo SDK 56)
    │
    ├── CameraView.js
    │     ├── Tick A (250ms): BlazeFace → face detected indicator
    │     └── Tick B (350ms): Liveness + MobileFaceNet → score + embedding
    │
    ├── AuthScreen.js — verify attendance
    │     ├── Liveness score gate (sigmoid > 0.55)
    │     └── Face embedding match (dot product > 0.75 strict)
    │
    ├── EnrollScreen.js — 5-frame enrollment
    │     └── Average 5 embeddings → store in SQLite
    │
    ├── DatabaseService.js — expo-sqlite WAL mode
    └── SyncService.js — NetInfo + Supabase (offline→online trigger)
```

---

## Model 1: BlazeFace

| Property | Value |
|---|---|
| Source | Google MediaPipe (unmodified) |
| File | blazeface.tflite |
| Size | 0.23 MB |
| Input | [1, 128, 128, 3] float32 |
| Output | [1, 896, 1] scores + [1, 896, 16] boxes |
| Latency | 2.6 ms CPU |
| Purpose | Real-time face detection — provides faceDetected indicator in UI |
| License | Apache 2.0 |

**How it works:** SSD-based face detector with 896 anchor boxes at 128×128. Scores are sigmoid probabilities. Threshold: 0.35. Used only for the "Face ✓" UI indicator — does not affect liveness or recognition input.

---

## Model 2: Face Mesh

| Property | Value |
|---|---|
| Source | Google MediaPipe face_landmark.tflite |
| File | facemesh.tflite |
| Size | 1.21 MB |
| Input | [1, 192, 192, 3] float32 |
| Output | [1, 1, 1, 1404] float32 (468 × 3 landmarks) |
| Latency | ~80 ms CPU |
| Purpose | Bundled for future gesture expansion |
| License | Apache 2.0 |

**Status:** Excluded from active inference paths to keep the memory footprint low and prevent OutOfMemory crashes on low-memory edge devices. Passive MobileNetV3 classification is used for liveness security instead.

---

## Model 3: Liveness Detection

| Property | Value |
|---|---|
| Architecture | MobileNetV3-Small |
| Pretrained weights | ImageNet |
| File | liveness.tflite |
| Size | 1.71 MB |
| Input | [1, 224, 224, 3] float32 |
| Output | [1, 1] float32 — RAW LOGIT (not sigmoid) |
| Latency | 29.6 ms CPU |
| License | BSD 3-Clause (base) |

**Output format:** Raw logit. Must apply sigmoid before use: `score = 1 / (1 + exp(-logit))`. After sigmoid: real face > 0.65, spoof < 0.40.

**Training:**
- Base: MobileNetV3-Small with ImageNet pretrained weights
- Task: Binary classification — real face (1) vs spoof (0)
- Dataset: Synthetic — 3000 real (smooth skin-tone, slight blur) + 3000 spoof (JPEG artifact + banding pattern overlay)
- Augmentation: Random brightness ±30%, Gaussian blur, rotation ±15°, horizontal flip
- Epochs: 30 — ~30s per epoch on RTX 4050
- Export: PyTorch → ONNX → onnx2tf → TFLite (Windows compatible path)
- Accuracy: 100% TPR / 100% TNR on held-out synthetic test set

**In the app:**
- Sigmoid applied to raw logit in CameraView.js frame processor
- Liveness gate at verify: sigmoid score > 0.55
- Dynamic verification: requires 2 consecutive high-confidence frames (sigmoid score > 0.65) to pass liveness verification.

---

## Model 4: Face Recognition (MobileFaceNet)

| Property | Value |
|---|---|
| Architecture | MobileNetV2 backbone + 128-dim embedding head |
| Pretrained weights | ImageNet (torchvision) |
| File | mobilefacenet.tflite |
| Size | 2.89 MB |
| Input | [1, 112, 112, 3] float32 |
| Output | [1, 128] float32 — L2-normalised |
| Latency | 6.4 ms CPU |
| License | MIT |

**Output format:** L2-normalised 128-dim vector. Cosine similarity = dot product (no division needed).

**Similarity ranges:**
- Same person (controlled): ~0.99
- Different people (random): 0.00 to -0.18
- App recognition threshold: 0.75 (strict default for production accuracy)
- Duplicate face guard (enrollment): 0.75

**Enrollment:** 5 frames captured, embeddings averaged, stored as JSON in SQLite `workers.embedding` column.

**Export path:** MobileNetV2 trained in PyTorch → Keras weight mapping → TFLite via SavedModel conversion.

---

## Inference Pipeline (App Side)

Two independent ticks per camera frame (react-native-fast-tflite via VisionCamera frame processor):

```
Tick A — every 250ms:
  BlazeFace @ 128×128 → faceDetected boolean

Tick B — every 350ms:
  Full frame → resize to 224×224 → Liveness → sigmoid(logit) → livenessScore
  Full frame → resize to 112×112 → MobileFaceNet → 128-dim embedding
```

Both ticks run in a Reanimated worklet on a dedicated thread — no UI blocking.

---

## Database Schema (SQLite — expo-sqlite WAL mode)

```sql
workers (
  id TEXT PRIMARY KEY,
  employee_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  department TEXT,
  passcode TEXT,
  embedding TEXT,          -- JSON array of 128 floats
  enrolled_at INTEGER,
  active INTEGER DEFAULT 1,
  email TEXT,
  phone TEXT,
  photo_uri TEXT
)

attendance (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  worker_name TEXT,
  timestamp INTEGER NOT NULL,
  gps_lat REAL,
  gps_lng REAL,
  confidence REAL,
  synced INTEGER DEFAULT 0
)
```

---

## Sync Architecture

- **Trigger:** NetInfo offline→online transition only (no polling)
- **Target:** Supabase (Apache 2.0, AWS-compatible)
- **Batch:** All unsynced records in one insert
- **Purge:** Local records deleted only after server HTTP 200 ACK
- **AWS migration:** Change 2 lines in `src/services/config.js`

---

## Open Source Compliance

| Component | License |
|---|---|
| React Native / Expo | MIT |
| react-native-vision-camera | MIT |
| react-native-fast-tflite | MIT |
| vision-camera-resize-plugin | MIT |
| react-native-worklets-core | MIT |
| BlazeFace (MediaPipe) | Apache 2.0 |
| Face Mesh (MediaPipe) | Apache 2.0 |
| MobileNetV3-Small (base) | BSD 3-Clause |
| MobileNetV2 (base) | BSD 3-Clause |
| expo-sqlite | MIT |
| Supabase JS client | Apache 2.0 |
| @react-native-community/netinfo | MIT |

No proprietary licenses. No additional licenses required.

---

## Known Limitations

| Limitation | Severity | Notes |
|---|---|---|
| Liveness trained on synthetic data | Medium | Real-world spoof robustness not benchmarked on CelebA-Spoof. Sufficient for prototype demonstration. |
| Recognition tested on controlled pairs | Medium | Same-person accuracy on real diverse faces unvalidated. App threshold set strictly at 0.75 for maximum security. |
| iOS tested on Appetize.io simulator | Low | EAS cloud build produces real IPA. No Mac available for physical device testing. |
| Identical twins | Low | Known limitation — admin override available. |
| Extreme low-light (< 10 lux) | Low | UI prompts user to improve lighting. |
