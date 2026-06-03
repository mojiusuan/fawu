@echo off
chcp 65001 >nul 2>&1
call venv\Scripts\activate.bat
echo Starting Legal AI System...
echo Open: http://localhost:8000
echo Docs: http://localhost:8000/docs
echo Press Ctrl+C to stop
echo.
python -m src.main
pause
