"""Train a YOLOv8 model for employee presence detection.

This script automatically extracts a YOLO dataset ZIP file if provided,
loads the extracted dataset configuration from data.yaml, and runs transfer
learning from a pretrained YOLOv8 model.
"""

import argparse
import random
import shutil
import sys
import zipfile
from pathlib import Path

try:
    import yaml
except ImportError:
    yaml = None

try:
    from ultralytics import YOLO
except ImportError:
    YOLO = None


def check_dependencies():
    missing = []
    if YOLO is None:
        missing.append("ultralytics")
    if yaml is None:
        missing.append("pyyaml")
    if missing:
        print("Missing dependencies: {}".format(", ".join(missing)))
        print("Install them with: pip install -r requirements.txt")
        sys.exit(1)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Train YOLOv8 on a custom employee presence dataset.")
    parser.add_argument(
        "--dataset-zip",
        type=Path,
        help="Path to the downloaded YOLO ZIP export from Roboflow.")
    parser.add_argument(
        "--dataset-dir",
        type=Path,
        help="Path to an already extracted dataset directory containing data.yaml.")
    parser.add_argument(
        "--model",
        type=str,
        default="yolov8n.pt",
        help="Pretrained YOLOv8 model to use for transfer learning.")
    parser.add_argument(
        "--epochs",
        type=int,
        default=30,
        help="Number of epochs to train.")
    parser.add_argument(
        "--batch",
        type=int,
        default=8,
        help="Batch size for training.")
    parser.add_argument(
        "--imgsz",
        type=int,
        default=640,
        help="Input image size for training.")
    parser.add_argument(
        "--lr",
        type=float,
        default=0.01,
        help="Base learning rate for the optimizer.")
    parser.add_argument(
        "--patience",
        type=int,
        default=10,
        help="Early stopping patience in epochs.")
    parser.add_argument(
        "--project",
        type=Path,
        default=Path("runs/train"),
        help="Directory where YOLO training runs are saved.")
    parser.add_argument(
        "--name",
        type=str,
        default="presence_model",
        help="Name of the training run subfolder.")
    return parser.parse_args()


def extract_zip(dataset_zip: Path, output_dir: Path) -> Path:
    if not dataset_zip.exists():
        raise FileNotFoundError(f"Dataset ZIP not found: {dataset_zip}")

    output_dir.mkdir(parents=True, exist_ok=True)
    print(f"Extracting dataset ZIP to {output_dir}...")
    with zipfile.ZipFile(dataset_zip, "r") as archive:
        archive.extractall(output_dir)

    return output_dir


def find_data_yaml(search_dir: Path) -> Path:
    candidate = search_dir / "data.yaml"
    if candidate.exists():
        return candidate

    matches = list(search_dir.rglob("data.yaml"))
    if not matches:
        raise FileNotFoundError(
            f"Could not find data.yaml under {search_dir}."
            " Confirm the dataset export was extracted correctly.")
    return matches[0]


def load_data_yaml(data_yaml_path: Path) -> dict:
    if not yaml:
        raise RuntimeError("PyYAML is required to read data.yaml.")

    with data_yaml_path.open("r", encoding="utf-8") as fp:
        data = yaml.safe_load(fp)

    if not isinstance(data, dict):
        raise ValueError(f"Invalid YAML format in {data_yaml_path}")

    return data


def resolve_dataset_root(data_yaml_path: Path) -> Path:
    return data_yaml_path.parent


def save_data_yaml(data_yaml_path: Path, data: dict) -> None:
    with data_yaml_path.open("w", encoding="utf-8") as fp:
        yaml.safe_dump(data, fp, sort_keys=False)


def create_validation_split(dataset_root: Path, data: dict, split_ratio: float = 0.1) -> None:
    train_path = dataset_root / data["train"]
    if not train_path.exists():
        raise FileNotFoundError(f"Train path does not exist: {train_path}")

    train_base = train_path.parent
    train_labels_dir = train_base / "labels"
    val_images_dir = dataset_root / "valid" / "images"
    val_labels_dir = dataset_root / "valid" / "labels"
    val_images_dir.mkdir(parents=True, exist_ok=True)
    val_labels_dir.mkdir(parents=True, exist_ok=True)

    image_files = sorted(
        list(train_path.glob("*.jpg"))
        + list(train_path.glob("*.jpeg"))
        + list(train_path.glob("*.png"))
    )
    if not image_files:
        raise FileNotFoundError(f"No train images found in {train_path}")

    sample_count = max(1, int(len(image_files) * split_ratio))
    random.seed(42)
    sample_images = random.sample(image_files, sample_count)

    print(f"Creating validation split from {len(image_files)} train images ({sample_count} selected)")
    for image_path in sample_images:
        target_image = val_images_dir / image_path.name
        print(f"Copying image: {image_path} -> {target_image}")
        shutil.copy2(image_path, target_image)

        label_path = train_labels_dir / f"{image_path.stem}.txt"
        if label_path.exists():
            target_label = val_labels_dir / label_path.name
            shutil.copy2(label_path, target_label)
            print(f"Copying label: {label_path} -> {target_label}")
        else:
            print(f"Warning: label file not found for {image_path.name}")

    data["val"] = "valid/images"
    print(f"Created validation split with {len(sample_images)} images.")


