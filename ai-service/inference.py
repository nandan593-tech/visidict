"""
AI Inference Service for Employee Presence Detection
Reads phone camera (IP Webcam / DroidCam) or webcam stream, runs YOLO person detection asynchronously,
and sends data (state + video frames) to Node.js backend smoothly.
"""

import os
# Suppress OpenCV and FFmpeg C-level logging
os.environ["OPENCV_FFMPEG_LOGLEVEL"] = "-8"
os.environ["OPENCV_LOG_LEVEL"] = "OFF"
os.environ["OPENCV_VIDEOIO_DEBUG"] = "0"
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "timeout;3000000"

import cv2
import sys
import time
import base64
import socketio
import torch
import threading
import socket
import requests
import numpy as np
from contextlib import contextmanager
from urllib.parse import urlsplit
from pathlib import Path
from ultralytics import YOLO

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None


@contextmanager
def suppress_stderr():
    """Suppresses C-level stderr output (e.g. OpenCV / FFmpeg console spam)."""
    try:
        stderr_fd = sys.stderr.fileno()
        saved_fd = os.dup(stderr_fd)
        devnull = os.open(os.devnull, os.O_WRONLY)
        os.dup2(devnull, stderr_fd)
        os.close(devnull)
        try:
            yield
        finally:
            os.dup2(saved_fd, stderr_fd)
            os.close(saved_fd)
    except Exception:
        yield

# Fix for PyTorch 2.6+ weights_only issue with YOLO models
_orig_torch_load = torch.load
def _custom_torch_load(*args, **kwargs):
    if 'weights_only' not in kwargs:
        kwargs['weights_only'] = False
    return _orig_torch_load(*args, **kwargs)
torch.load = _custom_torch_load


# ==============================================================================
# CAMERA CONFIGURATION & ROTATION SETTINGS
# ==============================================================================
# Change ROTATE_FRAME to 90, 180, or 270 if your phone is mounted sideways.
# Options: None, 90, 180, 270. Can also be set via ROTATE_FRAME env variable.
ROTATE_FRAME = os.environ.get("ROTATE_FRAME") or None
if ROTATE_FRAME is not None:
    try:
        ROTATE_FRAME = int(ROTATE_FRAME)
    except ValueError:
        ROTATE_FRAME = None

CONFIG_FILE = "camera_config.txt"


def apply_rotation(frame, angle):
    """Rotates frame by 90, 180, or 270 degrees clockwise if angle is specified."""
    if not angle:
        return frame
    try:
        deg = int(angle)
    except Exception:
        return frame
    if deg == 90:
        return cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE)
    elif deg == 180:
        return cv2.rotate(frame, cv2.ROTATE_180)
    elif deg == 270:
        return cv2.rotate(frame, cv2.ROTATE_90_COUNTERCLOCKWISE)
    return frame


def resize_preserve_aspect(frame, max_width=640):
    """
    Downsamples frame so its width does not exceed max_width (default 640px)
    while preserving the exact aspect ratio (critical for portrait phone feeds).
    """
    h, w = frame.shape[:2]
    if w > max_width:
        scale = float(max_width) / float(w)
        new_w = max_width
        new_h = max(1, int(round(h * scale)))
        return cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
    return frame


