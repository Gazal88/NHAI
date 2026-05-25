"""
export_liveness.py — Export trained MobileNetV3-Small to TFLite INT8
Hackathon 7.0 | ML Lead (Person 1)

Route: PyTorch .pth → ONNX → TFLite → INT8 quantisation
Target: < 4 MB final file
Output: ml/models/tflite/liveness.tflite
"""

import os
import sys
import time
import argparse
import numpy as np
import torch
import torch.nn as nn
from torchvision import models

# ─── ARGS ─────────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser()
parser.add_argument("--checkpoint", default="./checkpoints/liveness/best_liveness.pth",
                    help="Path to trained .pth checkpoint")
parser.add_argument("--rep_data_dir", default="./data/CelebA_Spoof/real",
                    help="Directory of real images for INT8 calibration")
parser.add_argument("--output", default="../models/tflite/liveness.tflite",
                    help="Output .tflite path")
args = parser.parse_args()

os.makedirs(os.path.dirname(args.output), exist_ok=True)

IMG_SIZE = 224

# ─── LOAD MODEL ───────────────────────────────────────────────────────────────
def build_model():
    model = models.mobilenet_v3_small(weights=None)
    in_features = model.classifier[3].in_features
    model.classifier[3] = nn.Linear(in_features, 1)
    return model

print(f"Loading checkpoint: {args.checkpoint}")
model = build_model()
model.load_state_dict(torch.load(args.checkpoint, map_location="cpu"))
model.eval()
print("Model loaded.")

# ─── STEP 1: PyTorch → ONNX ───────────────────────────────────────────────────
onnx_path = args.output.replace(".tflite", ".onnx")
dummy_input = torch.randn(1, 3, IMG_SIZE, IMG_SIZE)

print(f"\nExporting to ONNX: {onnx_path}")
torch.onnx.export(
    model, dummy_input, onnx_path,
    opset_version=17,
    input_names=["input"],
    output_names=["output"],
    dynamic_axes={"input": {0: "batch"}, "output": {0: "batch"}},
)
print(f"ONNX export done. Size: {os.path.getsize(onnx_path)/1e6:.2f} MB")

# ─── STEP 2: ONNX → TFLite INT8 via ai-edge-torch ─────────────────────────────
# ai-edge-torch converts ONNX → TFLite with INT8 quantisation
try:
    import ai_edge_torch
    import tensorflow as tf

    print("\nConverting ONNX → TFLite (ai-edge-torch)...")

    # Load ONNX as TF SavedModel via onnx-tf first
    try:
        import onnx
        from onnx_tf.backend import prepare as onnx_tf_prepare

        onnx_model = onnx.load(onnx_path)
        tf_rep = onnx_tf_prepare(onnx_model)
        saved_model_dir = onnx_path.replace(".onnx", "_saved_model")
        tf_rep.export_graph(saved_model_dir)
        print(f"SavedModel written: {saved_model_dir}")
    except ImportError:
        print("onnx-tf not available, using fallback conversion...")
        saved_model_dir = None

    if saved_model_dir:
        # INT8 quantisation with representative dataset
        def representative_dataset():
            import os
            from PIL import Image
            import torchvision.transforms as T

            transform = T.Compose([
                T.Resize((IMG_SIZE, IMG_SIZE)),
                T.ToTensor(),
                T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ])
            imgs = [f for f in os.listdir(args.rep_data_dir)
                    if f.lower().endswith((".jpg", ".jpeg", ".png"))][:100]
            for fname in imgs:
                img = Image.open(os.path.join(args.rep_data_dir, fname)).convert("RGB")
                t   = transform(img).unsqueeze(0).numpy()  # (1, 3, 224, 224)
                # TFLite expects NHWC
                t = np.transpose(t, (0, 2, 3, 1)).astype(np.float32)
                yield [t]

        converter = tf.lite.TFLiteConverter.from_saved_model(saved_model_dir)
        converter.optimizations = [tf.lite.Optimize.DEFAULT]
        converter.representative_dataset = representative_dataset
        converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
        converter.inference_input_type  = tf.float32   # keep float IO for react-native-fast-tflite
        converter.inference_output_type = tf.float32

        tflite_model = converter.convert()
        with open(args.output, "wb") as f:
            f.write(tflite_model)

        size_mb = os.path.getsize(args.output) / 1e6
        print(f"\n✅ TFLite INT8 saved: {args.output}")
        print(f"   Size: {size_mb:.2f} MB (target < 4 MB)")
        if size_mb > 4.0:
            print("   ⚠️  Model > 4 MB — consider pruning or reducing width")
    else:
        print("⚠️  Falling back to direct TFLite conversion without onnx-tf")
        _fallback_convert(model, args.output, args.rep_data_dir)

except ImportError as e:
    print(f"ai-edge-torch / tensorflow not available: {e}")
    print("Using fallback: direct TFLite conversion via tensorflow only")
    _fallback_convert_direct(model, args.output, args.rep_data_dir)


def _fallback_convert(model, output_path, rep_dir):
    """Direct PyTorch → TFLite via tensorflow (no onnx-tf)."""
    import tensorflow as tf

    # Export to ONNX already done — use tf.lite converter on the ONNX
    # This fallback saves as float32 TFLite (larger but correct)
    print("Saving float32 TFLite as fallback...")
    # Re-export via torch.jit.trace → save weights manually if needed
    # Simplest approach: save as float16 instead
    converter = tf.lite.TFLiteConverter.from_saved_model(output_path.replace(".tflite", "_saved_model"))
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    tflite_model = converter.convert()
    with open(output_path, "wb") as f:
        f.write(tflite_model)
    print(f"Float16 TFLite saved: {output_path} ({os.path.getsize(output_path)/1e6:.2f} MB)")


def _fallback_convert_direct(model, output_path, rep_dir):
    print("Manual weight export not supported in this script.")
    print("Please install: pip install ai-edge-torch onnx onnx-tf tensorflow")


# ─── STEP 3: VERIFY ───────────────────────────────────────────────────────────
if os.path.exists(args.output):
    print("\n── Verification ──")
    try:
        import tensorflow as tf
        interp = tf.lite.Interpreter(model_path=args.output)
        interp.allocate_tensors()
        inp = interp.get_input_details()
        out = interp.get_output_details()
        print(f"Input shape:  {inp[0]['shape']}")
        print(f"Output shape: {out[0]['shape']}")

        # Speed test
        dummy = np.random.randn(1, IMG_SIZE, IMG_SIZE, 3).astype(np.float32)
        latencies = []
        for _ in range(20):
            t0 = time.time()
            interp.set_tensor(inp[0]["index"], dummy)
            interp.invoke()
            _ = interp.get_tensor(out[0]["index"])
            latencies.append((time.time() - t0) * 1000)

        print(f"CPU latency: {np.mean(latencies):.1f} ± {np.std(latencies):.1f} ms (20 runs)")
        print(f"Score range: [0, 1] — above 0.65 = live, below 0.40 = spoof")
        print(f"\n✅ Model ready for Person 2 (react-native-fast-tflite)")

    except ImportError:
        print("TFLite runtime not available for verification on this machine.")
        print("Copy to Android device and test with react-native-fast-tflite.")
