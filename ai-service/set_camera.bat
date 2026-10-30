@echo off
title VISIDICT - Set Phone Camera
echo ========================================================
echo               VISIDICT Phone Camera Setup
echo ========================================================
echo.
echo Make sure your phone and laptop are on the SAME Wi-Fi
echo (or connected to your phone's mobile hotspot).
echo Open "IP Webcam" or "DroidCam" on your phone and start the server.
echo.
echo (You can enter just the IP like 192.168.1.5, or IP:PORT,
echo  or full URL, or enter 0 to use local laptop webcam)
echo --------------------------------------------------------
set /p PHONE_IP=Enter phone IP: 
echo.

if "%PHONE_IP%"=="" (
    echo [ERROR] No IP entered. Camera configuration was not changed.
    pause
    exit /b 1
)

cd /d "%~dp0"
(py -3.13 inference.py --configure "%PHONE_IP%" || python inference.py --configure "%PHONE_IP%")

echo.
echo ========================================================
echo  Setup complete! Please restart VISIDICT by running start.bat
echo ========================================================
echo.
pause
