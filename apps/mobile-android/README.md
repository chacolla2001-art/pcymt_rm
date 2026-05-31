# 📱 Android App - Kotlin + ARCore + Jetpack Compose

Aplicación móvil de realidad aumentada para visualización de modelos 3D en el mundo real.

---

## 📑 Índice

- [**Capítulo 1: Configuración Rápida**](#capítulo-1-configuración-rápida) ⚡
- [Capítulo 2: Estructura del Proyecto](#capítulo-2-estructura-del-proyecto)
- [Capítulo 3: Arquitectura MVVM](#capítulo-3-arquitectura-mvvm)
- [Capítulo 4: ARCore Integration](#capítulo-4-arcore-integration)
- [Capítulo 5: Autenticación](#capítulo-5-autenticación)
- [Capítulo 6: Permisos y Configuración](#capítulo-6-permisos-y-configuración)
- [Capítulo 7: Compilación](#capítulo-7-compilación)
- [Capítulo 8: Firma de APK](#capítulo-8-firma-de-apk)
- [Capítulo 9: Pruebas](#capítulo-9-pruebas)

---

## Capítulo 1: Configuración Rápida

🔐 **Credenciales de Acceso Administrador (configuradas en backend):**
```
Email:    chacolla43@gmail.com
Password: Cybercenter1
Rol:      admin
```

---

### Requisitos
- Android Studio Ladybug o superior
- JDK 17+
- Android SDK 35
- Dispositivo físico compatible con ARCore

### Pasos

**1. Abrir proyecto en Android Studio**
```bash
# Abrir la carpeta apps/mobile-android en Android Studio
```

**2. Configurar variables de entorno**
```bash
cp local.properties.example local.properties
```

Editar `local.properties`:
- `sdk.dir` - Ruta del Android SDK
- `BASE_URL` - URL del backend API
- `WEB_CLIENT_ID` - Google OAuth Client ID

💡 **Nota:** En `.example` las líneas con `##!` indican valores que hay que descomentar (quitar `##!`) para producción.

🔄 **Para cambiar a producción:**
1. Comentar variables de desarrollo (agregar `#`)
2. Descomentar variables de producción (quitar `##!`)
3. Crear `key.properties` con keystore de release
4. Compilar con `./gradlew assembleRelease`

**3. Descargar dependencias**
```bash
./gradlew build
```

**4. Conectar dispositivo físico**
- Habilitar "Opciones de desarrollador"
- Activar "Depuración USB"
- Conectar vía USB

**5. Ejecutar aplicación**
```bash
./gradlew installDebug
```

O presionar ▶️ **Run** en Android Studio

✅ **App instalada en el dispositivo**

---

## Capítulo 2: Estructura del Proyecto

```
apps/mobile-android/
├── app/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/univalle/pedrochacolla/
│   │   │   │   ├── data/              # Capa de datos
│   │   │   │   │   ├── local/           # Base de datos local
│   │   │   │   │   ├── remote/          # API REST
│   │   │   │   │   └── repository/      # Repositorios
│   │   │   │   ├── domain/            # Lógica de negocio
│   │   │   │   │   ├── model/           # Modelos de dominio
│   │   │   │   │   └── usecase/         # Casos de uso
│   │   │   │   ├── ui/                # Capa de presentación
│   │   │   │   │   ├── screens/         # Pantallas
│   │   │   │   │   ├── components/      # Componentes UI
│   │   │   │   │   └── viewmodel/       # ViewModels
│   │   │   │   ├── di/                # Dependency Injection
│   │   │   │   ├── utils/             # Utilidades
│   │   │   │   └── PCymtRMApplication.kt
│   │   │   ├── res/                   # Recursos
│   │   │   │   ├── layout/              # Layouts XML
│   │   │   │   ├── values/              # Strings, colors
│   │   │   │   └── drawable/            # Imágenes
│   │   │   └── AndroidManifest.xml    # Manifiesto
│   │   └── build.gradle.kts           # Configuración Gradle
│   └── proguard-rules.pro             # Reglas de ofuscación
└── gradle/                            # Dependencias centralizadas
```

**Arquitectura:** Clean Architecture + MVVM

---

## Capítulo 3: Arquitectura MVVM

### Data Layer
Maneja datos de API y base de datos local.

**Componentes:**
- **ApiClient** - Cliente Retrofit
- **Database** - Room Database
- **Repository** - Capa de abstracción

```kotlin
// Ejemplo: AnimalRepository
class AnimalRepository @Inject constructor(
    private val apiService: ApiService,
    private val animalDao: AnimalDao
) {
    suspend fun getAnimals(): List<Animal> {
        // Lógica de caché + API
    }
}
```

### Domain Layer
Contiene lógica de negocio pura.

```kotlin
// Ejemplo: GetAnimalsUseCase
class GetAnimalsUseCase @Inject constructor(
    private val repository: AnimalRepository
) {
    suspend operator fun invoke(): Result<List<Animal>> {
        return repository.getAnimals()
    }
}
```

### Presentation Layer
UI con Jetpack Compose + ViewModels.

```kotlin
@HiltViewModel
class AnimalListViewModel @Inject constructor(
    private val getAnimalsUseCase: GetAnimalsUseCase
) : ViewModel() {
    val animals = MutableStateFlow<List<Animal>>(emptyList())
    
    fun loadAnimals() {
        viewModelScope.launch {
            animals.value = getAnimalsUseCase()
        }
    }
}
```

### Dependency Injection
Hilt para inyección de dependencias.

```kotlin
@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {
    @Provides
    fun provideApiService(): ApiService {
        // Configuración
    }
}
```

---

## Capítulo 4: ARCore Integration

### Requisitos del Dispositivo

**ARCore compatible:**
- Android 7.0+ (API 24+)
- Giroscopio y acelerómetro
- Cámara con enfoque automático

**Verificar compatibilidad:**
https://developers.google.com/ar/devices

### Implementación

**Dependencias:**
```gradle
implementation("com.google.ar:core:1.40.0")
implementation("io.github.sceneview:arsceneview:2.0.0")
```

**Pantalla de AR:**
```kotlin
@Composable
fun ARScreen() {
    ARScene(
        modifier = Modifier.fillMaxSize(),
        nodes = listOf(animalNode),
        planeRenderer = true,
        onCreate = { arSceneView ->
            // Configuración inicial
        },
        onSessionCreate = { session ->
            // Sesión ARCore
        }
    )
}
```

### Colocar Modelos 3D

```kotlin
// Añadir modelo en el espacio AR
val modelNode = ModelNode(
    modelInstance = loadModel("models/lion.glb"),
    position = Position(x = 0f, y = 0f, z = -2f)
)
arSceneView.addChild(modelNode)
```

### Detección de Planos

```kotlin
session.getAllTrackables(Plane::class.java).forEach { plane ->
    if (plane.trackingState == TrackingState.TRACKING) {
        // Plano detectado, permitir colocar modelo
    }
}
```

---

## Capítulo 5: Autenticación

### Google Sign-In

**1. Configurar OAuth 2.0**
- Console: https://console.cloud.google.com
- Crear OAuth Client ID para Android
- Agregar SHA-1 fingerprint (ver abajo)

**2. Obtener SHA-1**
```bash
# Debug keystore
./gradlew signingReport

# O manualmente:
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

**3. Configurar en `local.properties`**
```properties
WEB_CLIENT_ID=tu-client-id.apps.googleusercontent.com
```

**4. Implementación**
```kotlin
val launcher = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.StartActivityForResult()
) { result ->
    // Handle Google Sign In result
}

GoogleSignInButton(onClick = {
    val signInIntent = googleSignInClient.signInIntent
    launcher.launch(signInIntent)
})
```

### JWT Storage

Tokens almacenados en `EncryptedSharedPreferences`:

```kotlin
val sharedPreferences = EncryptedSharedPreferences.create(
    context,
    "secure_prefs",
    masterKey,
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
)
```

---

## Capítulo 6: Permisos y Configuración

### Permisos Necesarios

**AndroidManifest.xml:**
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-feature android:name="android.hardware.camera.ar" android:required="true" />
```

### ARCore Required

```xml
<meta-data android:name="com.google.ar.core" android:value="required" />
```

### Solicitar Permisos en Runtime

```kotlin
val cameraPermission = rememberPermissionState(Manifest.permission.CAMERA)

LaunchedEffect(Unit) {
    if (!cameraPermission.status.isGranted) {
        cameraPermission.launchPermissionRequest()
    }
}
```

---

## Capítulo 7: Compilación

### Debug Build

```bash
# Compilar APK debug
./gradlew assembleDebug

# Instalar en dispositivo
./gradlew installDebug

# Compilar y ejecutar
./gradlew installDebug && adb shell am start -n com.univalle.pedrochacolla/.MainActivity
```

**APK generado en:**
`app/build/outputs/apk/debug/app-debug.apk`

### Release Build

```bash
# Compilar APK release (requiere firma)
./gradlew assembleRelease

# Generar Bundle (recomendado para Play Store)
./gradlew bundleRelease
```

**Archivos generados:**
- APK: `app/build/outputs/apk/release/app-release.apk`
- Bundle: `app/build/outputs/bundle/release/app-release.aab`

### Build Variants

```bash
./gradlew tasks --all        # Ver todas las tareas
./gradlew clean              # Limpiar build
./gradlew build              # Build completo (debug + release)
```

---

## Capítulo 8: Firma de APK

### Generar Keystore

```bash
keytool -genkey -v -keystore pcymt-release.keystore \
  -alias pcymt-key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

**Guardar en:** `keystore/pcymt-release.keystore`

### Configurar Signing

**Crear `key.properties`:**
```properties
storeFile=keystore/pcymt-release.keystore
storePassword=TU_STORE_PASSWORD
keyAlias=pcymt-key
keyPassword=TU_KEY_PASSWORD
```

**⚠️ IMPORTANTE:** Agregar `key.properties` a `.gitignore`

### Build Firmado

```bash
# El build release automáticamente usa la firma configurada
./gradlew assembleRelease
```

### Verificar Firma

```bash
# Ver información del APK firmado
keytool -printcert -jarfile app/build/outputs/apk/release/app-release.apk

# Verificar SHA-1 (para Google OAuth)
keytool -list -v -keystore keystore/pcymt-release.keystore -alias pcymt-key
```

---

## Capítulo 9: Pruebas

### Pruebas Unitarias

```bash
# Ejecutar pruebas unitarias
./gradlew test

# Con reporte
./gradlew testDebugUnitTest --tests "*"
```

**Estructura:**
```
app/src/test/
└── java/com/univalle/pedrochacolla/
    ├── viewmodel/
    │   └── AnimalViewModelTest.kt
    ├── repository/
    │   └── AnimalRepositoryTest.kt
    └── usecase/
        └── GetAnimalsUseCaseTest.kt
```

**Ejemplo:**
```kotlin
@Test
fun `test load animals success`() = runTest {
    // Given
    val animals = listOf(Animal(id = 1, name = "Lion"))
    coEvery { repository.getAnimals() } returns animals
    
    // When
    viewModel.loadAnimals()
    
    // Then
    assertEquals(animals, viewModel.animals.value)
}
```

### Pruebas Instrumentadas

```bash
# Ejecutar en dispositivo conectado
./gradlew connectedAndroidTest
```

**Estructura:**
```
app/src/androidTest/
└── java/com/univalle/pedrochacolla/
    └── ui/
        └── LoginScreenTest.kt
```

### Pruebas de UI (Compose)

```kotlin
@Test
fun testLoginButtonDisplayed() {
    composeTestRule.setContent {
        LoginScreen()
    }
    
    composeTestRule
        .onNodeWithText("Login")
        .assertIsDisplayed()
}
```

---

## 📚 Recursos Adicionales

- **[ARCore Documentation](https://developers.google.com/ar)** - Docs oficiales de ARCore
- **[Jetpack Compose](https://developer.android.com/jetpack/compose)** - UI moderna de Android
- **[Kotlin Documentation](https://kotlinlang.org/)** - Lenguaje Kotlin
- **[README Principal](../README.md)** - Documentación del proyecto completo
- **[Backend README](../backend/README.md)** - API documentation

---

## 🆘 Soporte

¿Problemas? Verifica:
1. `local.properties` configurado correctamente
2. Dispositivo físico con ARCore compatible
3. Permisos de cámara otorgados
4. Backend API accesible desde el dispositivo

**Errores comunes:**
- `ARCore not supported` → Dispositivo no compatible
- `Camera permission denied` → Otorgar permisos
- `Connection refused` → Verificar `BASE_URL` y red
- `Google Sign-In failed` → Verificar SHA-1 en Google Cloud Console

---

**Versión:** 1.0.0  
**Última actualización:** Febrero 2026