class ThreadedCamera:
    """
    Asynchronous camera reader that continuously grabs the latest frame from
    USB webcams, IP camera streams (MJPEG/RTSP/HTTP), or snapshot URLs (shot.jpg).
    Keeps buffer size to 1 to guarantee zero lag and zero buffer buildup.
    Includes connection and read timeouts.
    """
    def __init__(self, src, timeout=3.5):
        self.src = src
        self.timeout = timeout
        self.ret = False
        self.frame = None
        self.running = True
        self.opened = False
        self.lock = threading.Lock()
        self.cap = None
        self.is_snapshot = False

        if isinstance(self.src, str):
            src_lower = self.src.lower()
            if src_lower.endswith('.jpg') or src_lower.endswith('.jpeg') or '/shot.jpg' in src_lower:
                self.is_snapshot = True

        self.thread = threading.Thread(target=self._reader, daemon=True)
        self.thread.start()

        # Wait up to timeout seconds for camera initialization and first frame
        start_time = time.time()
        while (not self.opened or not self.ret) and (time.time() - start_time < self.timeout):
            if not self.running:
                break
            time.sleep(0.05)

        if not self.ret:
            self.running = False

    def _poll_snapshots(self):
        """Polls single JPEG snapshots (e.g. /shot.jpg) at target frame rate."""
        session = requests.Session()
        while self.running:
            try:
                resp = session.get(self.src, timeout=3.0)
                if resp.status_code == 200:
                    arr = np.frombuffer(resp.content, dtype=np.uint8)
                    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                    if img is not None and img.size > 0:
                        with self.lock:
                            self.ret = True
                            self.frame = img
                            self.opened = True
                else:
                    time.sleep(0.05)
            except Exception:
                time.sleep(0.1)
            time.sleep(0.02)
        session.close()

    def _reader(self):
        if self.is_snapshot:
            self._poll_snapshots()
            return

        # Open capture device
        if isinstance(self.src, int) or (isinstance(self.src, str) and self.src.strip().isdigit()):
            idx = int(self.src)
            with suppress_stderr():
                self.cap = cv2.VideoCapture(idx, cv2.CAP_DSHOW) if sys.platform.startswith('win') else cv2.VideoCapture(idx)
        else:
            # IP Webcam / RTSP / HTTP stream with lowered connection & read timeouts (3.5s)
            params = []
            if hasattr(cv2, 'CAP_PROP_OPEN_TIMEOUT_MSEC'):
                params.extend([cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 3500])
            if hasattr(cv2, 'CAP_PROP_READ_TIMEOUT_MSEC'):
                params.extend([cv2.CAP_PROP_READ_TIMEOUT_MSEC, 3500])

            with suppress_stderr():
                if params:
                    try:
                        self.cap = cv2.VideoCapture(self.src, cv2.CAP_ANY, params)
                    except Exception:
                        self.cap = cv2.VideoCapture(self.src)
                else:
                    self.cap = cv2.VideoCapture(self.src)

        if self.cap and self.cap.isOpened():
            # Minimize internal buffer to 1 to eliminate frame delay and lag
            try:
                self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            except Exception:
                pass
            if hasattr(cv2, 'CAP_PROP_OPEN_TIMEOUT_MSEC'):
                try:
                    self.cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 3500)
                except Exception:
                    pass
            if hasattr(cv2, 'CAP_PROP_READ_TIMEOUT_MSEC'):
                try:
                    self.cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 3500)
                except Exception:
                    pass
            self.opened = True
        else:
            self.running = False
            return

        while self.running:
            with suppress_stderr():
                ret, frame = self.cap.read()
            if ret and frame is not None and frame.size > 0:
                with self.lock:
                    self.ret = True
                    self.frame = frame
            else:
                time.sleep(0.01)

        if self.cap:
            try:
                self.cap.release()
            except Exception:
                pass

    def read(self):
        with self.lock:
            if self.ret and self.frame is not None:
                return True, self.frame.copy()
            return False, None

    def isOpened(self):
        return self.opened and self.ret and self.frame is not None

    def release(self):
        self.running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=0.3)
        if self.cap:
            try:
                self.cap.release()
            except Exception:
                pass
            self.cap = None


# ==============================================================================
# URL PARSING, .ENV CAMERA CONFIG & CONNECTION MANAGEMENT
# ==============================================================================

def get_env_path():
    """Finds the .env file in ai-service directory or project root."""
    ai_env = Path(__file__).resolve().parent / ".env"
    if ai_env.exists():
        return ai_env
    cwd_env = Path.cwd() / ".env"
    if cwd_env.exists():
        return cwd_env
    root_env = Path(__file__).resolve().parent.parent / ".env"
    if root_env.exists():
        return root_env
    return ai_env


def load_env_file():
    """Loads environment variables from .env file."""
    env_path = get_env_path()
    if env_path.exists():
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        if k:
                            os.environ[k] = v
        except Exception:
            pass
    if load_dotenv:
        try:
            load_dotenv(env_path)
        except Exception:
            pass


