# Cómo funciona subir un Anchor Point en Realidad Mixta (App Móvil)

## Resumen

Solo los usuarios con rol **admin** pueden subir anclas. El flujo crea un **Cloud Anchor** de ARCore (ancla persistente en la nube de Google) y luego guarda la ubicación en el backend propio del proyecto (`POST /api/anchor-points`).

---

## Máquina de estados del flujo

```
Estado 0: Idle
  │
  │ [Admin pulsa "Colocar ancla"]
  ▼
Estado 1a: WaitingForAnchorPlacement
  │  ARCore detecta planos → admin toca la superficie
  │
  │ [tap en plano]
  ▼
Estado 1b: EditingAnchor
  │  Admin ajusta escala/rotación + escanea 360° (VPS)
  │
  │ [Admin pulsa "Subir ancla"]
  │    ├── VPS insuficiente → Estado 2 (sigue escaneando)
  │    └── VPS OK (≥50% + ≥5 sectores cubiertos) → continúa
  │
  ▼
[Hosting] → Google Cloud ARCore API
  │  Devuelve cloudAnchorId
  │
  ▼
[GPS] → FusedLocationProviderClient
  │  Devuelve lat/lng del dispositivo
  │
  ▼
[Backend] → POST /api/anchor-points
  │  Guarda en tabla `locations` (BD PostgreSQL)
  │
  ▼
Estado AnchorHostingSuccess → regresa a Idle
```

---

## Paso a paso detallado

### 1. Activación (admin únicamente)

Al abrir el tab **AR** el sistema comprueba `UserSession.currentUser?.role == "admin"`.  
Si el usuario no es admin, el botón `btn_host_anchor` ("Colocar ancla") está oculto.

**Clase relevante:** `ArFragment.isAdmin`

---

### 2. Detección de planos y calidad superficial

Al pulsar **"Colocar ancla"** → `ArViewModel.startAnchorPlacementMode()` → estado `WaitingForAnchorPlacement`.

ARCore empieza a detectar planos horizontales. `ArSceneManager.configureScene()` arranca la sesión con:
- `showPlanes = true` (para admins)
- `enableCloudAnchors = true`

Por cada frame, `PlaneEnhancer.evaluatePlacement()` mide la calidad de la superficie y actualiza la barra de color:

| Color | Calidad | Acción sugerida |
|-------|---------|-----------------|
| 🔴 Rojo | < 40% | "Mueve lentamente sobre la superficie" |
| 🟡 Amarillo | 40–70% | "Escanea un poco más…" |
| 🟢 Verde | ≥ 70% | "Superficie estable — toca para colocar" |

**Clase relevante:** `AnchorManager.enableAnchorPlacementMode()`, `PlaneEnhancer`

---

### 3. Colocación del ancla (tap en la superficie)

Al tocar la pantalla, ARCore ejecuta `frame.hitTest(x, y)`:

1. **Hit primario:** plano detectado cuyo polígono contiene el punto tapado (`Plane.isPoseInPolygon`)
2. **Fallback:** cualquier plano → `InstantPlacementPoint` (si está habilitado)

Con el hit result se crea el `Anchor` de ARCore y se construye un `CloudAnchorNode` (contenedor en la escena SceneView). Se carga el modelo 3D por defecto (cubo) como indicador visual.

Inmediatamente después del placement, `SpatialMapper.startScanSession()` inicia la captura de datos VPS.

**Clases relevantes:** `AnchorManager.enableAnchorPlacementMode()`, `AnchorManager.placeAnchorWithModel()`

---

### 4. Ajuste del modelo + escaneo VPS 360° (Estado EditingAnchor)

El admin ve el modelo 3D en la escena real y puede ajustarlo con los botones FAB:

| Botón | Acción | Delta |
|-------|--------|-------|
| ＋ Escala | `scaleUp(1.25f)` | ×1.25 |
| − Escala | `scaleDown(0.8f)` | ×0.8 |
| ← Rotar | `rotateLeft(15°)` | −15° en eje Y |
| → Rotar | `rotateRight(15°)` | +15° en eje Y |

Simultáneamente, cada frame de la cámara alimenta `SpatialMapper.updateScan()` que acumula:
- **Feature points** (puntos 3D característicos del entorno)
- **Sectores angulares cubiertos** (la esfera se divide en 8 sectores de 45°; se necesitan ≥5 para un ancla estándar o ≥3 en modo pared)
- **Planos detectados** en el entorno

La barra de VPS muestra el progreso de `0%` a `100%` con colores:

| Color badge | Readiness | Significado |
|-------------|-----------|-------------|
| 🟢 "Listo ✓" | ≥ 80% | Puede subir |
| 🟡 "Aceptable" | 50–79% | Puede subir (umbral mínimo) |
| 🔴 "Insuficiente" | < 50% | Debe seguir escaneando |

**Modo pared (`switchWallMode`):** reduce el umbral angular de 5 a 3 sectores, útil para anclas en paredes o esquinas inaccesibles por todos los lados.

**Clases relevantes:** `AnchorManager.updateVpsScan()`, `SpatialMapper`, `AnchorManager.isVpsReadyForHosting()`

---

### 5. Subir el ancla (`handleUploadAnchor`)

Al pulsar **"Subir ancla"**:

**a) Comprobación de VPS:**
```kotlin
if (!anchorManager.isVpsReadyForHosting()) {
    viewModel.startQualityCapture(percent)  // → Estado 2: sigue escaneando
    return
}
```

Condición de aprobación: `readiness ≥ 0.5f && angularSectorsCovered ≥ 5` (o ≥3 en wall mode).

**b) Bloqueo del modelo** — se deshabilitan escala/rotación/posición para que no cambie mientras sube.

