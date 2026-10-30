# 📱 Phone Camera Setup Guide for VISIDICT2

This guide explains how to connect your smartphone camera (Android or iOS) to VISIDICT2 wirelessly using **IP Webcam** or **DroidCam**.

---

## 🚀 Quick Start (5 Simple Steps)

### Step 1: Install the Camera App on Your Phone
- **Android (Recommended):** Install **[IP Webcam](https://play.google.com/store/apps/details?id=com.pas.webcam)** by Pavel Khlebovich from Google Play Store.
- **Alternative (Android / iOS):** Install **DroidCam** from Google Play Store or Apple App Store.

### Step 2: Connect Phone & Laptop to the Same Network
- Connect both your laptop and phone to the **same Wi-Fi router**.
- 💡 **Expo / College Demo Pro Tip:** Public, college, or hotel Wi-Fi networks often have **AP isolation / client isolation** enabled (blocking devices from talking to each other). Turn on your **phone's Mobile Hotspot** and connect your laptop to your phone's Wi-Fi instead!

### Step 3: Start the Stream on Your Phone
1. Open **IP Webcam** on your phone.
2. Scroll to the very bottom and tap **"Start server"**.
3. Grant camera & audio permissions if asked.
4. Your phone screen will display an IP address at the bottom, for example:  
   `http://192.168.1.5:8080`

### Step 4: Configure VISIDICT2
You have two quick ways to set your phone's IP:
- **Option A (One-click batch tool):** Double-click `ai-service/set_camera.bat`. Enter your phone IP (e.g. `192.168.1.5`) when prompted. It automatically verifies the stream and saves it.
- **Option B (Environment variable override):**
  ```cmd
  set CAMERA_SOURCE=http://192.168.1.5:8080/video
  ```
- **Option C (First launch prompt):** If `camera_config.txt` is empty, launching VISIDICT will automatically prompt you in the console to type your phone's IP.

### Step 5: Start VISIDICT2
Run `start.bat` from the root folder. VISIDICT2 will connect to your phone camera, display the real-time stream with YOLO presence detection, and stream live video to your dashboard.

---

## 🛠️ Screen Orientation & Sideways Feeds

If your phone is mounted sideways or inverted:
1. Open `ai-service/inference.py`.
2. Find the setting at the top:
   ```python
   ROTATE_FRAME = None  # Change to 90, 180, or 270
   ```
3. Set it to `90`, `180`, or `270` to rotate the video image upright with one line!

---

## 💻 Opting into Local Laptop Webcam

VISIDICT2 uses your phone camera by default and **never silently defaults to your laptop webcam**.
If you ever want to use your laptop's integrated webcam instead:
- Run `ai-service/set_camera.bat` and enter `0`.
- Or set environment variable `CAMERA_SOURCE=0`.

---

## 🔍 Troubleshooting Checklist

| Issue | Solution |
| :--- | :--- |
| **Phone stream not opening** | Test the connection in your laptop browser: open `http://<PHONE_IP>:8080` (e.g. `http://192.168.1.5:8080`). If the web page does not load in your browser, the laptop cannot reach your phone over Wi-Fi. |
| **College / Expo Wi-Fi blocks connection** | Many public Wi-Fi networks block device-to-device communication (AP client isolation). **Turn on your phone's Mobile Hotspot** and connect your laptop to it. |
| **Windows Firewall prompt** | When Windows asks to allow Python through the firewall, check both **Private** and **Public** networks and click **Allow Access**. |
| **Phone screen turns off / Stream drops** | In IP Webcam settings, enable **"Prevent screen from sleeping"** or keep your phone plugged into a charger. If the phone locks, VISIDICT2 will automatically keep retrying every 2 seconds until you unlock it. |
| **Wrong port number** | Default port for **IP Webcam** is `8080`. Default port for **DroidCam** is `4747`. You can enter `IP:PORT` (e.g. `192.168.1.5:4747`) in `set_camera.bat`. |
| **Password authentication enabled** | If you set a username and password in IP Webcam, enter `user:password@192.168.1.5` when prompted. |