def validate_dataset_config(data: dict, dataset_root: Path, data_yaml_path: Path) -> None:
    if "train" not in data:
        raise ValueError("data.yaml must contain a 'train' entry.")

    if "names" not in data or not data["names"]:
        raise ValueError("data.yaml must declare class names under 'names'.")

    train_path = dataset_root / data["train"]
    if not train_path.exists():
        raise FileNotFoundError(f"Train path does not exist: {train_path}")

    val_path = dataset_root / data.get("val", "valid/images")
    if "val" not in data or not val_path.exists() or not any(val_path.iterdir()):
        print("Validation set missing or empty. Creating a small validation split from training data.")
        create_validation_split(dataset_root, data)
        save_data_yaml(data_yaml_path, data)
        val_path = dataset_root / data["val"]

    if not val_path.exists() or not any(val_path.iterdir()):
        print("Warning: Created valid/images is empty. Falling back to train/images for validation.")
        data["val"] = data["train"]
        save_data_yaml(data_yaml_path, data)
        val_path = dataset_root / data["val"]

    if not val_path.exists():
        raise FileNotFoundError(f"Validation path does not exist: {val_path}")

    class_count = len(data["names"])
    if class_count != 1:
        print("Warning: This pipeline is optimized for a single-class dataset.")
    if data["names"][0] != "person":
        print(
            "Notice: Dataset class name is not 'person'. "
            "The model will still train, but inference labels will be shown as 'person'.")


def print_metrics(results):
    metrics = None
    if hasattr(results, "metrics"):
        metrics = results.metrics
    elif isinstance(results, (list, tuple)) and results:
        metrics = getattr(results[0], "metrics", None)

    if isinstance(metrics, dict):
        print("\nTraining metrics summary:")
        for key in ["loss", "box_loss", "cls_loss", "dfl_loss", "precision", "recall", "mAP_0.5", "mAP_0.5:0.95"]:
            if key in metrics:
                print(f"  {key}: {metrics[key]:.4f}")
    else:
        print(
            "Training completed. Metrics are available in the YOLO run directory.")


def main():
    check_dependencies()
    args = parse_args()

    if not args.dataset_zip and not args.dataset_dir:
        raise ValueError(
            "Provide either --dataset-zip or --dataset-dir to locate your dataset.")

    if args.dataset_zip and not args.dataset_zip.exists():
        raise FileNotFoundError(
            f"Dataset ZIP not found: {args.dataset_zip}")

    dataset_root = None
    if args.dataset_zip:
        extraction_target = args.dataset_dir or Path("dataset")
        extract_zip(args.dataset_zip, extraction_target)
        data_yaml_path = find_data_yaml(extraction_target)
        dataset_root = resolve_dataset_root(data_yaml_path)
    else:
        if not args.dataset_dir.exists():
            raise FileNotFoundError(
                f"Dataset directory not found: {args.dataset_dir}")
        data_yaml_path = find_data_yaml(args.dataset_dir)
        dataset_root = resolve_dataset_root(data_yaml_path)

    data = load_data_yaml(data_yaml_path)
    validate_dataset_config(data, dataset_root, data_yaml_path)

    print("\nStarting YOLOv8 transfer learning training")
    print(f" Dataset root: {dataset_root}")
    print(f" YAML config: {data_yaml_path}")
    print(f" Pretrained model: {args.model}")
    print(f" Epochs: {args.epochs}, Batch: {args.batch}, Image size: {args.imgsz}")
    print(f" Learning rate: {args.lr}, Patience: {args.patience}")
    print(f" Save run under: {args.project / args.name}\n")

    model = YOLO(args.model)

    results = model.train(
        data=str(data_yaml_path),
        epochs=args.epochs,
        batch=args.batch,
        imgsz=args.imgsz,
        lr0=args.lr,
        patience=args.patience,
        project=str(args.project),
        name=args.name,
        exist_ok=True,
    )

    best_source = args.project / args.name / "weights" / "best.pt"
    if not best_source.exists():
        raise FileNotFoundError(
            f"Expected best weights at {best_source} but file was not found.")

    best_target = Path.cwd() / "best.pt"
    shutil.copy2(best_source, best_target)
    print(f"\nBest model saved to: {best_target}")
    print(f"Full training output saved under: {args.project / args.name}")

    print_metrics(results)
    print("\nTraining finished successfully.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Error: {exc}")
        sys.exit(1)