def load_camera_url():
    """
    Reads camera URL from CAMERA_URL in .env.
    Falls back to CAMERA_SOURCE or camera_config.txt if needed.
    """
    load_env_file()

    # 1. Check CAMERA_URL
    url = os.environ.get("CAMERA_URL")
    if url is not None and url.strip():
        val = url.strip()
        if val.lower() == "webcam" or val == "0":
            return 0
        if val.isdigit():
            return int(val)
        return val

    # 2. Check CAMERA_SOURCE for backwards compatibility
    env_source = os.environ.get("CAMERA_SOURCE")
    if env_source is not None and env_source.strip():
        val = env_source.strip()
        if val.lower() == "webcam" or val == "0":
            return 0
        if val.isdigit():
            return int(val)
        return val

    # 3. Check camera_config.txt for backwards compatibility
    cfg_file = Path(__file__).resolve().parent / CONFIG_FILE
    if cfg_file.exists():
        try:
            with open(cfg_file, "r", encoding="utf-8") as f:
                lines = [line.strip() for line in f if line.strip() and not line.strip().startswith("#")]
                if lines:
                    source = lines[0]
                    if source.lower() == "webcam" or source == "0":
                        return 0
                    if source.isdigit():
                        return int(source)
                    return source
        except Exception:
            pass

    return "http://192.168.43.27:8080/video"


def save_camera_url_to_env(url):
    """
    Saves CAMERA_URL back to .env after a successful connection.
    Also syncs camera_config.txt for backwards compatibility.
    """
    env_path = get_env_path()
    val = str(url).strip()
    if val == "0":
        val = "webcam"

    os.environ["CAMERA_URL"] = val

    try:
        if not env_path.exists():
            env_path.write_text(f"CAMERA_URL={val}\n", encoding="utf-8")
        else:
            lines = env_path.read_text(encoding="utf-8").splitlines()
            found = False
            new_lines = []
            for line in lines:
                if line.strip().startswith("CAMERA_URL="):
                    new_lines.append(f"CAMERA_URL={val}")
                    found = True
                else:
                    new_lines.append(line)
            if not found:
                new_lines.append(f"CAMERA_URL={val}")
            env_path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
        print(f"[Config] Saved CAMERA_URL={val} to {env_path.name}")
    except Exception as e:
        print(f"[WARN] Error updating {env_path}: {e}")

    try:
        cfg = Path(__file__).resolve().parent / CONFIG_FILE
        cfg.write_text(val, encoding="utf-8")
    except Exception:
        pass


def quick_check_url(url, timeout=3.0):
    """
    Quickly checks the URL with a short request (3 second timeout)
    before attempting to open a video stream, so it fails fast instead of waiting 5+ seconds.
    """
    if isinstance(url, int) or (isinstance(url, str) and url.strip().isdigit()):
        return True

    url_str = str(url).strip()
    if url_str.lower() == "webcam":
        return True

    if not (url_str.startswith("http://") or url_str.startswith("https://") or url_str.startswith("rtsp://")):
        url_str = f"http://{url_str}"

    if url_str.startswith("rtsp://"):
        try:
            parsed = urlsplit(url_str)
            host = parsed.hostname
            port = parsed.port or 554
            with socket.create_connection((host, port), timeout=timeout):
                return True
        except Exception:
            return False

    try:
        # stream=True gets headers immediately without downloading endless MJPEG stream
        resp = requests.get(url_str, timeout=timeout, stream=True)
        resp.close()
        return True
    except Exception:
        return False


def normalize_camera_url(raw_input):
    """Normalizes user input into a proper camera source URL or index 0."""
    raw = str(raw_input).strip()
    if raw.lower() == "webcam" or raw == "0":
        return 0
    if raw.isdigit():
        return int(raw)
    if not (raw.startswith("http://") or raw.startswith("https://") or raw.startswith("rtsp://")):
        raw = f"http://{raw}"
    parsed = urlsplit(raw)
    if not parsed.path or parsed.path == "/":
        port = f":{parsed.port}" if parsed.port else ":8080"
        return f"{parsed.scheme}://{parsed.hostname}{port}/video"
    return raw


