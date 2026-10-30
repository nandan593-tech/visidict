@echo off
title VISIDICT Launcher
echo ===================================================
echo             Starting VISIDICT Services
echo ===================================================
echo.
echo [Tip] To set or change your phone camera IP:
echo       Run "ai-service\set_camera.bat"
echo.

echo Launching Python AI Service (Detection Engine)...
start "VISIDICT - Python AI Service" cmd /k "cd /d %~dp0ai-service && (py -3.13 inference.py || python inference.py)"

echo Launching Node.js Express Backend (Port 5000)...
start "VISIDICT - Backend Server" cmd /k "cd /d %~dp0backend && npm run dev"

echo Launching React Frontend (Vite Dev Server)...
start "VISIDICT - Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo Opening VISIDICT Frontend in browser...
ping 127.0.0.1 -n 6 >nul
start http://localhost:5173

echo.
echo ===================================================
echo  All services have been launched!
echo  - Frontend:          http://localhost:5173
echo  - Backend API:       http://localhost:5000/api
echo  - Python AI Service: running locally (Phone Camera)
echo  - Camera Config:     ai-service\set_camera.bat
echo ===================================================
echo.