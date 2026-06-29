# Instalar APK en celular físico con ADB

## 1. Habilitar depuración USB en el teléfono

1. Abre **Ajustes → Acerca del teléfono**.
2. Toca **Número de compilación** 7 veces para activar **Opciones de desarrollador**.
3. Ve a **Ajustes → Sistema → Opciones de desarrollador**.
4. Activa **Depuración USB**.
5. (Opcional) Activa **Instalar vía USB** si tu fabricante lo muestra.

## 2. Conectar el teléfono

1. Conecta el cable USB al PC.
2. En el teléfono, acepta el diálogo **Permitir depuración USB** y marca **Confiar siempre en este equipo**.
3. Verifica la conexión:

```bash
source ~/.bashrc.d/android-dev.sh
adb devices -l
```

Debes ver tu dispositivo como `device` (no `unauthorized`).

## 3. Compilar e instalar

Desde `apps/mobile-android`:

```bash
make build-debug
make install
```

O manualmente:

```bash
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## 4. Problemas comunes

| Síntoma | Solución |
|---------|----------|
| `unauthorized` | Revoca autorizaciones USB en Opciones de desarrollador y reconecta |
| `no devices` | Prueba otro cable/puerto USB; instala reglas udev si hace falta |
| Instalación falla por firma | Desinstala la app anterior: `adb uninstall com.univalle.pedrochacolla` |

## 5. Ver logs en vivo

```bash
make logcat
```
