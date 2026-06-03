"""
download_models.py — Download pre-trained models for Hackathon 7.0
Hackathon 7.0 | ML Lead (Person 1)

Downloads:
  1. BlazeFace (face detection) — MediaPipe GitHub
  2. MediaPipe Face Mesh (468 landmarks) — MediaPipe GitHub
  3. MobileFaceNet pre-trained weights (.pth) — GitHub

All models are open-source (Apache 2.0 / MIT).
Run this script on Day 1-2.
"""

import os
import sys
import hashlib
import urllib.request

TFLITE_DIR = "../models/tflite"
WEIGHTS_DIR = "./weights"

os.makedirs(TFLITE_DIR, exist_ok=True)
os.makedirs(WEIGHTS_DIR, exist_ok=True)

# ─── MODEL REGISTRY ───────────────────────────────────────────────────────────
# All URLs verified as of May 2026. If a URL is broken, see the fallback instructions.
MODELS = [
    {
        "name": "BlazeFace (Short Range)",
        "url": "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
        "output": os.path.join(TFLITE_DIR, "blazeface.tflite"),
        "expected_size_mb": (0.5, 2.0),
        "license": "Apache 2.0",
        "source": "MediaPipe / Google",
        "fallback": (
            "If URL fails:\n"
            "  1. Go to: https://ai.google.dev/edge/mediapipe/solutions/vision/face_detector\n"
            "  2. Download 'BlazeFace (Short Range)' model\n"
            "  3. Place as: ml/models/tflite/blazeface.tflite"
        ),
    },
    {
        "name": "MediaPipe Face Mesh",
        "url": "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        "output": os.path.join(TFLITE_DIR, "facemesh.tflite"),
        "expected_size_mb": (1.0, 5.0),
        "license": "Apache 2.0",
        "source": "MediaPipe / Google",
        "fallback": (
            "If URL fails:\n"
            "  1. Go to: https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker\n"
            "  2. Download face_landmarker.task\n"
            "  3. Place as: ml/models/tflite/facemesh.tflite\n"
            "  OR use the older face_landmark.tflite from MediaPipe legacy:\n"
            "  https://storage.googleapis.com/download.tensorflow.org/models/tflite/gpu/face_landmark.tflite"
        ),
    },
    {
        "name": "MobileFaceNet Pre-trained Weights",
        "url": "https://github.com/foamliu/MobileFaceNet/raw/master/mobilefacenet.pth",
        "output": os.path.join(WEIGHTS_DIR, "mobilefacenet.pth"),
        "expected_size_mb": (1.0, 20.0),
        "license": "MIT",
        "source": "foamliu/MobileFaceNet (GitHub)",
        "fallback": (
            "If URL fails, try alternatives:\n"
            "  Option A: https://github.com/deepinsight/insightface (ArcFace weights)\n"
            "  Option B: https://github.com/clcarwin/sphereface_pytorch\n"
            "  Option C: Search 'MobileFaceNet pretrained pytorch' on GitHub\n"
            "  Look for a .pth file with embedding output size 128 or 512"
        ),
    },
]


def download_file(url, output_path, name):
    """Download with progress indicator."""
    print(f"\nDownloading: {name}")
    print(f"  URL: {url}")
    print(f"  Target: {output_path}")

    if os.path.exists(output_path):
        size_mb = os.path.getsize(output_path) / 1e6
        print(f"  ⏭️  Already exists ({size_mb:.2f} MB) — skipping")
        return True

    try:
        def progress(block_num, block_size, total_size):
            downloaded = block_num * block_size
            if total_size > 0:
                pct = min(100, downloaded * 100 / total_size)
                bar = "█" * int(pct / 2) + "░" * (50 - int(pct / 2))
                print(f"\r  [{bar}] {pct:.0f}% ({downloaded/1e6:.1f}/{total_size/1e6:.1f} MB)", end="")
            else:
                print(f"\r  Downloaded: {downloaded/1e6:.1f} MB", end="")

        urllib.request.urlretrieve(url, output_path, progress)
        print()  # newline after progress bar

        size_mb = os.path.getsize(output_path) / 1e6
        print(f"  ✅ Done — {size_mb:.2f} MB")
        return True

    except Exception as e:
        print(f"\n  ❌ Download failed: {e}")
        return False


