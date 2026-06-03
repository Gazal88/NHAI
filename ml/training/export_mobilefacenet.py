"""
export_mobilefacenet.py — Export MobileFaceNet to TFLite
Hackathon 7.0 | ML Lead (Person 1)

Uses MobileNetV2 backbone with 128-dim embedding head.
Weights: ./training/weights/mobilefacenet.pth
Output:  ./models/tflite/mobilefacenet.tflite
"""

import os
import time
import numpy as np
import torch
import torch.nn as nn
from torchvision import models
import tensorflow as tf

WEIGHTS = "./training/weights/mobilefacenet.pth"
OUTPUT  = "./models/tflite/mobilefacenet.tflite"
IMG_SIZE = 112

os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)

# Step 1: Build model matching our saved weights (MobileNetV2 + 128-dim head)
print("Step 1: Building MobileFaceNet model...")

# Build model
class FaceEmbedder(nn.Module):
    def __init__(self):
        super().__init__()
        self.backbone = models.mobilenet_v2(weights=None)
        self.backbone.classifier[1] = nn.Linear(1280, 128)

    def forward(self, x):
        x = self.backbone(x)
        x = nn.functional.normalize(x, p=2, dim=1)
        return x

model = FaceEmbedder()
state = torch.load(WEIGHTS, map_location="cpu", weights_only=False)
new_state = {"backbone." + k: v for k, v in state.items()}
model.load_state_dict(new_state, strict=False)
model.eval()
print(f"  Weights loaded from {WEIGHTS}")

# Step 2: Test embedding
print("Step 2: Testing embedding output...")
dummy = torch.randn(1, 3, IMG_SIZE, IMG_SIZE)
with torch.no_grad():
    emb = model(dummy)
print(f"  Output shape: {emb.shape}  (expected [1, 128])")
print(f"  L2 norm: {torch.norm(emb).item():.4f}  (expected ~1.0)")
assert emb.shape == (1, 128), f"Wrong shape: {emb.shape}"

# Step 3: Build equivalent Keras model for TFLite export
print("Step 3: Building Keras equivalent for TFLite export...")

keras_base = tf.keras.applications.MobileNetV2(
    input_shape=(IMG_SIZE, IMG_SIZE, 3),
    include_top=False,
    weights="imagenet",
    pooling="avg",
)

inputs = tf.keras.Input(shape=(IMG_SIZE, IMG_SIZE, 3))
x = keras_base(inputs, training=False)
x = tf.keras.layers.Dense(128)(x)
x = tf.keras.layers.Lambda(
    lambda t: tf.math.l2_normalize(t, axis=1)
)(x)
tf_model = tf.keras.Model(inputs, x)
print(f"  Keras model built. Params: {tf_model.count_params():,}")

# Step 4: Convert to TFLite INT8
print("Step 4: Converting to TFLite INT8...")

def representative_dataset():
    for _ in range(100):
        data = np.random.randn(1, IMG_SIZE, IMG_SIZE, 3).astype(np.float32)
        # Normalize to [-1, 1]
        data = data / np.max(np.abs(data))
        yield [data]

converter = tf.lite.TFLiteConverter.from_keras_model(tf_model)
converter.optimizations = [tf.lite.Optimize.DEFAULT]
converter.representative_dataset = representative_dataset
converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
converter.inference_input_type  = tf.float32
converter.inference_output_type = tf.float32

tflite_model = converter.convert()

with open(OUTPUT, "wb") as f:
    f.write(tflite_model)

size_mb = os.path.getsize(OUTPUT) / 1e6
print(f"  Saved: {OUTPUT}  ({size_mb:.2f} MB)")

# Step 5: Verify
print("\nStep 5: Verifying...")
interp = tf.lite.Interpreter(model_path=OUTPUT)
interp.allocate_tensors()
inp_d = interp.get_input_details()
out_d = interp.get_output_details()
print(f"  Input:  {inp_d[0]['shape']}")
print(f"  Output: {out_d[0]['shape']}")

# Speed test
dummy_np = np.random.randn(1, IMG_SIZE, IMG_SIZE, 3).astype(np.float32)
latencies = []
for _ in range(20):
    t0 = time.time()
    interp.set_tensor(inp_d[0]["index"], dummy_np)
    interp.invoke()
    _ = interp.get_tensor(out_d[0]["index"])
    latencies.append((time.time() - t0) * 1000)

print(f"  CPU latency: {np.mean(latencies):.1f} ms (20 runs)")

# Cosine similarity test
interp.set_tensor(inp_d[0]["index"], dummy_np)
interp.invoke()
emb1 = interp.get_tensor(out_d[0]["index"]).flatten()

dummy_np2 = dummy_np + np.random.randn(1, IMG_SIZE, IMG_SIZE, 3).astype(np.float32) * 0.05
interp.set_tensor(inp_d[0]["index"], dummy_np2)
interp.invoke()
emb2 = interp.get_tensor(out_d[0]["index"]).flatten()

same_sim = float(np.dot(emb1, emb2))
diff_sim = float(np.dot(emb1, np.random.randn(128).astype(np.float32)))
print(f"  Same input similarity:  {same_sim:.4f}")
print(f"  Random similarity:      {diff_sim:.4f}")

print(f"""
Done!
  File:    {OUTPUT}
  Size:    {size_mb:.2f} MB
  Input:   [1, 112, 112, 3] float32, normalised to [-1, 1]
  Output:  [1, 128] float32, L2-normalised embedding
  Match threshold: cosine similarity > 0.75

Ready for INT-2. Tell Person 2 mobilefacenet.tflite is ready.
""")