def establish_camera_connection(initial_source, pending_save=None):
    """
    Connects to the camera with fast pre-check and auto-retry.
    Prints one clear line per attempt: [Attempt X/3] <URL> - <Result>.
    If connection fails 3 times in a row, prompts user in terminal:
      "Camera not reachable. Enter new URL (for example http://IP:8080/video), type 'webcam' to use the laptop camera, press Enter to retry, or 'q' to quit:"
    If user enters a new URL, tries to connect, and saves back to CAMERA_URL in .env after it works.
    If user enters 'webcam', switches to index 0.
    If user enters 'q' or presses Ctrl+C, exits cleanly.
    """
    current_source = initial_source
    pending_new_url_to_save = pending_save
    failure_count = 0

    while True:
        failure_count += 1
        attempt_num = failure_count

        is_webcam = (current_source == 0 or current_source == "0" or str(current_source).lower() == "webcam")
        display_name = "webcam (index 0)" if is_webcam else str(current_source)

        cap = None
        success = False

        if is_webcam:
            try:
                cap = ThreadedCamera(0, timeout=3.5)
                if cap.isOpened():
                    success = True
                else:
                    if cap:
                        cap.release()
                        cap = None
            except Exception:
                success = False

            if not success:
                print(f"[Attempt {attempt_num}/3] {display_name} - Failed (webcam not available)")
        else:
            # 1. Quick pre-check (3 second timeout) to fail fast
            reachable = quick_check_url(current_source, timeout=3.0)
            if not reachable:
                print(f"[Attempt {attempt_num}/3] {display_name} - Failed (unreachable)")
            else:
                # 2. Open stream with lowered timeout (3.5s)
                try:
                    cap = ThreadedCamera(current_source, timeout=3.5)
                    if cap.isOpened():
                        success = True
                    else:
                        if cap:
                            cap.release()
                            cap = None
                except Exception:
                    success = False

                if not success:
                    print(f"[Attempt {attempt_num}/3] {display_name} - Failed (stream open timeout)")

        if success:
            print(f"[Attempt {attempt_num}/3] {display_name} - Connected successfully!")
            if pending_new_url_to_save:
                save_camera_url_to_env(pending_new_url_to_save)
                pending_new_url_to_save = None
            return cap, (0 if is_webcam else current_source)

        # 3 consecutive failures: prompt user
        if failure_count >= 3:
            prompt = "Camera not reachable. Enter new URL (for example http://IP:8080/video), type 'webcam' to use the laptop camera, press Enter to retry, or 'q' to quit: "
            try:
                user_input = input(prompt).strip()
            except (KeyboardInterrupt, EOFError):
                print("\nExiting AI Service...")
                sys.exit(0)

            if user_input.lower() == 'q':
                print("Exiting AI Service.")
                sys.exit(0)
            elif user_input.lower() == 'webcam':
                current_source = 0
                pending_new_url_to_save = None
                failure_count = 0
            elif user_input == '':
                # Press Enter to retry
                failure_count = 0
            else:
                new_url = normalize_camera_url(user_input)
                current_source = new_url
                pending_new_url_to_save = new_url
                failure_count = 0
        else:
            time.sleep(1.0)


def get_config_path():
    return Path(__file__).parent / CONFIG_FILE


def load_camera_source():
    return load_camera_url()


def save_camera_source(source):
    save_camera_url_to_env(source)


def parse_and_build_candidate_urls(user_input):
    """
    Given a user input (IP, IP:PORT, user:pass@IP, or full URL),
    returns an ordered list of candidate URLs to test:
      1. http://IP:8080/video          (IP Webcam, Android)
      2. http://IP:8080/videofeed
      3. http://IP:4747/video          (DroidCam)
      4. http://IP:8080/shot.jpg       (fallback: poll single JPEG images)
    """
    raw = str(user_input).strip()
    if not raw:
        return []

    # Explicit local webcam index
    if raw.isdigit():
        return [int(raw)]

    has_scheme = raw.startswith("http://") or raw.startswith("https://") or raw.startswith("rtsp://")
    url_to_parse = raw if has_scheme else f"http://{raw}"

    try:
        parsed = urlsplit(url_to_parse)
    except Exception:
        return [raw]

    host = parsed.hostname
    if not host:
        return [raw]

    auth_prefix = ""
    if parsed.username:
        if parsed.password:
            auth_prefix = f"{parsed.username}:{parsed.password}@"
        else:
            auth_prefix = f"{parsed.username}@"

    port = parsed.port
    path = parsed.path

    candidates = []

    # If user provided a specific endpoint path beyond "/" or empty
    if path and path not in ["", "/"]:
        candidates.append(raw if has_scheme else f"http://{auth_prefix}{host}:{port}{path}" if port else f"http://{auth_prefix}{host}{path}")

    if port:
        candidates.extend([
            f"http://{auth_prefix}{host}:{port}/video",
            f"http://{auth_prefix}{host}:{port}/videofeed",
            f"http://{auth_prefix}{host}:{port}/shot.jpg",
        ])
    else:
        # Standard default candidates in required order
        candidates.extend([
            f"http://{auth_prefix}{host}:8080/video",
            f"http://{auth_prefix}{host}:8080/videofeed",
            f"http://{auth_prefix}{host}:4747/video",
            f"http://{auth_prefix}{host}:8080/shot.jpg",
        ])

    # Deduplicate while preserving order
    seen = set()
    deduped = []
    for c in candidates:
        if c not in seen:
            seen.add(c)
            deduped.append(c)

    return deduped


