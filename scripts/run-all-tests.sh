#!/bin/bash

# ============================================================================
# Script de Testing Completo - PCYMT RM
# Ejecuta todos los tests de los 3 proyectos y genera reporte
# ============================================================================

set -e  # Exit on error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$ROOT_DIR/apps/backend"
FRONTEND_DIR="$ROOT_DIR/apps/web-admin"
MOBILE_DIR="$ROOT_DIR/apps/mobile-android"
LOG_FILE="$ROOT_DIR/test-results-$(date +%Y%m%d-%H%M%S).log"

# Función para imprimir con color
print_color() {
    color=$1
    message=$2
    echo -e "${color}${message}${NC}"
}

# Función para imprimir header
print_header() {
    echo ""
    print_color "$BLUE" "===================================================================="
    print_color "$BLUE" "$1"
    print_color "$BLUE" "===================================================================="
    echo ""
}

# Función para verificar prerequisitos
check_prerequisites() {
    print_header "🔍 Verificando Prerequisitos"
    
    # Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_color "$GREEN" "✅ Node.js: $NODE_VERSION"
    else
        print_color "$RED" "❌ Node.js no está instalado"
        exit 1
    fi
    
    # npm
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        print_color "$GREEN" "✅ npm: $NPM_VERSION"
    else
        print_color "$RED" "❌ npm no está instalado"
        exit 1
    fi
    
    # PostgreSQL
    if command -v psql &> /dev/null; then
        PSQL_VERSION=$(psql --version)
        print_color "$GREEN" "✅ PostgreSQL: $PSQL_VERSION"
    else
        print_color "$YELLOW" "⚠️  PostgreSQL no está en PATH (puede estar instalado)"
    fi
    
    # Java (para Android)
    if command -v java &> /dev/null; then
        JAVA_VERSION=$(java --version | head -n 1)
        print_color "$GREEN" "✅ Java: $JAVA_VERSION"
    else
        print_color "$YELLOW" "⚠️  Java no está instalado (necesario para tests móvil)"
    fi
}

# Función para ejecutar tests del backend
test_backend() {
    print_header "📦 Tests del Backend"
    
    if [ ! -d "$BACKEND_DIR" ]; then
        print_color "$RED" "❌ Directorio $BACKEND_DIR no encontrado"
        return 1
    fi
    
    cd "$BACKEND_DIR"
    
    # Verificar .env
    if [ ! -f ".env" ]; then
        print_color "$YELLOW" "⚠️  Archivo .env no encontrado, usando .env.example"
        cp .env.example .env
    fi
    
    # Instalar dependencias si es necesario
    if [ ! -d "node_modules" ]; then
        print_color "$YELLOW" "📥 Instalando dependencias del backend..."
        npm install
    fi
    
    # Ejecutar tests
    print_color "$BLUE" "🧪 Ejecutando tests del backend..."
    
    if npm test -- --coverage 2>&1 | tee -a "$LOG_FILE"; then
        print_color "$GREEN" "✅ Tests del backend: PASSED"
        BACKEND_STATUS=0
    else
        print_color "$RED" "❌ Tests del backend: FAILED"
        BACKEND_STATUS=1
    fi
    
    cd ..
    return $BACKEND_STATUS
}

# Función para ejecutar tests del frontend
test_frontend() {
    print_header "🎨 Tests del Frontend"
    
    if [ ! -d "$FRONTEND_DIR" ]; then
        print_color "$RED" "❌ Directorio $FRONTEND_DIR no encontrado"
        return 1
    fi
    
    cd "$FRONTEND_DIR"
    
    # Instalar dependencias si es necesario
    if [ ! -d "node_modules" ]; then
        print_color "$YELLOW" "📥 Instalando dependencias del frontend..."
        npm install
    fi
    
    # Ejecutar tests
    print_color "$BLUE" "🧪 Ejecutando tests del frontend..."
    
    if ng test --watch=false --code-coverage --browsers=ChromeHeadless 2>&1 | tee -a "$LOG_FILE"; then
        print_color "$GREEN" "✅ Tests del frontend: PASSED"
        FRONTEND_STATUS=0
    else
        print_color "$RED" "❌ Tests del frontend: FAILED"
        FRONTEND_STATUS=1
    fi
    
    cd ..
    return $FRONTEND_STATUS
}

