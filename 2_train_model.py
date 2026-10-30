"""
Step 2: Fine-tune YOLOv8 on your custom dataset.

Features:
- Auto-locates dataset directory and data.yaml
- Auto-detects and converts Roboflow OBB format (8 points) to standard YOLO format (x, y, w, h)
- Safely fine-tunes pretrained yolov8n.pt using transfer learning

Usage:
    python 2_train_model.py
"""

import os
import shutil
from pathlib import Path
import torch
from ultralytics import YOLO

# Fix for PyTorch 2.6+ weights_only issue with YOLO models
_orig_torch_load = torch.load
def _custom_torch_load(*args, **kwargs):
    if 'weights_only' not in kwargs:
        kwargs['weights_only'] = False
    return _orig_torch_load(*args, **kwargs)
torch.load = _custom_torch_load


def find_dataset_yaml():
    """Finds data.yaml in dataset/ or any roboflow folder."""
    candidates = [
        Path("dataset/data.yaml"),
        Path("person  detectio system.v2i.yolov8-obb/data.yaml"),
    ]
    for c in candidates:
        if c.exists():
            return c
    
    # Search recursively
    matches = list(Path(".").glob("**/data.yaml"))
    if matches:
        return matches[0]
    return None


def convert_obb_to_standard_yolo(data_yaml_path: Path):
    """
    If labels contain 8-coordinate OBB points (x1 y1 x2 y2 x3 y3 x4 y4),
    converts them to standard YOLO bounding box format (class x_center y_center w h)
    so standard YOLOv8 models can train cleanly.
    """
    dataset_dir = data_yaml_path.parent
    label_files = list(dataset_dir.glob("**/*.txt"))
    converted_count = 0

    for lf in label_files:
        if lf.name.startswith("README") or lf.name == "data.yaml":
            continue
        try:
            with open(lf, "r", encoding="utf-8") as f:
                lines = f.readlines()
            
            new_lines = []
            modified = False
            for line in lines:
                parts = line.strip().split()
                if len(parts) == 9: # class + 8 coordinates (OBB format)
                    cls_id = parts[0]
                    coords = [float(p) for p in parts[1:]]
                    xs = coords[0::2]
                    ys = coords[1::2]
                    min_x, max_x = max(0.0, min(xs)), min(1.0, max(xs))
                    min_y, max_y = max(0.0, min(ys)), min(1.0, max(ys))
                    
                    x_center = (min_x + max_x) / 2.0
                    y_center = (min_y + max_y) / 2.0
                    w = max_x - min_x
                    h = max_y - min_y
                    
                    new_lines.append(f"{cls_id} {x_center:.6f} {y_center:.6f} {w:.6f} {h:.6f}\n")
                    modified = True
                else:
                    new_lines.append(line)

            if modified:
                with open(lf, "w", encoding="utf-8") as f:
                    f.writelines(new_lines)
                converted_count += 1
        except Exception:
            pass

    if converted_count > 0:
        print(f"[Dataset] Converted {converted_count} OBB label files to standard YOLO bounding box format.")


def train():
    yaml_path = find_dataset_yaml()
    if not yaml_path:
        print("[ERROR] Could not find data.yaml! Please ensure your dataset is extracted.")
        return

    print(f"Using dataset config: {yaml_path}")
    convert_obb_to_standard_yolo(yaml_path)

    # Load pretrained YOLOv8 model
    model = YOLO("yolov8n.pt")

    # Fine-tune on custom dataset
    results = model.train(
        data=str(yaml_path.resolve()),
        epochs=30,
        imgsz=640,
        batch=4,
        patience=8,
        project="runs",
        name="presence_model",
        pretrained=True,
        exist_ok=True
    )

    print("\nTraining complete!")
    print("Best model saved at: runs/presence_model/weights/best.pt")


if __name__ == "__main__":
    train()
