# MCP Open Windows Startup Script

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "MCP Open - Startup Script"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "   MCP Open - Windows Startup" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

# Check Node.js
$NodeFound = $false
$NodeVersion = ""

try {
    $NodeVersion = node -v 2>$null
    if ($NodeVersion) {
        $NodeFound = $true
    }
} catch {
    $NodeFound = $false
}

if (-not $NodeFound) {
    $NodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if ($NodeCmd) {
        $NodeFound = $true
        $NodeVersion = node -v 2>$null
    }
}

if ($NodeFound) {
    Write-Host "[INFO] Node.js: $NodeVersion" -ForegroundColor Cyan
} else {
    Write-Host "[ERROR] Node.js not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Node.js (v18+)" -ForegroundColor Yellow
    Write-Host "Download: https://nodejs.org/" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host ""

# Detect package manager
$PM = "npm"
$PnpmCmd = Get-Command pnpm -ErrorAction SilentlyContinue
if ($PnpmCmd -and (Test-Path "pnpm-lock.yaml")) {
    $PM = "pnpm"
    Write-Host "[INFO] Using pnpm" -ForegroundColor Cyan
} else {
    Write-Host "[INFO] Using npm" -ForegroundColor Cyan
}
Write-Host ""

# Install dependencies
if (-not (Test-Path "node_modules")) {
    Write-Host "[INFO] Installing dependencies..." -ForegroundColor Cyan
    & $PM install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to install dependencies" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "[OK] Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "[OK] Dependencies already installed" -ForegroundColor Green
}
Write-Host ""

# Build frontend
if (-not (Test-Path "dist")) {
    Write-Host "[INFO] Building frontend..." -ForegroundColor Cyan
    & $PM run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Build failed" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "[OK] Frontend built" -ForegroundColor Green
} else {
    Write-Host "[OK] Frontend already built" -ForegroundColor Green
}
Write-Host ""

# Start service
$URL = "http://localhost:3001"
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  Starting Service" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "URL: $URL"
Write-Host "Stop: Ctrl + C"
Write-Host ""
Write-Host "[INFO] Starting service..." -ForegroundColor Cyan
Write-Host ""

# Ensure uv / uvx availability on Windows
try {
    $uvCmd = Get-Command uv -ErrorAction SilentlyContinue
    if (-not $uvCmd) {
        Write-Host "[INFO] uv not found. Installing uv..." -ForegroundColor Yellow
        try {
            iwr https://astral.sh/uv/install.ps1 -UseBasicParsing | iex
            Write-Host "[INFO] uv installed successfully" -ForegroundColor Green
        } catch {
            Write-Host "[WARN] Failed to install uv automatically. You can install manually from https://astral.sh/uv/" -ForegroundColor Yellow
        }
    }

    $uvDir = Join-Path $env:LOCALAPPDATA "Programs\uv"
    if (Test-Path $uvDir) {
        if (-not ($env:PATH -like "*$uvDir*")) {
            $env:PATH = "$uvDir;$env:PATH"
            Write-Host "[INFO] Added uv to PATH: $uvDir" -ForegroundColor Cyan
        }
    }

    if (-not $env:UV_CACHE_DIR) {
        $env:UV_CACHE_DIR = Join-Path $env:LOCALAPPDATA "uv\cache"
        New-Item -ItemType Directory -Force -Path $env:UV_CACHE_DIR | Out-Null
        Write-Host "[INFO] Set UV_CACHE_DIR=$env:UV_CACHE_DIR" -ForegroundColor Cyan
    }

    $uvxCmd = Get-Command uvx -ErrorAction SilentlyContinue
    if (-not $uvxCmd -and (Get-Command uv -ErrorAction SilentlyContinue)) {
        function uvx { param([Parameter(ValueFromRemainingArguments = $true)][object[]]$args) uv x @args }
        Write-Host "[INFO] Defined uvx shim (uv x ...)" -ForegroundColor Cyan
    }
} catch {
    Write-Host "[WARN] uv/uvx setup skipped due to error: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Wait a bit then open browser
Start-Sleep -Seconds 3
try {
    Start-Process $URL
} catch {
    Write-Host "[WARN] Could not open browser automatically" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[RUNNING] Service is running" -ForegroundColor Green
Write-Host ""
Write-Host "Service logs:" -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Gray

# Run service in foreground (blocking)
& $PM start

Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host ""
Write-Host "[INFO] Service stopped" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to exit"
