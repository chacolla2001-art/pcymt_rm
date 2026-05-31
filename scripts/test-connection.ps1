# Test de conexión Backend ↔ Frontend
# Ejecutar desde la raíz del monorepo: .\scripts\test-connection.ps1

param(
    [string]$BackendUrl = "http://localhost:5000",
    [string]$FrontendUrl = "http://localhost:4200"
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$BackendDir = Join-Path $RootDir "apps\backend"
$FrontendDir = Join-Path $RootDir "apps\web-admin"
$EnvPath = Join-Path $FrontendDir "src\app\environments\environment.ts"

Write-Host "`n=== PCyMT RM — Test de Conexión ===`n" -ForegroundColor Cyan

# 1. Backend health
Write-Host "Verificando backend en $BackendUrl ..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$BackendUrl/health" -TimeoutSec 5
    Write-Host "  Backend: OK ($($health.status))" -ForegroundColor Green
} catch {
    Write-Host "  Backend: NO RESPONDE" -ForegroundColor Red
    Write-Host "  Inicia con: cd apps\backend; npm run dev" -ForegroundColor Gray
}

# 2. Frontend environment
Write-Host "`nVerificando configuración del frontend..." -ForegroundColor Yellow
if (Test-Path $EnvPath) {
    $content = Get-Content $EnvPath -Raw
    if ($content -match "localhost:5000") {
        Write-Host "  environment.ts: apunta a localhost:5000" -ForegroundColor Green
    } else {
        Write-Host "  environment.ts: revisar API_URL" -ForegroundColor Yellow
    }
} else {
    Write-Host "  environment.ts: NO ENCONTRADO" -ForegroundColor Red
}

# 3. Frontend reachability
Write-Host "`nVerificando frontend en $FrontendUrl ..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri $FrontendUrl -TimeoutSec 5 -UseBasicParsing
    Write-Host "  Frontend: OK (HTTP $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "  Frontend: NO RESPONDE" -ForegroundColor Red
    Write-Host "  Inicia con: cd apps\web-admin; npm start" -ForegroundColor Gray
}

Write-Host "`n=== Comandos útiles ===" -ForegroundColor Cyan
Write-Host "Backend:  cd apps\backend; npm run dev" -ForegroundColor Gray
Write-Host "Frontend: cd apps\web-admin; npm start`n" -ForegroundColor Gray
