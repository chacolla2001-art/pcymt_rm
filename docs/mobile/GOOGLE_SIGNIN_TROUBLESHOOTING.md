# 🔧 Troubleshooting: Google Sign-In

Si experimentas problemas con Google Sign-In en la app móvil, sigue esta guía.

---

## ❌ Error: "Activity is cancelled by the user"

### Síntoma
El diálogo de Google Sign-In aparece brevemente y se cierra automáticamente.

### Causas Comunes

#### 1. WEB_CLIENT_ID Incorrecto

**Verificar:**
```bash
cat apps/mobile-android/local.properties | grep WEB_CLIENT_ID
```

**Debe ser:**
```
WEB_CLIENT_ID=1061024660113-hjkb4lj8vnvuqg7vf29u6u0t6m71ug0n.apps.googleusercontent.com
```

**NO debe ser:**
- El ID del cliente Android
- Un ID que termine en `.iam.gserviceaccount.com`
- Vacío o con valor de ejemplo

**Solución:**
1. Ve a [Google Cloud Console](https://console.cloud.google.com)
2. Selecciona tu proyecto
3. APIs & Services → Credentials
4. Busca "Web client" u "OAuth 2.0 Web Application"
5. Copia ese Client ID al `local.properties`

---

#### 2. SHA-1 del Debug Keystore No Registrado

**Obtener SHA-1 del debug keystore:**
```bash
cd apps/mobile-android
./gradlew signingReport
```

**Buscar en la salida:**
```
Variant: debug
SHA1: AA:BB:CC:DD:EE:FF:... (28 caracteres hexadecimales)
```

**Registrar en Google Console:**
1. Google Cloud Console → APIs & Services → Credentials
2. Click en el OAuth Client ID (Android)
3. Agregar el SHA-1 en "SHA-1 certificate fingerprints"
4. Guardar

**⚠️ Importante:** El SHA-1 del **debug keystore** es diferente al **release keystore**

---

#### 3. Google Play Services Desactualizado

**Verificar versión:**
```
Ajustes → Apps → Google Play Services → Detalles
```

**Debe ser:** Versión 23.x o superior

**Si es antigua:**
1. Play Store → Buscar "Google Play Services"
2. Actualizar
3. Reiniciar dispositivo

---

#### 4. Cuenta de Google No Autorizada

**Verificar en Google Console:**
1. OAuth consent screen
2. Sección "Test users"
3. Agregar tu email: `chacolla43@gmail.com`

**Solo necesario si:**
- La app está en modo "Testing"
- No está publicada en Play Store

---

## 🔍 Diagnóstico Paso a Paso

### Paso 1: Verificar Variables de Entorno

```bash
# En local.properties
BASE_URL=http://192.168.1.13:5000
WEB_CLIENT_ID=1061024660113-hjkb4lj8vnvuqg7vf29u6u0t6m71ug0n.apps.googleusercontent.com
```

### Paso 2: Verificar Backend Recibe el Token

**Iniciar backend en modo debug:**
```bash
cd apps/backend
npm run dev:debug
```

**Buscar en logs:**
```
[DEBUG] Google login request received
```

Si aparece → El token llegó al backend ✅  
Si no aparece → Problema en el móvil ❌

### Paso 3: Verificar Credenciales en Google Console

**Checklist:**
- [ ] Proyecto creado en Google Cloud
- [ ] OAuth consent screen configurado
- [ ] Credencial "Web client" creada
- [ ] Credencial "Android" creada con SHA-1 de debug
- [ ] Email agregado en "Test users"

### Paso 4: Limpiar Caché de Google Play Services

```bash
# En el dispositivo
Ajustes → Apps → Google Play Services
→ Almacenamiento → Borrar caché (NO borrar datos)
→ Reiniciar app
```

---

## 🛠️ Comandos Útiles

### Obtener SHA-1 del Keystore
```bash
# Debug keystore (desarrollo)
cd apps/mobile-android
./gradlew signingReport

# Release keystore (producción)
keytool -list -v -keystore keystore/pcymt-release.keystore -alias pcymt-key
```

### Rebuild Completo
```bash
cd apps/mobile-android
./gradlew clean
./gradlew assembleDebug
```

### Logs en Tiempo Real
```bash
# Ver todos los logs de la app
adb logcat | grep "com.univalle.pedrochacolla"

# Solo errores
adb logcat *:E | grep "com.univalle.pedrochacolla"

# Google Sign-In específico
adb logcat | grep -E "(GoogleSignIn|CredentialManager)"
```

---

## 📋 Checklist Final

Antes de volver a intentar, verifica:

- [ ] `WEB_CLIENT_ID` es el del Web client, no Android
- [ ] SHA-1 del debug keystore está en Google Console
- [ ] Google Play Services actualizado (v23+)
- [ ] Backend corriendo en `http://192.168.1.13:5000`
- [ ] Dispositivo en la misma red que el backend
- [ ] Email agregado en Test users (si app en Testing)
- [ ] App reconstruida después de cambios en `local.properties`

---

## 🔗 URLs Importantes

- **Google Cloud Console:** https://console.cloud.google.com
- **OAuth 2.0 Playground:** https://developers.google.com/oauthplayground
- **Docs OAuth:** https://developers.google.com/identity/protocols/oauth2

---

## 📞 Soporte

Si el problema persiste después de seguir todos los pasos:

1. Captura el output completo de:
   ```bash
   adb logcat > google-signin-error.log
   ```

2. Captura screenshot de:
   - Google Cloud Console → Credentials
   - `local.properties` (oculta datos sensibles)
   - Output de `./gradlew signingReport`

3. Revisa backend logs para ver si el token llega

---

**Última actualización:** 9 de febrero de 2026