**c) Finalización del escaneo VPS** — `SpatialMapper.finalizeScan()` serializa todos los feature points, planos y viewpoints en un objeto `SpatialData` (guardado en `lastCapturedSpatialData`).

**d) Hosting a Google Cloud:**
```kotlin
cloudAnchorNode.host(session) { cloudAnchorId, state ->
    // Solo reacciona al estado final SUCCESS
    // Los estados intermedios (TASK_IN_PROGRESS, NONE) se ignoran
    if (state == CloudAnchorState.SUCCESS) {
        onAnchorHosted(cloudAnchorId, lastCapturedSpatialData)
    }
}
```

Google ARCore API recibe los feature points del entorno y devuelve un `cloudAnchorId` (string único, e.g. `"ua-abc123..."`).

**Clases relevantes:** `AnchorManager.hostToCloud()`, `AnchorManager.captureSpatialData()`

---

### 6. Obtención del GPS

Una vez que Google confirma el `cloudAnchorId`, el fragment pide la última ubicación GPS conocida:

```kotlin
fusedLocationClient.lastLocation.addOnSuccessListener { location ->
    // Sanitización: descarta NaN/Inf de GPS poco confiable
    val safeAccuracy = location.accuracy.takeIf { it.isFinite() && it >= 0f }
    val safeAltitude = location.altitude.takeIf { it.isFinite() }
    // Enriquece spatialData con lat/lng del GPS
    viewModel.onAnchorHostedToCloud(
        cloudAnchorId, virtualAssetId = null,
        latitude, longitude, scale, rotationY,
        enrichedSpatialData
    )
}
```

> ⚠️ El `virtualAssetId` queda en `null` — el admin debe asociar el animal después desde el **panel web** (`/anchor-points`).

---

### 7. Guardado en el backend

`ArViewModel.onAnchorHostedToCloud()` construye un objeto `Location` y llama:

```
POST /api/anchor-points
Authorization: Bearer <JWT>
{
  "name": "AR Anchor",
  "anchorCode": "ua-abc123...",   ← cloud anchor ID de Google
  "latitude": -16.4893,
  "longitude": -68.1457,
  "scale": 1.25,
  "rotationY": 45.0,
  "spatialData": { ... },         ← feature points + planos para VPS refinement
  "isActive": true
}
```

**Tabla destino:** `locations` (PostgreSQL)  
**Respuesta exitosa:** `{ success: true, data: { id: "uuid-...", ... } }`

---

### 8. Éxito

El ViewModel incrementa `hostedCount` y emite `ArUiState.AnchorHostingSuccess`.  
El fragment muestra el banner `"✓ 1 ancla(s) subida(s) correctamente"` y regresa al estado Idle.

---

## Datos guardados en la BD (`locations`)

| Campo | Origen | Ejemplo |
|-------|--------|---------|
| `id` | Auto UUID | `"3fa85f64-..."` |
| `anchor_code` | Google ARCore Cloud Anchor API | `"ua-abc123xyz"` |
| `latitude` | FusedLocationProviderClient (GPS) | `-16.489334` |
| `longitude` | FusedLocationProviderClient (GPS) | `-68.145739` |
| `scale` | FAB escala del admin | `1.25` |
| `rotation_y` | FAB rotación del admin | `45.0` |
| `virtual_asset_id` | **null** al subir — asignar luego desde web | `null → "uuid-..."` |
| `spatial_data` | SpatialMapper.finalizeScan() | `{ featurePoints: [...], planes: [...] }` |
| `section` | null al crear desde AR | asignar desde panel web |
| `is_active` | true | `true` |

---

## Componentes del código involucrados

```
ArFragment.kt                  ← Coordinador UI + estado
├── ArViewModel.kt             ← Lógica de negocio + StateFlow
├── ArSceneManager.kt          ← SceneView/ARCore session setup
├── AnchorManager.kt           ← Placement + transform + hosting
│   ├── SpatialMapper.kt       ← Captura VPS 360° (feature points)
│   └── PlaneEnhancer.kt       ← Evaluación de calidad del plano
└── LocationRepository.kt      ← POST /api/anchor-points (Retrofit)
```

---

## Flujo de resolución (visitantes)

El proceso inverso ocurre cuando un visitante pulsa **"Buscar anclas"**:

1. `GET /api/anchor-points?isActive=true` → lista de locations con `anchor_code`
2. Para cada `anchor_code` → `CloudAnchorNode.resolve(session, cloudAnchorId)`
3. Google ARCore busca feature points coincidentes en el entorno actual
4. Si encuentra coincidencia → devuelve la `Pose` 3D exacta donde fue colocada
5. Se carga el modelo GLB del `virtual_asset` asociado (`model_url`)
6. (Opcional) `SpatialMapper.matchEnvironment()` refina la posición con la `SpatialData` guardada
7. Se registra una interacción tipo `"view"` en `POST /api/user-interactions`

---

## Notas importantes

- **Requiere internet** durante el hosting y la resolución (Google Cloud Anchors API).
- **El ancla dura 24h** por defecto en los planes gratuitos de ARCore; en producción se necesita la API de Cloud Anchors v2 con persistencia ilimitada configurada en Google Cloud Console.
- **Un ancla sin `virtual_asset_id`** no mostrará ningún modelo 3D a los visitantes hasta que se asocie desde el panel web (`/anchor-points`).
- **GPS impreciso** en interiores puede desplazar la ubicación mostrada en el mapa 2D; el Cloud Anchor en sí usa feature points visuales (no GPS) para su posición real en el espacio.
- El **modo pared** reduce el escaneo requerido de 225° a 135° para anclas en superficies verticales o inaccesibles por la espalda.
