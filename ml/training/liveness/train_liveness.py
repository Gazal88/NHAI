"""
train_liveness.py — MobileNetV3-Small Liveness Classifier
Hackathon 7.0 | ML Lead (Person 1)

Dataset: CelebA-Spoof
Task: Binary classification — real face (1) vs spoof (0)
Hardware: RTX 4050 6GB VRAM, CUDA 12.1, PyTorch 2.x
Target: > 95% TPR, > 93% TNR, < 4 MB TFLite INT8
"""

import os
import time
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader, random_split
from torchvision import transforms, models
from torch.utils.tensorboard import SummaryWriter
from PIL import Image
import numpy as np

# ─── CONFIG ───────────────────────────────────────────────────────────────────
DATASET_ROOT  = "./data/CelebA_Spoof"   # adjust to your actual path
CHECKPOINT_DIR = "./checkpoints/liveness"
LOG_DIR        = "./logs/liveness"
BATCH_SIZE     = 64
NUM_EPOCHS     = 30
LR             = 1e-4
VAL_SPLIT      = 0.2
IMG_SIZE       = 224
CHECKPOINT_EVERY = 5
SEED           = 42

os.makedirs(CHECKPOINT_DIR, exist_ok=True)
os.makedirs(LOG_DIR, exist_ok=True)
torch.manual_seed(SEED)

# ─── DATASET ──────────────────────────────────────────────────────────────────
class CelebASpoofDataset(Dataset):
    """
    Expects folder structure:
        DATASET_ROOT/
            real/   ← label 1
            spoof/  ← label 0
    """
    EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp"}

    def __init__(self, root, transform=None):
        self.samples = []
        self.transform = transform

        for label, folder in [(1, "real"), (0, "spoof")]:
            folder_path = os.path.join(root, folder)
            if not os.path.isdir(folder_path):
                raise FileNotFoundError(
                    f"Expected folder: {folder_path}\n"
                    f"Make sure CelebA-Spoof is extracted with real/ and spoof/ subfolders."
                )
            for fname in os.listdir(folder_path):
                if os.path.splitext(fname)[1].lower() in self.EXTENSIONS:
                    self.samples.append((os.path.join(folder_path, fname), label))

        print(f"Dataset loaded: {len(self.samples)} images")
        real_count  = sum(1 for _, l in self.samples if l == 1)
        spoof_count = sum(1 for _, l in self.samples if l == 0)
        print(f"  Real:  {real_count}")
        print(f"  Spoof: {spoof_count}")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        path, label = self.samples[idx]
        img = Image.open(path).convert("RGB")
        if self.transform:
            img = self.transform(img)
        return img, torch.tensor(label, dtype=torch.float32)


# ─── TRANSFORMS ───────────────────────────────────────────────────────────────
train_transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.RandomHorizontalFlip(),
    transforms.RandomRotation(15),
    transforms.ColorJitter(brightness=0.3, contrast=0.2, saturation=0.2),
    transforms.GaussianBlur(kernel_size=3, sigma=(0.0, 1.5)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])

val_transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])


# ─── MODEL ────────────────────────────────────────────────────────────────────
def build_model():
    model = models.mobilenet_v3_small(weights=models.MobileNet_V3_Small_Weights.IMAGENET1K_V1)
    # Replace classifier head: 576 → 1 (binary)
    in_features = model.classifier[3].in_features
    model.classifier[3] = nn.Linear(in_features, 1)
    return model


