"""
clahe_preprocessing.py — CLAHE Contrast Enhancement for Face Crops
Hackathon 7.0 | ML Lead (Person 1)

Addresses brief requirement: "function reliably in varying outdoor lighting conditions
(e.g., harsh sunlight, low light, shadows)"

CLAHE = Contrast Limited Adaptive Histogram Equalisation
Applied to face crops BEFORE passing to inference models.
Person 2 implements equivalent using expo-image-manipulator.
"""

import os
import numpy as np
import cv2
from typing import Tuple, Optional


# ─── CLAHE PARAMETERS (tuned for face crops) ──────────────────────────────────
CLIP_LIMIT    = 2.0       # prevents over-amplification of noise
TILE_GRID     = (8, 8)    # 8x8 grid — balances local/global contrast
TARGET_SIZE   = (224, 224)  # resize after CLAHE for model input


def apply_clahe(
    image_bgr: np.ndarray,
    clip_limit: float = CLIP_LIMIT,
    tile_grid: Tuple[int, int] = TILE_GRID,
) -> np.ndarray:
    """
    Apply CLAHE to a face crop image.

    Args:
        image_bgr: OpenCV BGR image (H, W, 3) — any size, any lighting
        clip_limit: CLAHE clip limit (2.0 recommended for faces)
        tile_grid:  Grid size for adaptive histogram (8x8 recommended)

    Returns:
        CLAHE-processed BGR image (same size as input)

    How it works:
        1. Convert BGR → LAB colour space
        2. Apply CLAHE only to L (luminance) channel — preserves colour
        3. Merge back and convert LAB → BGR
        Result: improved contrast without distorting skin tone colours
    """
    # Convert to LAB — CLAHE applied to L channel only
    lab = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)

    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_grid)
    l_clahe = clahe.apply(l)

    lab_clahe = cv2.merge([l_clahe, a, b])
    result = cv2.cvtColor(lab_clahe, cv2.COLOR_LAB2BGR)

    return result


def preprocess_for_model(
    image_bgr: np.ndarray,
    model_input_size: Tuple[int, int] = TARGET_SIZE,
    apply_clahe_flag: bool = True,
) -> np.ndarray:
    """
    Full preprocessing pipeline: CLAHE → resize → normalise.

    Args:
        image_bgr:         Raw face crop from camera frame (BGR)
        model_input_size:  Target size for the ML model
        apply_clahe_flag:  Set False to skip CLAHE (e.g., good indoor lighting)

    Returns:
        Float32 array (H, W, 3) normalised to [0, 1] — ready for TFLite input
        (For models expecting [-1, 1]: multiply by 2 then subtract 1)
    """
    if apply_clahe_flag:
        image_bgr = apply_clahe(image_bgr)

    resized = cv2.resize(image_bgr, model_input_size, interpolation=cv2.INTER_LINEAR)
    rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
    normalised = rgb.astype(np.float32) / 255.0

    return normalised  # shape: (224, 224, 3), values: [0, 1]


def preprocess_mobilefacenet(image_bgr: np.ndarray) -> np.ndarray:
    """
    Preprocess for MobileFaceNet:
    - Input size: 112x112
    - Normalisation: [-1, 1]
    """
    if apply_clahe:
        image_bgr = apply_clahe(image_bgr)
    resized = cv2.resize(image_bgr, (112, 112))
    rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
    # Normalise to [-1, 1]
    normalised = (rgb.astype(np.float32) / 127.5) - 1.0
    return normalised  # (112, 112, 3)


def preprocess_blazeface(image_bgr: np.ndarray) -> np.ndarray:
    """
    Preprocess for BlazeFace:
    - Input size: 128x128
    - Normalisation: [-1, 1]
    """
    resized = cv2.resize(image_bgr, (128, 128))
    rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
    normalised = (rgb.astype(np.float32) / 127.5) - 1.0
    return normalised  # (128, 128, 3)


# ─── LIGHTING TEST ────────────────────────────────────────────────────────────

