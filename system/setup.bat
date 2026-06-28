@echo off
title Legal AI System v3.0 - Setup

echo ==========================================
echo   Legal AI System v3.0 - Setup
echo ==========================================
echo.

python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Install Python 3.11+
    pause
    exit /b 1
)
echo [OK] Python

node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install Node.js 18+
    pause
    exit /b 1
)
echo [OK] Node.js

echo.
echo [1/7] Creating virtual environment...
python -m venv venv
if errorlevel 1 (
    echo [ERROR] Failed to create venv
    pause
    exit /b 1
)
call venv\Scripts\activate.bat
echo [OK] venv

echo.
echo [2/7] Installing Python dependencies...
set PIP_INDEX=https://pypi.tuna.tsinghua.edu.cn/simple
pip install -r requirements.txt -i %PIP_INDEX%
if errorlevel 1 (
    echo.
    echo [ERROR] pip install failed. Try:
    echo   pip install -r requirements.txt -i https://mirrors.aliyun.com/pypi/simple/
    pause
    exit /b 1
)
echo [OK] Python deps

echo.
echo [3/7] Installing Node.js dependencies...
cd /d "%~dp0web-react"
call npm install
if errorlevel 1 (
    echo [WARNING] npm install failed - React frontend will not start
)
cd /d "%~dp0"
echo [OK] Node deps

echo.
echo [4/7] Installing Playwright browsers...
playwright install chromium
if errorlevel 1 (
    echo [WARNING] Playwright install failed - RPA unavailable
) else (
    echo [OK] Playwright
)

echo.
echo [5/7] Setting up .env...
if not exist .env (
    copy .env.example .env >nul
    echo Created .env - edit it to add DEEPSEEK_API_KEY
) else (
    echo .env exists, skipping
)

echo.
echo [6/7] Initializing knowledge base...
python scripts/init_knowledge_base.py
if errorlevel 1 (
    echo [WARNING] KB init failed - add API key to .env and re-run:
    echo   python scripts/init_knowledge_base.py
)

echo.
echo [7/7] Neo4j Desktop (optional)
echo   Download: https://neo4j.com/download/
echo   Default: bolt://localhost:7687 (neo4j/legaladmin123)

echo.
echo ==========================================
echo   Setup complete!
echo.
echo   Start: start.bat or start.ps1
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:8080
echo   API Docs: http://localhost:8080/docs
echo ==========================================
pause