# Función para ejecutar tests del móvil
test_mobile() {
    print_header "📱 Tests del Móvil"
    
    if [ ! -d "$MOBILE_DIR" ]; then
        print_color "$RED" "❌ Directorio $MOBILE_DIR no encontrado"
        return 1
    fi
    
    cd "$MOBILE_DIR"
    
    # Verificar Gradle Wrapper
    if [ ! -f "gradlew" ]; then
        print_color "$RED" "❌ Gradle Wrapper no encontrado"
        cd ..
        return 1
    fi
    
    # Dar permisos de ejecución
    chmod +x gradlew
    
    # Ejecutar tests
    print_color "$BLUE" "🧪 Ejecutando tests del móvil..."
    
    if ./gradlew test 2>&1 | tee -a "$LOG_FILE"; then
        print_color "$GREEN" "✅ Tests del móvil: PASSED"
        MOBILE_STATUS=0
    else
        print_color "$RED" "❌ Tests del móvil: FAILED"
        MOBILE_STATUS=1
    fi
    
    cd ..
    return $MOBILE_STATUS
}

# Función para generar reporte final
generate_report() {
    print_header "📊 Reporte Final"
    
    echo ""
    print_color "$BLUE" "Resultados de Tests:"
    echo ""
    
    # Backend
    if [ $BACKEND_STATUS -eq 0 ]; then
        print_color "$GREEN" "  Backend:  ✅ PASSED"
    else
        print_color "$RED" "  Backend:  ❌ FAILED"
    fi
    
    # Frontend
    if [ $FRONTEND_STATUS -eq 0 ]; then
        print_color "$GREEN" "  Frontend: ✅ PASSED"
    else
        print_color "$RED" "  Frontend: ❌ FAILED"
    fi
    
    # Móvil
    if [ $MOBILE_STATUS -eq 0 ]; then
        print_color "$GREEN" "  Móvil:    ✅ PASSED"
    else
        print_color "$RED" "  Móvil:    ❌ FAILED"
    fi
    
    echo ""
    print_color "$BLUE" "Log guardado en: $LOG_FILE"
    echo ""
    
    # Resumen de cobertura
    if [ -f "$BACKEND_DIR/coverage/coverage-summary.json" ]; then
        print_color "$BLUE" "📊 Cobertura del Backend:"
        cat "$BACKEND_DIR/coverage/coverage-summary.json" | grep -A 4 '"total"' || true
        echo ""
    fi
    
    if [ -f "$FRONTEND_DIR/coverage/lcov-report/index.html" ]; then
        print_color "$BLUE" "📊 Reporte de cobertura Frontend: $FRONTEND_DIR/coverage/lcov-report/index.html"
        echo ""
    fi
    
    # Exit code general
    if [ $BACKEND_STATUS -eq 0 ] && [ $FRONTEND_STATUS -eq 0 ] && [ $MOBILE_STATUS -eq 0 ]; then
        print_color "$GREEN" "✅ Todos los tests pasaron exitosamente"
        return 0
    else
        print_color "$RED" "❌ Algunos tests fallaron"
        return 1
    fi
}

# ============================================================================
# Main Execution
# ============================================================================

print_header "🧪 PCYMT RM - Suite Completa de Tests"
print_color "$YELLOW" "Fecha: $(date)"
print_color "$YELLOW" "Log: $LOG_FILE"

# Verificar prerequisitos
check_prerequisites

# Inicializar variables de estado
BACKEND_STATUS=0
FRONTEND_STATUS=0
MOBILE_STATUS=0

# Ejecutar tests (continuar incluso si alguno falla)
test_backend || BACKEND_STATUS=$?
test_frontend || FRONTEND_STATUS=$?
test_mobile || MOBILE_STATUS=$?

# Generar reporte
generate_report
FINAL_STATUS=$?

# Exit
exit $FINAL_STATUS
