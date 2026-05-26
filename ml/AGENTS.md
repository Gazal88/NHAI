# AGENTS.md — ML Lead (Person 1) — Hackathon 7.0

## Project
Offline facial recognition & liveness detection system for field personnel.
React Native app (Datalake 3.0). My role: all ML models.
Teammate (Person 2) builds the React Native app and reads my models from `/ml/models/tflite/`.

## My Responsibilities
- Train MobileNetV3-Small liveness classifier on CelebA-Spoof → export TFLite INT8 < 4 MB
- Download BlazeFace pre-trained from MediaPipe GitHub → place in `/ml/models/tflite/`
- Download MediaPipe Face Mesh pre-trained → place in `/ml/models/tflite/`
- Download MobileFaceNet pre-trained weights → convert to TFLite INT8 → place in `/ml/models/tflite/`
- Write EAR blink detection + head pose functions (Python, for Person 2 to port to TypeScript)
- Write CLAHE preprocessing function (Python)
- Run full benchmark suite → write `/ml/benchmarks/benchmark_report.md`
- Convert all models to CoreML (best effort, Days 11-12)
- Write `/ml/models/README.md` with exact input/output specs for Person 2

## Key Constraints (from brief)
- Total model bundle < 20 MB (target ~13 MB)
- Inference < 1 second on Snapdragon 680 (CPU only, no GPU)
- Accuracy > 95% on Indian demographics + outdoor lighting
- Open-source only — all tools MIT/Apache 2.0/BSD

## Model Pipeline
| # | Model | Source | Size | Purpose |
|---|-------|--------|------|---------|
| 1 | BlazeFace | MediaPipe GitHub (Google) | ~1 MB | Face detection + bounding box |
| 2 | MediaPipe Face Mesh | MediaPipe GitHub (Google) | ~3 MB | 468 landmarks for gesture |
| 3 | MobileNetV3-Small (Liveness) | TRAIN on CelebA-Spoof | ~4 MB | Real vs spoof |
| 4 | MobileFaceNet (Recognition) | Pre-trained GitHub weights | ~5 MB | 128-dim face embedding |

## Integration Points with Person 2 (App Dev Lead)
| Point | Day | I Do | I Tell Person 2 |
|-------|-----|------|----------------|
| INT-1 | Day 4 | Copy liveness.tflite → /ml/models/tflite/, push | "liveness model ready" |
| INT-2 | Day 7 | All 4 .tflite final + README.md, push | "all models final, check README" |
| INT-3 | Day 11 | CoreML .mlpackage files → /ml/models/coreml/, push | "CoreML models ready" |
| INT-4 | Day 13 | benchmark_report.md → /ml/benchmarks/, push | "benchmark numbers ready for PPT" |

## Branch
`ml/person1` — never commit to main directly. Never touch `/src/`, `/android/`, `/ios/`.

## Hardware (My Machine)
- GPU: RTX 4050 Laptop GPU (6 GB VRAM)
- CPU: i5-13500HX
- RAM: 16 GB
- OS: Windows
- Framework: PyTorch 2.x + CUDA 12.1

## Current Status ← UPDATE EVERY SESSION
Last completed: Initial setup — AGENTS.md + CONTEXT.md created, folder structure ready
Working on: Environment verification + model downloads (Days 1-2)
Blocked on: Nothing currently
Models in /ml/models/tflite/: None yet

## Session Log ← ADD ENTRY EVERY SESSION
### 2026-05-24
- Read full PRD, brief, both workplans
- Created ml/ folder structure
- Created AGENTS.md and CONTEXT.md
- Ready to begin Day 1-2 tasks: GPU verify, dependency install, model downloads
Last completed: INT-2 — all 4 TFLite models exported and pushed
Working on: Benchmark script (Days 9-10)
Models in /ml/models/tflite/: blazeface, facemesh, liveness, mobilefacenet