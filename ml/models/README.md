# ML Models — README for Person 2 (App Dev Lead)
## Hackathon 7.0 | Updated by Person 1 (ML Lead)

This file tells you **exactly** how to load and run each model using `react-native-fast-tflite`.
Read this before writing any TypeScript inference code.

---

## Model Files Location

All `.tflite` files live in `/ml/models/tflite/`.
Copy all of them to `/android/app/src/main/assets/` for Android.
For iOS: they are bundled via EAS build — check `app.json` assets config.

---

## Model 1: BlazeFace — Face Detection

| Field | Value |
|-------|-------|
| File | `blazeface.tflite` |
| Source | MediaPipe / Google (Apache 2.0) |
| Input shape | `[1, 128, 128, 3]` — NHWC format |
| Input type | `float32` |
| Input normalisation | Scale pixel values to `[-1, 1]`: `(pixel / 127.5) - 1.0` |
| Output | SSD-format bounding boxes + scores |
| Output shape | Two tensors: `[1, 896, 16]` (boxes) + `[1, 896, 1]` (scores) |
| Confidence threshold | Use `0.7` — discard detections below this |
| Purpose | Detect face, get bounding box `{x, y, width, height}` |
| Speed (CPU) | ~50 ms |
| Size | ~1 MB |

**TypeScript usage:**
```typescript
// Input: resize camera frame to 128x128, normalise to [-1, 1]
// Output: decode SSD anchors to get face bounding box
// Ask Claude: "decode BlazeFace SSD output to bounding box"
```

**Important:** BlazeFace uses SSD anchor-based decoding. The raw output is NOT pixel coordinates — you need to apply anchor decoding. Claude can generate this for you.

---

## Model 2: MediaPipe Face Mesh — 468 Landmarks

| Field | Value |
|-------|-------|
| File | `facemesh.tflite` |
| Source | MediaPipe / Google (Apache 2.0) |
| Input shape | `[1, 192, 192, 3]` — NHWC format |
| Input type | `float32` |
| Input normalisation | Scale to `[0, 1]`: `pixel / 255.0` |
| Input content | Cropped face region (from BlazeFace bounding box) |
| Output shape | `[1, 1404]` — 468 landmarks × 3 (x, y, z) |
| Output format | Flat float array. Reshape to `(468, 3)`. x,y are normalised [0,1] within crop. |
| Purpose | 468 3D facial landmarks for blink + head turn detection |
| Speed (CPU) | ~80 ms |
| Size | ~3 MB |

**TypeScript usage:**
```typescript
// Step 1: crop face using BlazeFace bounding box
// Step 2: resize crop to 192x192, normalise to [0,1]
// Step 3: run FaceMesh, get Float32Array of length 1404
// Step 4: pass flat array to computeEAR() and computeHeadYaw()
// Landmark indices documented in gesture_algorithms.py
```

**Key landmark indices (copy exactly from gesture_algorithms.py):**
```
Left eye:  [362, 385, 387, 263, 373, 380]
Right eye: [33, 160, 158, 133, 153, 144]
Nose tip (yaw): landmark 1
Left face: landmark 234  |  Right face: landmark 454
```

---

## Model 3: Liveness — MobileNetV3-Small

| Field | Value |
|-------|-------|
| File | `liveness.tflite` |
| Source | Trained by Person 1 on CelebA-Spoof |
| Input shape | `[1, 224, 224, 3]` — NHWC format |
| Input type | `float32` |
| Input normalisation | ImageNet: `(pixel/255 - mean) / std` where mean=[0.485,0.456,0.406], std=[0.229,0.224,0.225] |
| Input content | Cropped face region (from BlazeFace bounding box), apply CLAHE first |
| Output shape | `[1, 1]` — single float |
| Output format | Raw logit OR sigmoid score 0-1 (check with test image) |
| Thresholds | score > 0.65 → LIVE, score < 0.40 → SPOOF, between → ambiguous (retry once) |
| Purpose | Classify real face vs spoof (printed photo, screen replay) |
| Speed (CPU) | ~150 ms |
| Size | ~4 MB |
| Training accuracy | TPR: 95%+ TNR: 93%+ (see benchmark_report.md) |

