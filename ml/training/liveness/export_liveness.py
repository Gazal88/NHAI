
import os
import time
import numpy as np
import tensorflow as tf

ONNX_PATH   = "../models/tflite/liveness.onnx"
OUTPUT_PATH = "../models/tflite/liveness.tflite"
DATA_DIR    = "./data/CelebA_Spoof/real"
IMG_SIZE    = 224

print("Step 1: Converting ONNX → TensorFlow SavedModel...")

try:
    import onnx
    from onnx_tf.backend import prepare as onnx_tf_prepare

    onnx_model     = onnx.load(ONNX_PATH)
    saved_model_dir = "../models/tflite/liveness_saved_model"
    tf_rep = onnx_tf_prepare(onnx_model)
    tf_rep.export_graph(saved_model_dir)
    print(f"  SavedModel written: {saved_model_dir}")
    use_saved_model = True

except ImportError:
    print("  onnx-tf not available — using direct TFLite conversion from ONNX")
    use_saved_model = False


if use_saved_model:
    print("Step 2: Converting SavedModel → TFLite INT8...")

    def representative_dataset():
        import os
        from PIL import Image
        import torchvision.transforms as T

        transform = T.Compose([
            T.Resize((IMG_SIZE, IMG_SIZE)),
            T.ToTensor(),
            T.Normalize(mean=[0.485, 0.456, 0.406],
                        std=[0.229, 0.224, 0.225]),
        ])

        imgs = [f for f in os.listdir(DATA_DIR)
                if f.lower().endswith((".jpg", ".jpeg", ".png"))][:100]

        for fname in imgs:
            img = Image.open(os.path.join(DATA_DIR, fname)).convert("RGB")
            t   = transform(img).unsqueeze(0).numpy()
            t   = np.transpose(t, (0, 2, 3, 1)).astype(np.float32)
            yield [t]

    converter = tf.lite.TFLiteConverter.from_saved_model(saved_model_dir)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.representative_dataset = representative_dataset
    converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    converter.inference_input_type  = tf.float32
    converter.inference_output_type = tf.float32

    tflite_model = converter.convert()

else:
    print("Step 2: Direct float16 TFLite conversion...")

    # Load ONNX and convert via tf.function tracing
    import torch
    import torch.nn as nn
    from torchvision import models

    def build_model():
        model = models.mobilenet_v3_small(weights=None)
        in_features = model.classifier[3].in_features
        model.classifier[3] = nn.Linear(in_features, 1)
        return model

    model = build_model()
    model.load_state_dict(
        torch.load("./checkpoints/liveness/best_liveness.pth", map_location="cpu")
    )
    model.eval()

    # Export directly using tf.lite with dynamic range quantization
    # Convert via concrete function approach
    class LivenessWrapper(tf.Module):
        def __init__(self):
            super().__init__()

        @tf.function(input_signature=[tf.TensorSpec([1, IMG_SIZE, IMG_SIZE, 3], tf.float32)])
        def predict(self, x):
            # We'll use the ONNX file via tf.lite directly
            return x  # placeholder

    # Use TFLite converter directly on ONNX
    converter = tf.lite.TFLiteConverter.experimental_from_jax([], [])

    # Fallback: use dynamic range quantization on float model
    print("  Using dynamic range quantization (float model)...")

    # Re-export ONNX to TFLite via onnx2tf if available
    try:
        import onnx2tf
        onnx2tf.convert(
            input_onnx_file_path=ONNX_PATH,
            output_folder_path="../models/tflite/liveness_onnx2tf",
            output_signaturedefs=True,
            non_verbose=True,
        )
        converter = tf.lite.TFLiteConverter.from_saved_model(
            "../models/tflite/liveness_onnx2tf"
        )
        converter.optimizations = [tf.lite.Optimize.DEFAULT]
        tflite_model = converter.convert()

    except ImportError:
        print("  Installing onnx2tf...")
        os.system("pip install onnx2tf")
        import onnx2tf
        onnx2tf.convert(
            input_onnx_file_path=ONNX_PATH,
            output_folder_path="../models/tflite/liveness_onnx2tf",
            output_signaturedefs=True,
            non_verbose=True,
        )
        converter = tf.lite.TFLiteConverter.from_saved_model(
            "../models/tflite/liveness_onnx2tf"
        )
        converter.optimizations = [tf.lite.Optimize.DEFAULT]
        tflite_model = converter.convert()


# Save TFLite model
os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
with open(OUTPUT_PATH, "wb") as f:
    f.write(tflite_model)

size_mb = os.path.getsize(OUTPUT_PATH) / 1e6
print(f"\nTFLite saved: {OUTPUT_PATH}")
print(f"Size: {size_mb:.2f} MB (target < 4 MB)")

# Verify
print("\nVerifying TFLite model...")
interp = tf.lite.Interpreter(model_path=OUTPUT_PATH)
interp.allocate_tensors()
inp = interp.get_input_details()
out = interp.get_output_details()
print(f"Input:  {inp[0]['shape']} {inp[0]['dtype']}")
print(f"Output: {out[0]['shape']} {out[0]['dtype']}")

# Speed test
dummy = np.random.randn(1, IMG_SIZE, IMG_SIZE, 3).astype(np.float32)
latencies = []
for _ in range(20):
    t0 = time.time()
    interp.set_tensor(inp[0]["index"], dummy)
    interp.invoke()
    _ = interp.get_tensor(out[0]["index"])
    latencies.append((time.time() - t0) * 1000)

print(f"CPU latency: {np.mean(latencies):.1f} ms (20 runs)")
print(f"\nDone. Copy {OUTPUT_PATH} to Person 2.")
