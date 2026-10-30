"""Run inference with the best trained YOLOv8 model on test images and webcam."""

import argparse
import sys
from pathlib import Path

import cv2

try:
    from ultralytics import YOLO
except ImportError:
    YOLO = None


def check_dependencies():
    if YOLO is None:
        print("Missing dependency: ultralytics")
        print("Install it with: pip install -r requirements.txt")
        sys.exit(1)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Run person detection using a trained YOLOv8 model.")
    parser.add_argument(
        "--model",
        type=Path,
        default=Path("best.pt"),
        help="Path to the trained YOLOv8 model weights (best.pt).")
    parser.add_argument(
        "--dataset-dir",
        type=Path,
        default=Path("person  detectio system.v2i.yolov8-obb"),
        help="Path to the extracted dataset directory containing test/images.")
    parser.add_argument(
        "--confidence",
        type=float,
        default=0.9,
        help="Minimum confidence threshold for detections. Increase this to reduce false positives.")
    parser.add_argument(
        "--min-area",
        type=int,
        default=6000,
        help="Minimum bounding box area (pixels) to keep a detection.")
    parser.add_argument(
        "--camera",
        type=int,
        default=0,
        help="Webcam index to use for live inference.")
    parser.add_argument(
        "--webcam-only",
        action="store_true",
        help="Run only webcam inference and skip dataset image processing.")
    parser.add_argument(
        "--skip-webcam",
        action="store_true",
        help="Skip webcam inference and only process images.")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("runs/detect"),
        help="Directory where inference result images are saved.")
    return parser.parse_args()


import torch
_orig_torch_load = torch.load
def _custom_torch_load(*args, **kwargs):
    if 'weights_only' not in kwargs:
        kwargs['weights_only'] = False
    return _orig_torch_load(*args, **kwargs)
torch.load = _custom_torch_load

def load_model(model_path: Path):
    if not model_path.exists():
        if Path("yolov8n.pt").exists():
            print(f"Model {model_path} not found. Using pretrained yolov8n.pt instead.")
            return YOLO("yolov8n.pt")
        raise FileNotFoundError(
            f"Trained model not found: {model_path}." \
            " Run train.py first or provide the correct path.")

    return YOLO(str(model_path))


def draw_boxes(frame, result, class_names, min_area, min_confidence):
    if result is None or not hasattr(result, "boxes"):
        return frame, False

    h, w = frame.shape[:2]
    total_area = float(h * w)

    detected = False
    for box in result.boxes:
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        width = max(0, x2 - x1)
        height = max(0, y2 - y1)
        area = width * height
        
        # Reject full-screen hallucination boxes (e.g. wall detected covering >88% of screen)
        if area > (total_area * 0.88):
            continue
            
        if area < min_area or width < 50 or height < 60:
            continue

        confidence = float(box.conf[0])
        if confidence < min_confidence:
            continue

        aspect_ratio = width / float(height) if height > 0 else 0
        if aspect_ratio < 0.20 or aspect_ratio > 3.5:
            continue

        cls_id = int(box.cls[0])
        label = class_names.get(cls_id, "person") if class_names else "person"
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.putText(
            frame,
            f"{label} {confidence:.2f}",
            (x1, max(15, y1 - 10)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (0, 255, 0),
            2,
        )
        detected = True

    return frame, detected


def resolve_test_dir(dataset_dir: Path) -> Path:
    test_dir = dataset_dir / "test" / "images"
    if test_dir.exists():
        return test_dir

    val_dir = dataset_dir / "valid" / "images"
    if val_dir.exists() and any(val_dir.iterdir()):
        print("Warning: test/images not found. Falling back to valid/images for inference.")
        return val_dir

    train_dir = dataset_dir / "train" / "images"
    if train_dir.exists():
        print("Warning: test/images and valid/images not found. Falling back to train/images for inference.")
        return train_dir

    raise FileNotFoundError(
        f"Neither test/images, valid/images, nor train/images exist under {dataset_dir}.")


def infer_on_images(model, test_dir: Path, output_dir: Path, confidence: float, min_area: int):
    if not test_dir.exists() or not test_dir.is_dir():
        raise FileNotFoundError(
            f"Test images directory not found: {test_dir}")

    output_dir.mkdir(parents=True, exist_ok=True)
    image_files = sorted(test_dir.glob("*.jpg")) + sorted(test_dir.glob("*.jpeg")) + sorted(test_dir.glob("*.png"))
    if not image_files:
        raise FileNotFoundError(
            f"No images found in test directory: {test_dir}")

    print(f"Running inference on {len(image_files)} test image(s)...")
    class_names = getattr(model, 'names', None)
    for image_path in image_files:
        frame = cv2.imread(str(image_path))
        if frame is None:
            print(f"Warning: could not read image {image_path}")
            continue

        results = model(frame, verbose=False, conf=confidence)[0]
        output_frame, _ = draw_boxes(frame.copy(), results, class_names, min_area, confidence)
        output_path = output_dir / image_path.name
        cv2.imwrite(str(output_path), output_frame)
        print(f"Saved: {output_path}")

    print(f"Test image inference complete. Results saved in {output_dir}")


def infer_webcam(model, camera_index: int, confidence: float, min_area: int):
    print("Starting webcam inference. Press 'q' to exit.")
    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        raise RuntimeError(
            f"Could not open webcam index {camera_index}.")

    class_names = getattr(model, 'names', None)
    while True:
        ret, frame = cap.read()
        if not ret:
            print("Failed to read frame from webcam.")
            break

        results = model(frame, verbose=False, conf=confidence)[0]
        output_frame, detected = draw_boxes(frame.copy(), results, class_names, min_area, confidence)
        if not detected:
            cv2.putText(
                output_frame,
                "No person detected",
                (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX,
                1.0,
                (0, 0, 255),
                2,
            )
        cv2.imshow("Employee Presence Detection", output_frame)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()


def main():
    check_dependencies()
    args = parse_args()
    model = load_model(args.model)

    if args.webcam_only:
        print("Running webcam-only inference. Press 'q' in the window to quit.")
        infer_webcam(model, args.camera, args.confidence, args.min_area)
        return

    test_source = resolve_test_dir(args.dataset_dir)
    infer_on_images(model, test_source, args.output_dir, args.confidence, args.min_area)

    if not args.skip_webcam:
        infer_webcam(model, args.camera, args.confidence, args.min_area)
    else:
        print("Skipping webcam inference as requested.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Error: {exc}")
        sys.exit(1)
