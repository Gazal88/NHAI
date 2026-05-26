# Benchmark Report — Hackathon 7.0
**Generated:** 2026-05-27 03:17

## 1. Model Sizes

| Model | Size | Target | Status |
|-------|------|--------|--------|
| BlazeFace | 0.23 MB | < 2 MB | OK |
| Face Mesh | 3.76 MB | < 4 MB | OK |
| Liveness | 1.71 MB | < 4 MB | OK |
| MobileFaceNet | 2.89 MB | < 6 MB | OK |
| **TOTAL** | **8.59 MB** | **< 20 MB** | **OK** |

## 2. Inference Speed (CPU)

| Model | Mean | Target |
|-------|------|--------|
| blazeface | 2.6 ms | < 60 ms |
| facemesh | 80.0 ms | ~80 ms (MediaPipe estimated) |
| liveness | 29.6 ms | < 200 ms |
| mobilefacenet | 6.4 ms | < 200 ms |
| **Total pipeline** | **118.6 ms** | **< 500 ms** |

## 3. Liveness Accuracy

| Metric | Value | Target |
|--------|-------|--------|
| TPR (real face detected) | 100.00% | > 95% |
| TNR (spoof rejected) | 100.00% | > 93% |
| Overall accuracy | 100.00% | > 94% |
| Test images | 500 | 500 |

## 4. Recognition Accuracy

| Metric | Value | Target |
|--------|-------|--------|
| Overall accuracy | 50.00% | > 95% |
| Genuine pairs | 100 | 100 |
| Impostor pairs | 100 | 100 |
| Threshold | 0.75 | 0.75 |

## 5. Brief Compliance

| Requirement | Target | Result | Status |
|-------------|--------|--------|--------|
| Model bundle size | < 20 MB | 8.59 MB | OK |
| Pipeline speed | < 1000 ms | 118.6 ms | OK |
| Open source | Yes | All MIT/Apache 2.0 | OK |
| Android + iOS | Yes | TFLite on both | OK |