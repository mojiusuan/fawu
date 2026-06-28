@echo off
title Legal AI System v3.0

echo ========================================
echo   Legal AI System v3.0
echo ========================================
echo.

where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Install Python 3.10+ first.
    pause
    exit /b 1
)

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Install Node.js 18+ first.
    pause
    exit /b 1
)

echo [1/2] Starting backend on port 8080 ...
cd /d "%~dp0"
if exist "venv\Scripts\python.exe" (
    echo   Using venv Python
    start "Legal Backend" venv\Scripts\python.exe -m src.main
) else (
    start "Legal Backend" python -m src.main
)

echo Waiting for backend...
ping -n 5 127.0.0.1 >nul

echo [2/2] Starting frontend on port 5173 ...
cd /d "%~dp0web-react"
start "Legal Frontend" cmd /c "npm run dev"

echo.
echo ========================================
echo   Frontend : http://localhost:5173
echo   Backend  : http://localhost:8080
echo   API Docs : http://localhost:8080/docs
echo ========================================
echo.
echo   Demo accounts:
echo     admin   / admin123
echo     legal01 / legal123
echo     biz01   / biz123
echo     audit01 / audit123
echo ========================================
echo.

start http://localhost:5173