# ─── TRAIN LOOP ───────────────────────────────────────────────────────────────
def train():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")
    if device.type == "cuda":
        print(f"GPU: {torch.cuda.get_device_name(0)}")

    # Dataset + split
    full_dataset = CelebASpoofDataset(DATASET_ROOT, transform=train_transform)
    val_size  = int(len(full_dataset) * VAL_SPLIT)
    train_size = len(full_dataset) - val_size
    train_ds, val_ds = random_split(
        full_dataset, [train_size, val_size],
        generator=torch.Generator().manual_seed(SEED)
    )
    # Val set uses val_transform — patch it
    val_ds.dataset = CelebASpoofDataset(DATASET_ROOT, transform=val_transform)
    val_ds.indices = list(range(train_size, len(full_dataset)))

    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True,
                              num_workers=4, pin_memory=True)
    val_loader   = DataLoader(val_ds,   batch_size=BATCH_SIZE, shuffle=False,
                              num_workers=4, pin_memory=True)

    model     = build_model().to(device)
    criterion = nn.BCEWithLogitsLoss()
    optimizer = optim.Adam(model.parameters(), lr=LR)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=NUM_EPOCHS)
    writer    = SummaryWriter(LOG_DIR)

    best_val_acc = 0.0
    best_ckpt    = os.path.join(CHECKPOINT_DIR, "best_liveness.pth")

    for epoch in range(1, NUM_EPOCHS + 1):
        # ── TRAIN ──
        model.train()
        train_loss, train_correct, train_total = 0.0, 0, 0
        t0 = time.time()

        for imgs, labels in train_loader:
            imgs, labels = imgs.to(device), labels.to(device)
            optimizer.zero_grad()
            logits = model(imgs).squeeze(1)
            loss   = criterion(logits, labels)
            loss.backward()
            optimizer.step()

            preds = (torch.sigmoid(logits) > 0.5).long()
            train_correct += (preds == labels.long()).sum().item()
            train_total   += labels.size(0)
            train_loss    += loss.item() * labels.size(0)

        train_acc  = train_correct / train_total
        train_loss = train_loss / train_total

        # ── VAL ──
        model.eval()
        val_loss, val_correct, val_total = 0.0, 0, 0
        tp, tn, fp, fn = 0, 0, 0, 0

        with torch.no_grad():
            for imgs, labels in val_loader:
                imgs, labels = imgs.to(device), labels.to(device)
                logits = model(imgs).squeeze(1)
                loss   = criterion(logits, labels)
                probs  = torch.sigmoid(logits)
                preds  = (probs > 0.5).long()
                labels_int = labels.long()

                val_correct += (preds == labels_int).sum().item()
                val_total   += labels.size(0)
                val_loss    += loss.item() * labels.size(0)

                tp += ((preds == 1) & (labels_int == 1)).sum().item()
                tn += ((preds == 0) & (labels_int == 0)).sum().item()
                fp += ((preds == 1) & (labels_int == 0)).sum().item()
                fn += ((preds == 0) & (labels_int == 1)).sum().item()

        val_acc  = val_correct / val_total
        val_loss = val_loss / val_total
        tpr = tp / (tp + fn + 1e-9)   # sensitivity (real face detection rate)
        tnr = tn / (tn + fp + 1e-9)   # specificity (spoof rejection rate)
        elapsed = time.time() - t0

        scheduler.step()

        print(
            f"Epoch {epoch:02d}/{NUM_EPOCHS} | "
            f"Train Acc: {train_acc:.4f} | Val Acc: {val_acc:.4f} | "
            f"TPR: {tpr:.4f} | TNR: {tnr:.4f} | "
            f"Loss: {val_loss:.4f} | Time: {elapsed:.1f}s"
        )

        writer.add_scalars("Accuracy", {"train": train_acc, "val": val_acc}, epoch)
        writer.add_scalars("Loss", {"train": train_loss, "val": val_loss}, epoch)
        writer.add_scalar("TPR", tpr, epoch)
        writer.add_scalar("TNR", tnr, epoch)

        # ── CHECKPOINT ──
        if epoch % CHECKPOINT_EVERY == 0:
            ckpt_path = os.path.join(CHECKPOINT_DIR, f"liveness_epoch{epoch:02d}.pth")
            torch.save(model.state_dict(), ckpt_path)
            print(f"  Checkpoint saved: {ckpt_path}")

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save(model.state_dict(), best_ckpt)
            print(f"  ✅ New best model saved (val_acc={val_acc:.4f})")

    writer.close()
    print(f"\nTraining complete. Best val accuracy: {best_val_acc:.4f}")
    print(f"Best checkpoint: {best_ckpt}")
    return best_ckpt


if __name__ == "__main__":
    best_ckpt = train()
    print(f"\nNext step: run export_liveness.py --checkpoint {best_ckpt}")
