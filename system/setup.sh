#!/usr/bin/env bash
set -e

echo "=========================================="
echo "  Legal AI System v3.0 - Setup"
echo "=========================================="
echo ""

if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python not found. Install Python 3.11+"
    exit 1
fi
echo "[OK] Python: $(python3 --version)"

if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js not found. Install Node.js 18+"
    exit 1
fi
echo "[OK] Node.js: $(node --version)"

echo ""
echo "[1/7] Creating virtual environment..."
python3 -m venv venv
source venv/bin/activate
echo "[OK] venv"

echo ""
echo "[2/7] Installing Python dependencies..."
PIP_INDEX="${PIP_INDEX:-https://mirrors.aliyun.com/pypi/simple/}"
pip install -r requirements.txt -i "$PIP_INDEX" --timeout 120 --retries 5 || {
    echo ""
    echo "[ERROR] pip install failed."
    echo "  China:  PIP_INDEX=https://mirrors.cloud.tencent.com/pypi/simple/ ./setup.sh"
    echo "  Global: PIP_INDEX=https://pypi.org/simple/ ./setup.sh"
    exit 1
}
echo "[OK] Python deps"

echo ""
echo "[3/7] Installing Node.js dependencies..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/web-react"
npm install || echo "[WARNING] npm install failed"
cd "$SCRIPT_DIR"
echo "[OK] Node deps"

echo ""
echo "[4/7] Installing Playwright browsers..."
playwright install chromium || echo "[WARNING] Playwright failed - RPA unavailable"
echo "[OK] Playwright"

echo ""
echo "[5/7] Setting up .env..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env - edit it to add DEEPSEEK_API_KEY"
else
    echo ".env exists, skipping"
fi

echo ""
echo "[6/7] Initializing knowledge base..."
python scripts/init_knowledge_base.py || {
    echo "[WARNING] KB init failed - add API key to .env and re-run:"
    echo "  python scripts/init_knowledge_base.py"
}

echo ""
echo "[7/7] Neo4j Desktop (optional)"
echo "  Download: https://neo4j.com/download/"
echo "  Default: bolt://localhost:7687 (neo4j/legaladmin123)"

echo ""
echo "=========================================="
echo "  Setup complete!"
echo ""
echo "  Start: bash start.sh  or  pwsh start.ps1"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8080"
echo "  API Docs: http://localhost:8080/docs"
echo "=========================================="