def test_lighting_conditions(image_paths: list):
    """
    Test CLAHE on 3 lighting conditions.
    Prints before/after mean luminance for each image.

    Args:
        image_paths: List of paths to test face images
    """
    print("CLAHE Lighting Test")
    print("=" * 50)

    for path in image_paths:
        if not os.path.exists(path):
            print(f"  ⚠️  Image not found: {path}")
            continue

        img = cv2.imread(path)
        if img is None:
            print(f"  ⚠️  Could not load: {path}")
            continue

        # Before CLAHE
        lab_before = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l_before = lab_before[:, :, 0]
        mean_before = np.mean(l_before)
        std_before  = np.std(l_before)

        # After CLAHE
        processed = apply_clahe(img)
        lab_after = cv2.cvtColor(processed, cv2.COLOR_BGR2LAB)
        l_after = lab_after[:, :, 0]
        mean_after = np.mean(l_after)
        std_after  = np.std(l_after)

        print(f"\nImage: {os.path.basename(path)}")
        print(f"  Before — mean luminance: {mean_before:.1f} | std: {std_before:.1f}")
        print(f"  After  — mean luminance: {mean_after:.1f} | std: {std_after:.1f}")
        print(f"  Contrast improvement: {(std_after - std_before) / std_before * 100:.1f}%")

        # Save comparison
        comparison = np.hstack([img, processed])
        out_path = path.replace(".jpg", "_clahe_comparison.jpg").replace(".png", "_clahe_comparison.png")
        cv2.imwrite(out_path, comparison)
        print(f"  Comparison saved: {out_path}")

    print("\n✅ CLAHE test complete.")
    print("Share results with Person 2 — he implements equivalent in expo-image-manipulator.")


# ─── SYNTHETIC LIGHTING TEST ──────────────────────────────────────────────────

def synthetic_lighting_test():
    """
    Creates synthetic images simulating harsh/low/normal lighting
    and tests CLAHE on them. No real images needed.
    """
    print("Synthetic CLAHE Lighting Test")
    print("=" * 50)

    # Create test images
    base = np.ones((200, 200, 3), dtype=np.uint8) * 128  # neutral grey face

    tests = [
        ("Harsh sunlight (overexposed)", np.clip(base * 2, 0, 255).astype(np.uint8)),
        ("Low light (underexposed)",     np.clip(base * 0.3, 0, 255).astype(np.uint8)),
        ("Normal indoor",                base.copy()),
        ("High contrast shadow",         _make_shadow_image()),
    ]

    for name, img in tests:
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        mean_before = np.mean(lab[:, :, 0])
        std_before  = np.std(lab[:, :, 0])

        processed = apply_clahe(img)
        lab2 = cv2.cvtColor(processed, cv2.COLOR_BGR2LAB)
        mean_after = np.mean(lab2[:, :, 0])
        std_after  = np.std(lab2[:, :, 0])

        improvement = (std_after - std_before) / (std_before + 1e-9) * 100

        print(f"\n{name}")
        print(f"  Before — mean: {mean_before:.1f} | contrast(std): {std_before:.1f}")
        print(f"  After  — mean: {mean_after:.1f} | contrast(std): {std_after:.1f}")
        print(f"  Contrast change: {improvement:+.1f}%")

    print("\n✅ Synthetic test complete.")


def _make_shadow_image():
    """Create a face-like image with harsh shadow across it."""
    img = np.zeros((200, 200, 3), dtype=np.uint8)
    img[:, :100] = 180   # lit half
    img[:, 100:] = 30    # shadow half
    return img


# ─── MAIN ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        # Test on provided image paths
        test_lighting_conditions(sys.argv[1:])
    else:
        # Synthetic test (no real images needed)
        synthetic_lighting_test()

    print("\nNote for Person 2:")
    print("  CLAHE in JavaScript (expo-image-manipulator) approximation:")
    print("  Use adjustments: contrast 1.3-1.5 for low-light, 0.8-0.9 for overexposed.")
    print("  Full CLAHE requires a native module — simple contrast adjustment covers 80% of cases.")
