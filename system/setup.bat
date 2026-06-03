@echo off
chcp 65001 >nul
echo ==========================================
echo   智能法务系统 - 一键环境初始化
echo ==========================================
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] 未检测到 Python，请先安装 Python 3.11+
    pause
    exit /b 1
)
echo Python 环境: OK

:: Create venv
echo.
echo [1/6] 创建虚拟环境...
python -m venv venv
if errorlevel 1 (
    echo [ERROR] 创建虚拟环境失败
    pause
    exit /b 1
)
call venv\Scripts\activate.bat
echo 虚拟环境: OK

:: Install dependencies
echo.
echo [2/6] 安装 Python 依赖（可能需要几分钟）...
echo.
echo   * 若下载失败，可将下方 PIP_INDEX 改回 setlocal 之前的值再重试 *
set PIP_INDEX=https://pypi.tuna.tsinghua.edu.cn/simple
pip install -r requirements.txt -i %PIP_INDEX%
if errorlevel 1 (
    echo.
    echo [ERROR] 依赖安装失败，请检查网络连接
    echo   国内用户可尝试其他镜像：
    echo    pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
    echo    pip install -r requirements.txt -i https://mirrors.aliyun.com/pypi/simple/
    pause
    exit /b 1
)
echo.
echo 依赖安装: OK

:: Install Playwright browsers
echo.
echo [3/6] 安装 Playwright 浏览器（约 500MB）...
playwright install chromium
if errorlevel 1 (
    echo [WARNING] Playwright 浏览器安装失败，RPA 功能不可用
) else (
    echo Playwright: OK
)

:: Setup .env
echo.
echo [4/6] 配置环境变量...
if not exist .env (
    copy .env.example .env >nul
    echo 已创建 .env 文件，请用编辑器打开填写 API Key
    echo 至少需要配置: DEEPSEEK_API_KEY
) else (
    echo .env 文件已存在，跳过
)

:: Init knowledge base
echo.
echo [5/6] 初始化知识库...
python scripts/init_knowledge_base.py
if errorlevel 1 (
    echo [WARNING] 知识库初始化失败（可能缺少 API Key），AI 功能暂不可用
    echo   请编辑 .env 填写 DEEPSEEK_API_KEY 后重新运行: python scripts/init_knowledge_base.py
)

:: Check Neo4j / Docker
echo.
echo [6/6] 检查 Neo4j...
docker compose up -d 2>nul
if errorlevel 1 (
    echo Neo4j 未启动（Docker 不可用或未安装），知识图谱功能暂不可用
) else (
    echo Neo4j: 已启动
)

echo.
echo ==========================================
echo   初始化完成！
echo.
echo   启动系统: venv\Scripts\activate ^&^& python -m src.main
echo   浏览器打开: http://localhost:8000
echo   API 文档:   http://localhost:8000/docs
echo ==========================================
pause