**TypeScript usage:**
```typescript
// IMPORTANT: Apply CLAHE preprocessing before this model
// Input: [1, 224, 224, 3] with ImageNet normalisation
// Output: sigmoid score 0-1
// If output is outside [0,1]: apply sigmoid manually: 1 / (1 + Math.exp(-score))
```

**ImageNet normalisation in TypeScript:**
```typescript
const MEAN = [0.485, 0.456, 0.406];
const STD  = [0.229, 0.224, 0.225];
// For each pixel at channel c: (pixel/255 - MEAN[c]) / STD[c]
```

---

## Model 4: MobileFaceNet — Face Recognition

| Field | Value |
|-------|-------|
| File | `mobilefacenet.tflite` |
| Source | Pre-trained weights from GitHub (MIT), exported by Person 1 |
| Input shape | `[1, 112, 112, 3]` — NHWC format |
| Input type | `float32` |
| Input normalisation | Scale to `[-1, 1]`: `(pixel / 127.5) - 1.0` |
| Input content | Cropped face region (from BlazeFace bounding box) |
| Output shape | `[1, 128]` — 128-dimensional embedding vector |
| Output format | L2-normalised float array (norm ≈ 1.0) |
| Comparison | Cosine similarity: `dot(emb1, emb2)` (since already L2-normalised) |
| Match threshold | Cosine similarity > 0.75 → same person |
| Purpose | Generate face embedding for identity matching against SQLite stored embeddings |
| Speed (CPU) | ~180 ms |
| Size | ~5 MB |

**TypeScript usage:**
```typescript
// Input: [1, 112, 112, 3] normalised to [-1, 1]
// Output: Float32Array of length 128 (L2-normalised)
// DO NOT re-normalise output — already L2-normalised by model
// Cosine similarity = dot product (since both vectors are unit vectors):
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < 128; i++) dot += a[i] * b[i];
  return dot;  // range: -1 to 1 (same person: typically > 0.75)
}
```

---

## Full Pipeline Order

```
Camera Frame
    ↓
[CLAHE preprocessing — apply to full frame or face crop]
    ↓
BlazeFace (128×128) → face bounding box
    ↓
Crop face from frame
    ↓
┌──────────────────┬────────────────────────────────┐
│ FaceMesh (192×192)│ Liveness (224×224) + MobileFaceNet (112×112) │
│ → 468 landmarks  │ → spoof check + identity match │
└──────────────────┴────────────────────────────────┘
    ↓                           ↓
EAR blink / head yaw      score < 0.40 → REJECT
    ↓
Gesture confirmed → run liveness → run recognition → AUTHENTICATE
```

**Total budget:** BlazeFace(50ms) + FaceMesh(80ms) + Liveness(150ms) + MobileFaceNet(180ms) + overhead = ~500ms ✅

---

## CLAHE Notes for Person 2

Python CLAHE uses `cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))` on the L channel of LAB colour space.

In JavaScript with `expo-image-manipulator`, approximate with:
- Underexposed (mean luminance < 80): contrast +40%, brightness +10%
- Overexposed (mean luminance > 180): contrast -15%
- Normal: contrast +20%

For a full CLAHE JS implementation, consider `@tensorflow/tfjs` image utilities or a native module. Simple contrast adjustment covers most outdoor lighting scenarios.

---

## Cross-Team Dependency Note

⚠️ **This file is written by Person 1 (ML Lead).**
Person 2 must NOT edit this file — it is the source of truth for model specs.
If a spec looks wrong, message Person 1 before changing inference code.

Integration milestones:
- **INT-1 (Day 4):** `liveness.tflite` ready
- **INT-2 (Day 7):** All 4 `.tflite` + this README finalised
- **INT-3 (Day 11):** CoreML `.mlpackage` files (if conversion succeeds)
- **INT-4 (Day 13):** `benchmark_report.md` with final numbers for PPT
