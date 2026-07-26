

import sys
import os

print("=" * 60)
print("Hackathon 7.0 — Environment Verification (Person 1 / ML)")
print("=" * 60)

checks = []

# ─── PYTHON VERSION ───────────────────────────────────────────────────────────
major, minor = sys.version_info[:2]
ok = major == 3 and minor >= 9
checks.append(("Python 3.9+", ok, f"Python {major}.{minor}"))

# ─── PYTORCH + CUDA ───────────────────────────────────────────────────────────
try:
    import torch
    cuda_ok  = torch.cuda.is_available()
    gpu_name = torch.cuda.get_device_name(0) if cuda_ok else "No GPU"
    checks.append(("PyTorch installed", True,  f"v{torch.__version__}"))
    checks.append(("CUDA available",    cuda_ok, gpu_name))
    if not cuda_ok:
        print("\n  ⚠️  No CUDA GPU detected.")
        print("     Training will fall back to CPU — much slower.")
        print("     Verify CUDA 12.1 is installed: nvidia-smi")
        print("     Reinstall PyTorch with CUDA:")
        print("     pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121")
except ImportError:
    checks.append(("PyTorch installed", False, "Not installed"))
    checks.append(("CUDA available",    False, "Cannot check"))

# ─── REQUIRED PACKAGES ────────────────────────────────────────────────────────
packages = [
    ("timm",             "timm"),
    ("OpenCV",           "cv2"),
    ("TensorBoard",      "torch.utils.tensorboard"),
    ("scikit-learn",     "sklearn"),
    ("matplotlib",       "matplotlib"),
    ("numpy",            "numpy"),
    ("Pillow",           "PIL"),
    ("tqdm",             "tqdm"),
]

for display_name, import_name in packages:
    try:
        mod = __import__(import_name)
        ver = getattr(mod, "__version__", "ok")
        checks.append((display_name, True, ver))
    except ImportError:
        checks.append((display_name, False, "Not installed"))

# ─── OPTIONAL PACKAGES ────────────────────────────────────────────────────────
optional = [
    ("TensorFlow (for export)",  "tensorflow"),
    ("ai-edge-torch (export)",   "ai_edge_torch"),
    ("ONNX (export)",            "onnx"),
    ("onnx-tf (export)",         "onnx_tf"),
    ("coremltools (iOS)",        "coremltools"),
    ("MediaPipe (gesture test)", "mediapipe"),
    ("gdown (dataset download)", "gdown"),
]

print("\n── Required Packages ──")
for name, ok, detail in checks:
    status = "✅" if ok else "❌"
    print(f"  {status}  {name:<30} {detail}")

print("\n── Optional Packages (needed for export/iOS steps) ──")
for display_name, import_name in optional:
    try:
        mod = __import__(import_name)
        ver = getattr(mod, "__version__", "ok")
        print(f"  ✅  {display_name:<35} {ver}")
    except ImportError:
        print(f"  ⚠️  {display_name:<35} not installed")

# ─── FOLDER STRUCTURE ─────────────────────────────────────────────────────────
print("\n── Folder Structure ──")
required_dirs = [
    "training/liveness",
    "models/tflite",
    "models/coreml",
    "benchmarks",
]
for d in required_dirs:
    exists = os.path.isdir(d)
    if not exists:
        os.makedirs(d, exist_ok=True)
        print(f"  📁  Created: ml/{d}")
    else:
        print(f"  ✅  ml/{d}")

# ─── SUMMARY ──────────────────────────────────────────────────────────────────
failed = [name for name, ok, _ in checks if not ok]
print("\n" + "=" * 60)
if not failed:
    print("✅ ALL CHECKS PASSED — Ready to start Day 1-2 tasks")
    print("\nNext steps:")
    print("  1. Run: python training/download_models.py")
    print("  2. Verify dataset: ls data/CelebA_Spoof/real/ | head -5")
    print("  3. Run training: python training/liveness/train_liveness.py")
else:
    print(f"❌ {len(failed)} CHECK(S) FAILED:")
    for name in failed:
        print(f"   • {name}")
    print("\nFix these before proceeding. Install missing packages:")
    print("  pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121")
    print("  pip install timm opencv-python tensorboard tqdm scikit-learn matplotlib Pillow")
    print("  pip install tensorflow ai-edge-torch onnx onnx-tf coremltools mediapipe gdown")

print("=" * 60)
