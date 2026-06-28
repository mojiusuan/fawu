Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Legal AI System v3.0" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"

# Check Python
try {
    python --version 2>$null | Out-Null
    Write-Host "[OK] Python found" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Python not found" -ForegroundColor Red
    pause; exit 1
}

# Check Node
try {
    node --version 2>$null | Out-Null
    Write-Host "[OK] Node.js found" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Node.js not found" -ForegroundColor Red
    pause; exit 1
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "[1/2] Starting backend on port 8080 ..." -ForegroundColor Yellow
# Use venv python if exists, fallback to global python
$pyExe = Join-Path $root "venv\Scripts\python.exe"
if (Test-Path $pyExe) {
    Write-Host "  Using venv Python" -ForegroundColor Gray
    Start-Process $pyExe -ArgumentList "-m", "src.main" -WorkingDirectory $root
} else {
    Write-Host "  Using global Python" -ForegroundColor Gray
    Start-Process python -ArgumentList "-m", "src.main" -WorkingDirectory $root
}

Write-Host "[2/2] Starting frontend on port 5173 ..." -ForegroundColor Yellow
$webDir = Join-Path $root "web-react"
Start-Process cmd -ArgumentList "/c", "npm run dev" -WorkingDirectory $webDir

# Wait for backend to be ready
Write-Host ""
Write-Host "Waiting for backend to be ready..." -ForegroundColor Gray
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:8080/api/health" -TimeoutSec 2 -ErrorAction Stop
        if ($r.StatusCode -eq 200) {
            $ready = $true
            Write-Host "[OK] Backend ready (${i}s)" -ForegroundColor Green
            break
        }
    } catch {}
}
if (-not $ready) {
    Write-Host "[WARN] Backend may still be loading, check the backend window" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Frontend : http://localhost:5173" -ForegroundColor White
Write-Host "  Backend  : http://localhost:8080" -ForegroundColor White
Write-Host "  API Docs : http://localhost:8080/docs" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Demo accounts:" -ForegroundColor Yellow
Write-Host "  admin   / admin123"
Write-Host "  legal01 / legal123"
Write-Host "  biz01   / biz123"
Write-Host "  audit01 / audit123"
Write-Host ""

Start-Process "http://localhost:5173"