def test_camera_candidate(candidate, timeout=3.5):
    """
    Tests if candidate camera source produces a real frame within timeout.
    Uses socket connect pre-check to fail fast on unreachable IPs.
    """
    if isinstance(candidate, str):
        try:
            parsed = urlsplit(candidate)
            host = parsed.hostname
            port = parsed.port or (443 if parsed.scheme == "https" else 80)
            if host and not host.startswith("0") and host != "127.0.0.1" and host != "localhost":
                with socket.create_connection((host, int(port)), timeout=1.5):
                    pass
        except Exception:
            return False

    cam = ThreadedCamera(candidate, timeout=timeout)
    if cam.isOpened():
        ret, frame = cam.read()
        cam.release()
        if ret and frame is not None and frame.size > 0:
            return True
    cam.release()
    return False


def discover_working_camera(raw_input, save_on_success=True):
    """
    Takes raw user input (IP, URL, or index), generates candidate URLs,
    tests them in order, and returns the first working one.
    """
    candidates = parse_and_build_candidate_urls(raw_input)
    if not candidates:
        return None

    for cand in candidates:
        if isinstance(cand, int):
            print(f"Testing local webcam [{cand}] ...")
        else:
            print(f"Testing {cand} ...")

        if test_camera_candidate(cand):
            print(f"[OK] Connected! Real video frame received from: {cand}")
            if save_on_success:
                save_camera_source(cand)
            return cand
        else:
            print(f"  [x] Could not connect to {cand}")

    return None


def resolve_initial_camera_source():
    """
    Resolves the camera source at startup:
    1. Checks CAMERA_SOURCE env var
    2. Checks camera_config.txt
    3. If neither or if missing/empty, prompts for phone IP/URL. Never assumes 0!
    """
    source = load_camera_source()

    # If no source configured, prompt interactively
    if source is None:
        print("\n" + "=" * 65)
        print("                 VISIDICT CAMERA SETUP")
        print("=" * 65)
        print(" No camera source is configured.")
        print(" VISIDICT defaults to your PHONE camera (IP Webcam / DroidCam).")
        print(" (To explicitly use your laptop webcam, enter: 0)")
        print("=" * 65)

        while True:
            user_in = input("\nEnter phone IP (e.g. 192.168.1.5), IP:PORT, or stream URL: ").strip()
            if not user_in:
                print("Please enter a valid phone IP or URL (or 0 for laptop webcam).")
                continue

            if user_in == "0":
                print("Explicitly selected LOCAL laptop webcam (0).")
                save_camera_source(0)
                return 0

            working = discover_working_camera(user_in, save_on_success=True)
            if working is not None:
                return working

            print(f"\n[ERROR] Could not connect to any camera stream using '{user_in}'.")
            print("Troubleshooting checklist:")
            print(" 1. Phone and PC must be on the SAME Wi-Fi or phone hotspot.")
            print(" 2. Open 'IP Webcam' on phone and tap 'Start server' at bottom.")
            print(" 3. Verify the IP address shown on your phone screen.")
            print(" 4. Test opening http://<PHONE_IP>:8080 in your laptop browser.")
            choice = input("\nPress Enter to try again, or enter a new IP: ").strip()
            if choice:
                if choice == "0":
                    save_camera_source(0)
                    return 0
                working = discover_working_camera(choice, save_on_success=True)
                if working is not None:
                    return working

    # Explicit laptop webcam choice
    if source == 0 or source == "0":
        return 0

    # Phone camera source configured
    return source


# Model and Network Settings
BACKEND_URL = os.environ.get("BACKEND_URL") or "http://localhost:5000"
SHOW_LOCAL_WINDOW = False  # Set to True if running manually in an interactive terminal

