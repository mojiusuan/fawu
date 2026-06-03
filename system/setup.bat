@echo off
chcp 65001 >nul 2>&1
echo ==========================================
echo   Legal AI System - Setup
echo ==========================================
echo.

python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Please install Python 3.11+
    pause
    exit /b 1
)
echo Python: OK

echo.
echo [1/6] Creating virtual environment...
python -m venv venv
if errorlevel 1 (
    echo [ERROR] Failed to create venv
    pause
    exit /b 1
)
call venv\Scripts\activate.bat
echo venv: OK

echo.
echo [2/6] Installing Python dependencies...
set PIP_INDEX=https://pypi.tuna.tsinghua.edu.cn/simple
pip install -r requirements.txt -i %PIP_INDEX%
if errorlevel 1 (
    echo.
    echo [ERROR] pip install failed. Try another mirror:
    echo   pip install -r requirements.txt -i https://mirrors.aliyun.com/pypi/simple/
    pause
    exit /b 1
)
echo.
echo Dependencies: OK

echo.
echo [3/6] Installing Playwright browsers...
playwright install chromium
if errorlevel 1 (
    echo [WARNING] Playwright install failed, RPA features unavailable
) else (
    echo Playwright: OK
)

echo.
echo [4/6] Setting up .env...
if not exist .env (
    copy .env.example .env >nul
    echo Created .env - edit it to add DEEPSEEK_API_KEY
) else (
    echo .env already exists, skipping
)

echo.
echo [5/6] Initializing knowledge base...
python scripts/init_knowledge_base.py
if errorlevel 1 (
    echo [WARNING] Knowledge base init failed - add API key to .env then re-run:
    echo   python scripts/init_knowledge_base.py
)

echo.
echo [6/6] Starting Neo4j...
docker compose up -d 2>nul
if errorlevel 1 (
    echo Neo4j not started (Docker unavailable), knowledge graph disabled
) else (
    echo Neo4j: started
)

echo.
echo ==========================================
echo   Setup complete!
echo.
echo   Run:  venv\Scripts\activate ^&^& python -m src.main
echo   Open: http://localhost:8000
echo   Docs: http://localhost:8000/docs
echo ==========================================
pause