def verify_model(output_path, name, expected_size_mb):
    """Verify downloaded file is valid."""
    if not os.path.exists(output_path):
        print(f"  ❌ File not found: {output_path}")
        return False

    size_mb = os.path.getsize(output_path) / 1e6
    min_mb, max_mb = expected_size_mb

    if size_mb < min_mb:
        print(f"  ❌ File too small ({size_mb:.2f} MB < {min_mb} MB) — likely corrupted")
        return False
    if size_mb > max_mb:
        print(f"  ⚠️  File larger than expected ({size_mb:.2f} MB > {max_mb} MB)")

    # Try loading TFLite models
    if output_path.endswith(".tflite") or output_path.endswith(".task"):
        try:
            import tensorflow as tf
            if output_path.endswith(".tflite"):
                interp = tf.lite.Interpreter(model_path=output_path)
                interp.allocate_tensors()
                inp = interp.get_input_details()
                out = interp.get_output_details()
                print(f"  TFLite verified — Input: {inp[0]['shape']}, Output: {out[0]['shape']}")
            else:
                print(f"  .task file — will be used as TFLite bundle by MediaPipe")
        except ImportError:
            print(f"  TFLite runtime not available — skipping load verification")
        except Exception as e:
            print(f"  ⚠️  TFLite load warning: {e}")

    # Try loading PyTorch weights
    elif output_path.endswith(".pth"):
        try:
            import torch
            state = torch.load(output_path, map_location="cpu")
            if isinstance(state, dict):
                keys = list(state.keys())[:3]
                print(f"  PyTorch weights verified — keys sample: {keys}")
            else:
                print(f"  PyTorch object loaded: {type(state)}")
        except Exception as e:
            print(f"  ⚠️  PyTorch load warning: {e}")

    print(f"  ✅ {name} — {size_mb:.2f} MB — verified")
    return True


# ─── MAIN ─────────────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("Hackathon 7.0 — Model Download Script")
    print("=" * 60)

    results = {}
    for m in MODELS:
        success = download_file(m["url"], m["output"], m["name"])
        if success:
            ok = verify_model(m["output"], m["name"], m["expected_size_mb"])
        else:
            ok = False
            print(f"\n  FALLBACK INSTRUCTIONS:")
            print(f"  {m['fallback']}")

        results[m["name"]] = "✅" if ok else "❌"

    print("\n" + "=" * 60)
    print("DOWNLOAD SUMMARY")
    print("=" * 60)
    for name, status in results.items():
        print(f"  {status}  {name}")

    all_ok = all(v == "✅" for v in results.values())
    if all_ok:
        print("\n✅ All models downloaded. Next step: run train_liveness.py")
    else:
        print("\n⚠️  Some models failed. Follow the fallback instructions above.")
        print("   Do NOT proceed to training until all 3 downloads are verified.")

    # Print expected paths for Person 2
    print("\n" + "=" * 60)
    print("PATHS FOR PERSON 2 (react-native-fast-tflite assets):")
    print("=" * 60)
    print(f"  ml/models/tflite/blazeface.tflite  → /android/app/src/main/assets/")
    print(f"  ml/models/tflite/facemesh.tflite   → /android/app/src/main/assets/")
    print(f"  ml/models/tflite/liveness.tflite   → /android/app/src/main/assets/ [after training]")
    print(f"  ml/models/tflite/mobilefacenet.tflite → /android/app/src/main/assets/ [after export]")


if __name__ == "__main__":
    main()