ABSENCE_THRESHOLD_SECONDS = 5    # Time in seconds before marking employee ABSENT when undetected
DETECTION_CONFIDENCE_MIN = 0.50   # Minimum confidence threshold to prevent false positives
YOLO_INFERENCE_IMGSZ = 384       # Optimized inference resolution (fast, low latency, high accuracy)
EMPLOYEE_ID = "EMP001"           # Default dummy employee


def get_best_model():
    candidates = [
        Path("yolov8n.pt"),
        Path("../yolov8n.pt"),
        Path(__file__).parent / "yolov8n.pt",
        Path(__file__).parent.parent / "yolov8n.pt",
    ]
    for c in candidates:
        if c.exists():
            print(f"[AI Model] Loading COCO person detection model: {c.resolve()}")
            return YOLO(str(c.resolve()))

    print("[AI Model] Loading default yolov8n.pt model...")
    return YOLO("yolov8n.pt")


model = get_best_model()

# Socket.io Client
sio = socketio.Client()
connected = False


@sio.event
def connect():
    global connected
    connected = True
    print(f"[Socket] Connected to backend at {BACKEND_URL}")


@sio.event
def disconnect():
    global connected
    connected = False
    print("[Socket] Disconnected from backend")


try:
    sio.connect(BACKEND_URL)
except Exception as e:
    print(f"[WARN] Could not connect to backend initially: {e}")


class AsyncAIInferenceWorker:
    """
    Runs YOLO person detection in a separate background thread so that AI computation
    never blocks the video frame capture or streaming pipeline.
    """
    def __init__(self, yolo_model):
        self.model = yolo_model
        self.running = True
        self.lock = threading.Lock()

        # State
        self.latest_input_frame = None
        self.has_new_frame = False

        self.detected_boxes = []  # List of (x1, y1, x2, y2, conf)
        self.person_present = False
        self.max_conf = 0.0
        self.last_seen_time = time.time()
        self.current_status = "CHECKING"
        self.just_changed = False

        self.thread = threading.Thread(target=self._worker_loop, daemon=True)
        self.thread.start()

    def submit_frame(self, frame):
        with self.lock:
            self.latest_input_frame = frame
            self.has_new_frame = True

    def get_state_and_boxes(self):
        with self.lock:
            return {
                "boxes": list(self.detected_boxes),
                "person_present": self.person_present,
                "max_conf": self.max_conf,
                "status": self.current_status,
                "just_changed": self.just_changed,
                "last_seen_time": self.last_seen_time
            }

    def reset_just_changed(self):
        with self.lock:
            self.just_changed = False

    def _worker_loop(self):
        while self.running:
            frame_to_process = None
            with self.lock:
                if self.has_new_frame and self.latest_input_frame is not None:
                    frame_to_process = self.latest_input_frame.copy()
                    self.has_new_frame = False

            if frame_to_process is None:
                time.sleep(0.005)
                continue

            h, w = frame_to_process.shape[:2]
            total_area = float(h * w)

            try:
                # Run YOLO person detection at optimized resolution (384x384) for fast CPU throughput
                results = self.model(
                    frame_to_process,
                    imgsz=YOLO_INFERENCE_IMGSZ,
                    verbose=False,
                    conf=DETECTION_CONFIDENCE_MIN
                )[0]

                boxes_found = []
                max_confidence = 0.0
                person_detected = False

                for box in results.boxes:
                    cls_id = int(box.cls[0])
                    conf = float(box.conf[0])

                    label = self.model.names[cls_id] if hasattr(self.model, 'names') else str(cls_id)
                    is_person_class = (label == "person" or (len(self.model.names) == 80 and cls_id == 0))

                    if not is_person_class or conf < DETECTION_CONFIDENCE_MIN:
                        continue

                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    box_w = max(0, x2 - x1)
                    box_h = max(0, y2 - y1)
                    box_area = box_w * box_h

                    # Geometry Sanity Checks
                    if box_area > (total_area * 0.88):  # Reject full-screen wall/artifact boxes
                        continue
                    if box_w < 35 or box_h < 45 or box_area < 2000:  # Reject tiny background artifacts
                        continue
                    aspect_ratio = box_w / float(box_h) if box_h > 0 else 0
                    if aspect_ratio < 0.20 or aspect_ratio > 3.5:  # Reject impossible aspect ratios
                        continue

                    person_detected = True
                    if conf > max_confidence:
                        max_confidence = conf
                    boxes_found.append((x1, y1, x2, y2, conf))

                # Update presence status
                now = time.time()
                with self.lock:
                    self.detected_boxes = boxes_found
                    self.person_present = person_detected
                    self.max_conf = max_confidence

                    new_status = self.current_status
                    if person_detected:
                        self.last_seen_time = now
                        new_status = "PRESENT"
                    else:
                        elapsed = now - self.last_seen_time
                        self.max_conf = 0.0
                        if elapsed > ABSENCE_THRESHOLD_SECONDS:
                            new_status = "ABSENT"
                        else:
                            new_status = "CHECKING"

                    if new_status != self.current_status:
                        self.just_changed = True
                        self.current_status = new_status
                        print(f"[Presence Change] New Status: {self.current_status} | Person Detected: {person_detected}")

            except Exception as e:
                print(f"[Worker Error]: {e}")
                time.sleep(0.02)

    def stop(self):
        self.running = False


