# ============================================================================
# Script de Testing Completo - PCYMT RM (Windows PowerShell)
# Ejecuta todos los tests de los 3 proyectos y genera reporte
# ============================================================================

param(
    [switch]$SkipBackend,
    [switch]$SkipFrontend,
    [switch]$SkipMobile,
    [switch]$Coverage
)

# Variables
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$BACKEND_DIR = Join-Path $RootDir "apps\backend"
$FRONTEND_DIR = Join-Path $RootDir "apps\web-admin"
$MOBILE_DIR = Join-Path $RootDir "apps\mobile-android"
$LOG_FILE = Join-Path $RootDir "test-results-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"

# Estado de tests
$script:BackendStatus = 0
$script:FrontendStatus = 0
$script:MobileStatus = 0

# Función para imprimir con color
function Write-ColoredOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

# Función para imprimir header
function Write-Header {
    param([string]$Title)
    Write-Host ""
    Write-ColoredOutput "====================================================================" "Blue"
    Write-ColoredOutput $Title "Blue"
    Write-ColoredOutput "====================================================================" "Blue"
    Write-Host ""
}

# Función para verificar prerequisitos
function Test-Prerequisites {
    Write-Header "🔍 Verificando Prerequisitos"
    
    # Node.js
    try {
        $nodeVersion = node --version
        Write-ColoredOutput "✅ Node.js: $nodeVersion" "Green"
    } catch {
        Write-ColoredOutput "❌ Node.js no está instalado" "Red"
        exit 1
    }
    
    # npm
    try {
        $npmVersion = npm --version
        Write-ColoredOutput "✅ npm: $npmVersion" "Green"
    } catch {
        Write-ColoredOutput "❌ npm no está instalado" "Red"
        exit 1
    }
    
    # PostgreSQL
    try {
        $psqlVersion = psql --version
        Write-ColoredOutput "✅ PostgreSQL: $psqlVersion" "Green"
    } catch {
        Write-ColoredOutput "⚠️  PostgreSQL no está en PATH (puede estar instalado)" "Yellow"
    }
    
    # Java
    try {
        $javaVersion = java --version | Select-Object -First 1
        Write-ColoredOutput "✅ Java: $javaVersion" "Green"
    } catch {
        Write-ColoredOutput "⚠️  Java no está instalado (necesario para tests móvil)" "Yellow"
    }
}

# Función para ejecutar tests del backend
function Test-Backend {
    Write-Header "📦 Tests del Backend"
    
    if (-not (Test-Path $BACKEND_DIR)) {
        Write-ColoredOutput "❌ Directorio $BACKEND_DIR no encontrado" "Red"
        $script:BackendStatus = 1
        return
    }
    
    Push-Location $BACKEND_DIR
    
    try {
        # Verificar .env
        if (-not (Test-Path ".env")) {
            Write-ColoredOutput "⚠️  Archivo .env no encontrado, usando .env.example" "Yellow"
            Copy-Item ".env.example" ".env"
        }
        
        # Instalar dependencias si es necesario
        if (-not (Test-Path "node_modules")) {
            Write-ColoredOutput "📥 Instalando dependencias del backend..." "Yellow"
            npm install
        }
        
        # Ejecutar tests
        Write-ColoredOutput "🧪 Ejecutando tests del backend..." "Blue"
        
        if ($Coverage) {
            npm run test:coverage 2>&1 | Tee-Object -FilePath "..\$LOG_FILE" -Append
        } else {
            npm test 2>&1 | Tee-Object -FilePath "..\$LOG_FILE" -Append
        }
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColoredOutput "✅ Tests del backend: PASSED" "Green"
            $script:BackendStatus = 0
        } else {
            Write-ColoredOutput "❌ Tests del backend: FAILED" "Red"
            $script:BackendStatus = 1
        }
    }
    catch {
        Write-ColoredOutput "❌ Error ejecutando tests del backend: $_" "Red"
        $script:BackendStatus = 1
    }
    finally {
        Pop-Location
    }
}

# Función para ejecutar tests del frontend
function Test-Frontend {
    Write-Header "🎨 Tests del Frontend"
    
    if (-not (Test-Path $FRONTEND_DIR)) {
        Write-ColoredOutput "❌ Directorio $FRONTEND_DIR no encontrado" "Red"
        $script:FrontendStatus = 1
        return
    }
    
    Push-Location $FRONTEND_DIR
    
    try {
        # Instalar dependencias si es necesario
        if (-not (Test-Path "node_modules")) {
            Write-ColoredOutput "📥 Instalando dependencias del frontend..." "Yellow"
            npm install
        }
        
        # Ejecutar tests
        Write-ColoredOutput "🧪 Ejecutando tests del frontend..." "Blue"
        
        if ($Coverage) {
            ng test --watch=false --code-coverage --browsers=ChromeHeadless 2>&1 | Tee-Object -FilePath "..\$LOG_FILE" -Append
        } else {
            ng test --watch=false --browsers=ChromeHeadless 2>&1 | Tee-Object -FilePath "..\$LOG_FILE" -Append
        }
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColoredOutput "✅ Tests del frontend: PASSED" "Green"
            $script:FrontendStatus = 0
        } else {
            Write-ColoredOutput "❌ Tests del frontend: FAILED" "Red"
            $script:FrontendStatus = 1
        }
    }
    catch {
        Write-ColoredOutput "❌ Error ejecutando tests del frontend: $_" "Red"
        $script:FrontendStatus = 1
    }
    finally {
        Pop-Location
    }
}

