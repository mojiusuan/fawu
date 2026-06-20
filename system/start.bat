@echo off
chcp 65001 >nul
title 智能法务系统 v3.0

echo ========================================
echo   智能法务系统 v3.0
echo   Intelligent Legal System
echo ========================================
echo.

where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [X] 未找到 Python，请先安装 Python 3.10+
    pause
    exit /b 1
)

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [X] 未找到 Node.js，请先安装 Node.js 18+
    pause
    exit /b 1
)

echo [1/2] 启动后端 (端口 8080)...
cd /d "%~dp0"
start "法务后端" cmd /c "cd /d %~dp0 && python -m src.main"

timeout /t 4 /nobreak >nul

echo [2/2] 启动前端 (端口 5173)...
start "法务前端" cmd /c "cd /d %~dp0web-react && npm run dev"

timeout /t 4 /nobreak >nul

echo.
echo ========================================
echo   React 前端:  http://localhost:5173
echo   API 接口 :   http://localhost:8080
echo   API 文档 :   http://localhost:8080/docs
echo ========================================
echo.
echo   演示账户:
echo     admin   / admin123   (管理员)
echo     legal01 / legal123   (法务人员)
echo     biz01   / biz123     (业务人员)
echo     audit01 / audit123   (审计员)
echo ========================================
echo.
echo 按任意键打开浏览器...
pause >nul
start http://localhost:5173
