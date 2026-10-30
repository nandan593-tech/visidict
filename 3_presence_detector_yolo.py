"""
Step 3: Employee Presence Detection using YOLOv8 model.

Reads webcam, runs YOLO person detection, and alerts if no employee is detected.

Requirements:
    pip install ultralytics opencv-python requests
"""

import cv2
import time
import requests
import torch
from pathlib import Path
from ultralytics import YOLO

# Fix for PyTorch 2.6+ weights_only issue with YOLO models
_orig_torch_load = torch.load
def _custom_torch_load(*args, **kwargs):
    if 'weights_only' not in kwargs:
        kwargs['weights_only'] = False
    return _orig_torch_load(*args, **kwargs)
torch.load = _custom_torch_load

# ---------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------
CAMERA_SOURCE = 0
# Use 0 for laptop webcam, or "http://<phone-ip>:8080/video" for IP Webcam app

MODEL_PATH = "yolov8n.pt"
ABSENCE_THRESHOLD_SECONDS = 5       # Set to 5-10 for fast testing, 60-120 for deployment
DETECTION_CONFIDENCE_MIN = 0.55
ADMIN_NOTIFY_URL = "http://localhost:5000/api/notify"

# ---------------------------------------------------------
# LOAD MODEL
# ---------------------------------------------------------
if Path(MODEL_PATH).exists():
    model = YOLO(MODEL_PATH)
    print(f"Loaded YOLOv8 model: {MODEL_PATH}")
elif Path("../yolov8n.pt").exists():
    model = YOLO("../yolov8n.pt")
    print("Loaded ../yolov8n.pt")
else:
    model = YOLO("yolov8n.pt")

# ---------------------------------------------------------
# STATE TRACKING
# ---------------------------------------------------------
last_seen_time = time.time()
alert_sent = False


def detect_person(frame):
    """
    Runs YOLO inference on a frame and checks for real 'person' detections
    with geometric sanity filtering to prevent false positives on walls/space.
    """
    h, w = frame.shape[:2]
    total_area = float(h * w)

    results = model(frame, imgsz=384, verbose=False, conf=DETECTION_CONFIDENCE_MIN)[0]
    person_found = False

    for box in results.boxes:
        cls_id = int(box.cls[0])
        conf = float(box.conf[0])
        label = model.names[cls_id] if hasattr(model, 'names') else str(cls_id)

        # Check if detected object is person
        is_person = (label == "person" or (len(model.names) == 80 and cls_id == 0))
        if not is_person or conf < DETECTION_CONFIDENCE_MIN:
            continue

        x1, y1, x2, y2 = map(int, box.xyxy[0])
        box_w = max(0, x2 - x1)
        box_h = max(0, y2 - y1)
        box_area = box_w * box_h

        # Geometry Sanity Checks
        if box_area > (total_area * 0.88): # Reject full-screen hallucinations
            continue
        if box_w < 50 or box_h < 60 or box_area < 3000: # Reject tiny artifacts
            continue
        aspect_ratio = box_w / float(box_h) if box_h > 0 else 0
        if aspect_ratio < 0.2 or aspect_ratio > 3.5:
            continue

        person_found = True
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 220, 0), 2)
        cv2.putText(frame, f"Person {conf:.2f}", (x1, max(15, y1 - 8)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 220, 0), 2)

    return person_found, frame


def notify_admin():
    """Sends an absence alert to the admin backend/dashboard."""
    payload = {
        "status": "absent",
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    print(f"[ALERT] Sending notification to admin: {payload}")
    try:
        requests.post(ADMIN_NOTIFY_URL, json=payload, timeout=3)
    except requests.exceptions.RequestException as e:
        print(f"[WARN] Could not reach admin server ({e}). Alert logged locally instead.")


def main():
    global last_seen_time, alert_sent

    cap = cv2.VideoCapture(CAMERA_SOURCE)
    if not cap.isOpened():
        print("Error: Could not access camera. Check CAMERA_SOURCE.")
        return

    try:
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    except Exception:
        pass

    print("Presence detection started (YOLOv8). Press 'q' to quit.")

    while True:
        ret, frame = cap.read()
        if not ret:
            print("Failed to grab frame.")
            break

        frame = cv2.resize(frame, (640, 480))
        person_present, display_frame = detect_person(frame)

        if person_present:
            last_seen_time = time.time()
            alert_sent = False
            status_text = "Status: PRESENT"
            color = (0, 220, 0)
        else:
            elapsed = time.time() - last_seen_time
            if elapsed > ABSENCE_THRESHOLD_SECONDS:
                status_text = "Status: ABSENT (No Person)"
                color = (0, 0, 255)
                if not alert_sent:
                    notify_admin()
                    alert_sent = True
            else:
                remaining = max(1, int(ABSENCE_THRESHOLD_SECONDS - elapsed))
                status_text = f"Status: CHECKING... ({remaining}s)"
                color = (0, 165, 255)

        # Draw status HUD banner
        (tw, th), _ = cv2.getTextSize(status_text, cv2.FONT_HERSHEY_SIMPLEX, 0.75, 2)
        cv2.rectangle(display_frame, (8, 8), (16 + tw, 20 + th + 6), (20, 20, 20), -1)
        cv2.rectangle(display_frame, (8, 8), (16 + tw, 20 + th + 6), color, 2)
        cv2.putText(display_frame, status_text, (12, 14 + th),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.75, color, 2)

        cv2.imshow("AI Presence Detection", display_frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