# Función para ejecutar tests del móvil
function Test-Mobile {
    Write-Header "📱 Tests del Móvil"
    
    if (-not (Test-Path $MOBILE_DIR)) {
        Write-ColoredOutput "❌ Directorio $MOBILE_DIR no encontrado" "Red"
        $script:MobileStatus = 1
        return
    }
    
    Push-Location $MOBILE_DIR
    
    try {
        # Verificar Gradle Wrapper
        if (-not (Test-Path "gradlew.bat")) {
            Write-ColoredOutput "❌ Gradle Wrapper no encontrado" "Red"
            $script:MobileStatus = 1
            return
        }
        
        # Ejecutar tests
        Write-ColoredOutput "🧪 Ejecutando tests del móvil..." "Blue"
        
        .\gradlew.bat test 2>&1 | Tee-Object -FilePath "..\$LOG_FILE" -Append
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColoredOutput "✅ Tests del móvil: PASSED" "Green"
            $script:MobileStatus = 0
        } else {
            Write-ColoredOutput "❌ Tests del móvil: FAILED" "Red"
            $script:MobileStatus = 1
        }
    }
    catch {
        Write-ColoredOutput "❌ Error ejecutando tests del móvil: $_" "Red"
        $script:MobileStatus = 1
    }
    finally {
        Pop-Location
    }
}

# Función para generar reporte final
function Write-FinalReport {
    Write-Header "📊 Reporte Final"
    
    Write-Host ""
    Write-ColoredOutput "Resultados de Tests:" "Blue"
    Write-Host ""
    
    # Backend
    if ($script:BackendStatus -eq 0) {
        Write-ColoredOutput "  Backend:  ✅ PASSED" "Green"
    } else {
        Write-ColoredOutput "  Backend:  ❌ FAILED" "Red"
    }
    
    # Frontend
    if ($script:FrontendStatus -eq 0) {
        Write-ColoredOutput "  Frontend: ✅ PASSED" "Green"
    } else {
        Write-ColoredOutput "  Frontend: ❌ FAILED" "Red"
    }
    
    # Móvil
    if ($script:MobileStatus -eq 0) {
        Write-ColoredOutput "  Móvil:    ✅ PASSED" "Green"
    } else {
        Write-ColoredOutput "  Móvil:    ❌ FAILED" "Red"
    }
    
    Write-Host ""
    Write-ColoredOutput "Log guardado en: $LOG_FILE" "Blue"
    Write-Host ""
    
    # Resumen de cobertura
    if (Test-Path "$BACKEND_DIR\coverage\coverage-summary.json") {
        Write-ColoredOutput "📊 Cobertura del Backend:" "Blue"
        Get-Content "$BACKEND_DIR\coverage\coverage-summary.json" | Select-String -Pattern '"total"' -Context 0,4
        Write-Host ""
    }
    
    if (Test-Path "$FRONTEND_DIR\coverage\lcov-report\index.html") {
        Write-ColoredOutput "📊 Reporte de cobertura Frontend: $FRONTEND_DIR\coverage\lcov-report\index.html" "Blue"
        Write-Host ""
    }
    
    # Exit code general
    if ($script:BackendStatus -eq 0 -and $script:FrontendStatus -eq 0 -and $script:MobileStatus -eq 0) {
        Write-ColoredOutput "✅ Todos los tests pasaron exitosamente" "Green"
        return 0
    } else {
        Write-ColoredOutput "❌ Algunos tests fallaron" "Red"
        return 1
    }
}

# ============================================================================
# Main Execution
# ============================================================================

Write-Header "🧪 PCYMT RM - Suite Completa de Tests"
Write-ColoredOutput "Fecha: $(Get-Date)" "Yellow"
Write-ColoredOutput "Log: $LOG_FILE" "Yellow"

# Verificar prerequisitos
Test-Prerequisites

# Ejecutar tests
if (-not $SkipBackend) {
    Test-Backend
} else {
    Write-ColoredOutput "⏭️  Saltando tests del backend" "Yellow"
}

if (-not $SkipFrontend) {
    Test-Frontend
} else {
    Write-ColoredOutput "⏭️  Saltando tests del frontend" "Yellow"
}

if (-not $SkipMobile) {
    Test-Mobile
} else {
    Write-ColoredOutput "⏭️  Saltando tests del móvil" "Yellow"
}

# Generar reporte
$finalStatus = Write-FinalReport

# Exit
exit $finalStatus