def main():
    global connected

    saved_url = load_camera_url()
    cap = None
    ai_worker = AsyncAIInferenceWorker(model)

    print("\n" + "=" * 62)
    print("             VISIDICT AI SERVICE - CAMERA SETUP")
    print("=" * 62)
    print(f" Saved Camera URL: {saved_url}")
    print(" Enter your phone camera IP/URL (e.g. 192.168.43.27 or full URL),")
    print(" or press Enter to use saved URL, 'webcam' for laptop, 'q' to quit.")
    print("-" * 62)

    try:
        user_choice = input(f"Camera URL [{saved_url}]: ").strip()
    except (KeyboardInterrupt, EOFError):
        print("\nExiting AI Service...")
        sys.exit(0)

    if user_choice.lower() == 'q':
        print("Exiting AI Service.")
        sys.exit(0)
    elif user_choice.lower() == 'webcam':
        initial_source = 0
        pending_save = None
    elif user_choice == '':
        initial_source = saved_url
        pending_save = None
    else:
        initial_source = normalize_camera_url(user_choice)
        pending_save = initial_source

    try:
        source = initial_source
        while True:
            # Connect to camera (handles 3 retries, user prompt, switching to webcam/new URL)
            cap, camera_source = establish_camera_connection(source, pending_save=pending_save)
            pending_save = None

            if camera_source == 0 or camera_source == "0":
                print(f"\n=======================================================")
                print(f"  Using LOCAL webcam: {camera_source}")
                print(f"=======================================================")
            else:
                print(f"\n=======================================================")
                print(f"  Using PHONE camera: {camera_source}")
                print(f"=======================================================")
            print("Successfully connected to camera and verified video stream!\n")

            # Active streaming loop (constant 25 FPS)
            print("AI Service running smoothly... Press Ctrl+C to stop.")
            target_fps = 25
            frame_interval = 1.0 / target_fps
            consecutive_failures = 0
            stream_active = True

            while stream_active:
                start_time = time.time()
                ret, frame = cap.read()
                if not ret or frame is None:
                    consecutive_failures += 1
                    if consecutive_failures > 75:  # ~3 seconds at 25fps
                        print(f"\nCamera stream disconnected. Reconnecting to {camera_source}...")
                        stream_active = False
                        break
                    time.sleep(0.04)
                    continue

                consecutive_failures = 0

                # Rotate frame if requested (e.g. ROTATE_FRAME = 90 / 180 / 270)
                if ROTATE_FRAME:
                    frame = apply_rotation(frame, ROTATE_FRAME)

                # Resize frame to max 640px width, preserving aspect ratio for portrait/landscape
                frame = resize_preserve_aspect(frame, max_width=640)

                # Submit frame asynchronously to AI inference worker
                ai_worker.submit_frame(frame)

                # Retrieve current AI detection results
                ai_state = ai_worker.get_state_and_boxes()
                status = ai_state["status"]
                max_conf = ai_state["max_conf"]
                boxes = ai_state["boxes"]
                just_changed = ai_state["just_changed"]
                last_seen = ai_state["last_seen_time"]

                # Reset just_changed once captured
                if just_changed:
                    ai_worker.reset_just_changed()

                # Render detection bounding boxes on display frame
                for (x1, y1, x2, y2, conf) in boxes:
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 220, 0), 2)
                    label_text = f"Person: {int(conf * 100)}%"
                    (lbl_w, lbl_h), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 2)
                    cv2.rectangle(frame, (x1, max(0, y1 - 22)), (x1 + lbl_w + 8, y1), (0, 200, 0), -1)
                    cv2.putText(frame, label_text, (x1 + 4, max(14, y1 - 6)),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 0), 2)

                # Render HUD status banner
                if status == "PRESENT":
                    color = (0, 220, 0)
                    status_text = "Status: PRESENT"
                elif status == "ABSENT":
                    color = (0, 0, 255)
                    status_text = "Status: ABSENT (No Person)"
                else:
                    color = (0, 165, 255)
                    elapsed = time.time() - last_seen
                    remaining = max(1, int(ABSENCE_THRESHOLD_SECONDS - elapsed))
                    status_text = f"Status: CHECKING... ({remaining}s)"

                (tw, th), _ = cv2.getTextSize(status_text, cv2.FONT_HERSHEY_SIMPLEX, 0.75, 2)
                cv2.rectangle(frame, (8, 8), (16 + tw, 20 + th + 6), (20, 20, 20), -1)
                cv2.rectangle(frame, (8, 8), (16 + tw, 20 + th + 6), color, 2)
                cv2.putText(frame, status_text, (12, 14 + th),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.75, color, 2)

                # Fast JPEG encoding (58% quality for minimal compression latency & bandwidth)
                _, buffer = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 58])
                frame_b64 = base64.b64encode(buffer).decode('utf-8')

                # Send to Node.js via Socket.io
                if connected:
                    payload = {
                        "frame": f"data:image/jpeg;base64,{frame_b64}",
                        "status": status,
                        "confidence": float(round(max_conf, 2)),
                        "employeeId": EMPLOYEE_ID,
                        "justChanged": just_changed
                    }
                    try:
                        sio.emit('detection_frame', payload)
                    except Exception:
                        pass
                else:
                    # Try background reconnect
                    try:
                        sio.connect(BACKEND_URL)
                    except Exception:
                        pass

                if SHOW_LOCAL_WINDOW:
                    cv2.imshow("AI Presence Detection Service", frame)
                    if cv2.waitKey(1) & 0xFF == ord('q'):
                        cap.release()
                        cv2.destroyAllWindows()
                        ai_worker.stop()
                        if connected:
                            sio.disconnect()
                        return

                # Keep steady target frame rate
                elapsed_processing = time.time() - start_time
                sleep_time = frame_interval - elapsed_processing
                if sleep_time > 0:
                    time.sleep(sleep_time)

            # Stream disconnected, release cap and try again
            if cap:
                cap.release()
                cap = None
            source = camera_source

    except KeyboardInterrupt:
        print("\nExiting AI Service...")
        if cap:
            try:
                cap.release()
            except Exception:
                pass
        ai_worker.stop()
        if connected:
            try:
                sio.disconnect()
            except Exception:
                pass
        sys.exit(0)


