# CONTEXT.md — ML Lead — Hackathon 7.0
## Last Updated: 2026-05-24 | Day 1

---

## Project Snapshot
**Hackathon:** 7.0 | **Deadline:** 05 June 2026 | **Days remaining:** 12

**My role:** ML Lead — train 1 model, download 3, export all to TFLite INT8, benchmark, document.

---

## Completed Today
- Read all project documents: PRD, both workplans, original hackathon brief
- Understood full system architecture (4-layer: App → Inference → Storage → Sync)
- Created `/ml/` folder structure:
  ```
  ml/
  ├── training/liveness/      # Training scripts
  ├── models/tflite/          # Final .tflite files (Person 2 reads from here)
  ├── models/coreml/          # Final .mlpackage files (iOS)
  ├── benchmarks/             # Accuracy + speed results
  ├── AGENTS.md
  └── CONTEXT.md
  ```
- Created AGENTS.md with full context for Claude sessions
- Created all training scripts, download scripts, benchmark scripts (see below)

---

## Files Created
| File | Purpose | Status |
|------|---------|--------|
| ml/AGENTS.md | Claude session memory | ✅ Done |
| ml/CONTEXT.md | Daily status log | ✅ Done (this file) |
| ml/training/liveness/train_liveness.py | MobileNetV3 training script | ✅ Ready to run |
| ml/training/liveness/export_liveness.py | TFLite INT8 export | ✅ Ready to run |
| ml/training/download_models.py | Download BlazeFace, FaceMesh, MobileFaceNet | ✅ Ready to run |
| ml/training/export_mobilefacenet.py | MobileFaceNet → TFLite INT8 | ✅ Ready to run |
| ml/training/gesture_algorithms.py | EAR blink + head pose (Python, for Person 2) | ✅ Ready |
| ml/training/clahe_preprocessing.py | CLAHE lighting normalisation | ✅ Ready |
| ml/benchmarks/benchmark.py | Full benchmark suite | ✅ Ready to run |

---

## Working / Not Working
- **Working:** All scripts written and ready
- **Not tested yet:** GPU availability on this machine (need to run verification)
- **Not working:** Nothing known yet

---

## Key Numbers / Targets
| Metric | Target | Current |
|--------|--------|---------|
| Liveness model size | < 4 MB | Not trained yet |
| Total bundle size | < 20 MB | 0 MB |
| Pipeline speed | < 500 ms | Not measured |
| Liveness TPR | > 95% | Not trained yet |
| Liveness TNR | > 93% | Not trained yet |
| Recognition accuracy | > 95% | Not downloaded yet |

---

## Models in /ml/models/tflite/
- None yet (Day 1)

---

## Cross-Team Dependencies
### I need from Person 2:
- GitHub repo URL (to clone and create ml/person1 branch)

### Person 2 needs from me:
- INT-1 (Day 4): liveness.tflite
- INT-2 (Day 7): all 4 .tflite + models/README.md
- INT-3 (Day 11): CoreML .mlpackage files
- INT-4 (Day 13): benchmark_report.md

---

## Tomorrow (Day 2)
1. Run GPU verification command
2. Install all Python dependencies
3. Download BlazeFace + FaceMesh from MediaPipe GitHub
4. Download MobileFaceNet pre-trained weights
5. Download CelebA-Spoof dataset (or verify academic link)
6. Verify all downloads load correctly in Python
7. Clone repo + create ml/person1 branch

---

## Notes / Decisions Made
- Using react-native-fast-tflite (Person 2's choice) — means all models MUST be in TFLite format
- INT8 quantisation mandatory for size targets
- CelebA-Spoof: 625,537 images, CC BY-NC 4.0 (academic/hackathon use OK)
- Supabase chosen as AWS prototype (Apache 2.0, one config file to swap)
- iOS testing: Appetize.io (no Mac available)
- CoreML conversion is best-effort — TFLite runs on iOS natively via react-native-fast-tflite