if __name__ == "__main__":
    # Support direct configuration via command-line (e.g. from set_camera.bat)
    if len(sys.argv) > 1 and sys.argv[1] in ["--configure", "-c", "--set-camera"]:
        target = sys.argv[2] if len(sys.argv) > 2 else None
        if not target:
            target = input("Enter Phone IP (e.g. 192.168.1.5) or full stream URL: ").strip()

        print(f"\nConfiguring VISIDICT Camera for: {target} ...")
        if target == "0" or target.lower() == "webcam":
            save_camera_url_to_env("webcam")
            print(f"[OK] Saved LOCAL laptop webcam (webcam) to .env.")
            sys.exit(0)

        cand = target
        if not (cand.startswith("http://") or cand.startswith("https://") or cand.startswith("rtsp://")):
            cand = f"http://{cand}"
        parsed = urlsplit(cand)
        if not parsed.path or parsed.path == "/":
            port = f":{parsed.port}" if parsed.port else ":8080"
            cand = f"{parsed.scheme}://{parsed.hostname}{port}/video"

        print(f"Checking {cand} ...")
        if quick_check_url(cand, timeout=3.0):
            save_camera_url_to_env(cand)
            print(f"\n[SUCCESS] Connected and verified phone camera: {cand}")
            print("Saved to .env.")
        else:
            save_camera_url_to_env(cand)
            print(f"\n[SAVED] Saved '{cand}' to .env.")
            print("Note: Camera is currently not responding. Make sure IP Webcam is running on your phone.")
        sys.exit(0)

    try:
        main()
    except KeyboardInterrupt:
        print("\nExiting AI Service...")
        sys.exit(0)
