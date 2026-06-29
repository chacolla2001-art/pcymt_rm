# AR_MIXTA_CONTEXTO.md — Realidad Mixta en PCyMT RM

> **Propósito:** Documento de contexto técnico profundo sobre el sistema de Realidad Mixta (Cloud Anchors + SceneView 2.3) de la app `apps/mobile-android`, incluyendo diagnóstico y fix del bug de escala.

---

## 1. Arquitectura General del Sistema AR

```
┌──────────────────────────────────────────────────────────────┐
│                        ARFragment                            │
│                                                              │
│  ArSceneManager   ←→   AnchorManager   ←→  FabMenuController│
│       │                     │                               │
│   ARSceneView           CloudAnchorNode                     │
│   (SceneView)           ModelNode                           │
│       │                     │                               │
│   ARCore Session    ←→  Google Cloud Anchors                │
└──────────────────┬───────────────────────────────────────────┘
                   │ Retrofit
                   ▼
         Backend API  (/api/anchor-points)
                   │ PostgreSQL
                   ▼
         locations table (scale, rotation_y, anchor_code, spatial_data)
```

### Dos librerías SceneView 2.3.0

| Librería | Módulo Gradle | Rol en el proyecto |
|----------|--------------|-------------------|
| **`io.github.sceneview:sceneview`** | Base 3D rendering + Filament engine | Carga de modelos GLB/GLTF, nodos 3D, sistema de transformaciones (scale/rotation/position), motor de renderizado Filament |
| **`io.github.sceneview:arsceneview`** | ARCore integration | `ARSceneView`, `CloudAnchorNode`, detección de planos, sesión ARCore, resolución de cloud anchors, camera feed |

**`sceneview`** es la base: `ModelNode`, `Node`, `ModelLoader`, `ModelInstance`, `Scale`, `Rotation`, `Position`.  
**`arsceneview`** extiende sceneview añadiendo `ARSceneView` (vista principal), `AnchorNode`, `CloudAnchorNode`, y gestión de la sesión ARCore.

---

## 2. Concepto de Cloud Anchors (Realidad Mixta)

Un **Cloud Anchor** es un punto espacial en el mundo real que ARCore puede reconocer desde distintos dispositivos.

```
ADMIN (coloca)                    GOOGLE CLOUD               VISITANTE (resuelve)
──────────────                    ────────────               ─────────────────────
1. Detecta planos                                            
2. Toca superficie     ──────────►  guarda snapshot        
3. ARCore crea ancla                del entorno visual      
4. hostToCloud()       ──────────►  ID único generado       4. Busca anclas (anchorCode)
5. Guarda en backend                                         5. Cámara apunta zona
   (anchorCode + scale + rotY)                               6. ARCore compara visuals
                                                             7. ◄─────────── Resuelve pose
                                                             8. Coloca ModelNode
                                                                con scale+rotY del backend
```

Las coordenadas GPS **no** posicionan el modelo — solo sirven para mostrarlos en el mapa del parque. La **pose exacta** viene del matching visual de ARCore.

---

## 3. Flujo Completo — Admin Coloca un Ancla

### Máquina de Estados (`ArUiState`)

```
Idle
  │  [btn "Colocar ancla"]
  ▼
WaitingForAnchorPlacement
  │  [toca superficie plana]
  ▼
EditingAnchor  ◄────── volver (btn ←)
  │  - FABs scale ±10% / rotate ±15°
  │  - VPS 360° scan en progreso
  │  - Animal picker
  │  [btn "Subir ancla"]
  ├── VPS readiness < 0.5 ──────► CapturingQuality
  │                                  │ [btn "Subir ancla" de nuevo]
  │  ◄────────────────────────────────┘
  ▼
Loading ("Guardando ubicación...")
  │
  ▼
AnchorHostingSuccess → Idle
```

### Paso a paso en código

1. **`ArFragment.handleWaitingForPlacement()`**  
   → `AnchorManager.enableAnchorPlacementMode()`  
   → Registra `sceneView.setOnTouchListener` que hace `frame.hitTest(x, y)` contra planos detectados.

2. **Toque en superficie**  
   → `hit.createAnchor()` — crea ancla ARCore local  
   → `AnchorManager.placeAnchorWithModel(anchor, modelLoader)`  
   → `CloudAnchorNode(engine, anchor)` + carga `models/cube.glb` con **`scaleToUnits = 0.5f`**  
   → `AnchorManager.onAnchorPlaced` → `ArViewModel.onAnchorPlacedInScene()` → estado `EditingAnchor`

3. **Admin edita (EditingAnchor)**  
   - `fabScaleUp` → `AnchorManager.scaleUp(1.1f)` → `node.scale *= 1.1f` + `currentScaleToUnits *= 1.1f`  
   - `fabScaleDown` → `AnchorManager.scaleDown(0.9f)` → idem ×0.9  
   - `fabRotateLeft/Right` → modifica `node.rotation.y ±15°`  
   - `btnSelectAnimal` → carga animal GLB, reemplaza cubo con `AnchorManager.replaceModel()`  
   - VPS scan: `onSessionUpdated → anchorManager.updateVpsScan()` — cada frame alimenta `SpatialMapper`

4. **Admin toca "Subir ancla"** → `ArFragment.handleUploadAnchor()`  
   - Si `AnchorManager.isVpsReadyForHosting()` (readiness ≥ 0.5 + cobertura angular ≥ 5 sectores):  
     → `AnchorManager.lockForHosting()` + `AnchorManager.hostToCloud()`  
     → `CloudAnchorNode.host(session, ttlDays) { id, state → ... }`  
     → En `SUCCESS`: callback `onAnchorHosted(cloudAnchorId, spatialData)`

5. **`ArFragment.handleAnchorHosted(cloudAnchorId, spatialData)`**  
   - Obtiene GPS con `fusedLocationClient.lastLocation`  
   - `anchorManager.getModelTransform()` → devuelve `(currentScaleToUnits, rotationY)`  
   - `ArViewModel.onAnchorHostedToCloud(cloudAnchorId, virtualAssetId, lat, lng, **scale**, **rotY**, spatialData)`  
   - `LocationRepository.createLocation(location)` → `POST /api/anchor-points`

6. **Backend guarda en `locations`:**
   ```json
   {
     "anchor_code": "ua-1234567890abcdef",
     "scale": 0.97,
     "rotation_y": 45.0,
     "latitude": -16.488,
     "longitude": -68.145,
     "virtual_asset_id": "uuid-del-oso-andino",
     "spatial_data": { ... }
   }
   ```

---

## 4. Flujo Completo — Visitante Escanea y Encuentra un Ancla

### Paso a paso en código

1. **App abre `ArFragment`** (visitante)  
   → `isAdmin = false` → `viewModel.loadRemoteAnchors()` inmediatamente (sin estado Idle)

2. **`ArViewModel.loadRemoteAnchors()`**  
   → `RemoteAnchorResolver.loadAndResolveAnchors(userId)`:  
   - 3 llamadas API (no N+1):  
     1. `GET /api/anchor-points/active` → lista de `Location`  
     2. `GET /api/user-interactions?userId=...` → IDs ya interactuados  
     3. `GET /api/virtual-assets` → todos los assets  
   - Filtra: solo locations con `anchor_code != null`  
   - Une cada `Location` con su `VirtualAsset` en memoria  
   - Devuelve `List<ResolvedAnchor>` → estado `AnchorsLoaded`

3. **`ArFragment.handleAnchorsLoaded(anchors)`** → `resolveAnchorsInScene(anchors)`

4. **Para cada ancla** con `anchorCode`:
   ```kotlin
   CloudAnchorNode.resolve(engine, session, anchorCode) { state, node ->
       if (!state.isError && node != null) {
           lifecycleScope.launch {
               val modelNode = loadModelForAnchor(resolved)  // carga modelo 3D
               node.addChildNode(modelNode)       // NO resetea transforms (verificado del source)
               sceneView.addChildNode(node)
               modelNode.rotation = Rotation(y = targetRotY)
           }
       }
   }
   ```
   ARCore trabaja en background comparando frames de cámara con el snapshot del cloud anchor.

5. **`loadModelForAnchor(resolved)`**  
   - `scale = resolved.location.scale` (del backend, guardado por el admin)  
   - `rotY = resolved.location.rotationY`  
   - `ModelResolver.resolve(context, asset.modelUrl)` → local (`assets/models/`) o remoto  
   - Si remoto: descarga con `OkHttp` autenticado → `ByteBuffer` directo → `modelLoader.createModelInstance(buffer)`  
   - `createModelNodeWithTransforms(modelInstance, scale, rotY, name)`:  
     ```kotlin
     ModelNode(
         modelInstance = modelInstance,
         autoAnimate = true,
         scaleToUnits = scale,              // ← tamaño en metros (del admin)
         centerOrigin = Position(y = -0.5f) // offset fijo (ver §6 para detalle)
     )
     ```

6. **VPS Refinement (opcional)**: Si hay `spatialData`, `SpatialMapper.matchEnvironment()` produce una pose más precisa y el modelo se re-adjunta a un `AnchorNode` más exacto (necesita el scale fix también — ver §6).

7. **Visitante toca modelo** → `nodeAnchorMap[node]` → `handleModelTapped(resolved)` → `AnimalEncounterBottomSheet` con nombre, nombre científico, hábitat, foto.

8. **Registro de interacción**: `ArViewModel.recordInteraction(locationId, virtualAssetId)` → `POST /api/user-interactions` (type: "view").

---

## 5. Sistema de Escala — Explicación Completa

### `scaleToUnits` vs `node.scale`

`scaleToUnits` es un **parámetro del constructor** de `ModelNode` en SceneView 2.3. Indica "ajusta este modelo para que quepa en N metros". SceneView internamente hace:

```
node.scale = scaleToUnits / max(model.boundingBox.extent)
```

Por ejemplo, si `bear.glb` tiene un bounding box de **2m** de altura y `scaleToUnits = 0.97f`:
```
node.scale.x = 0.97 / 2.0 = 0.485
node.scale.y = 0.97 / 2.0 = 0.485   (tamaño visual = 0.485 × 2m = 0.97m ✓)
node.scale.z = 0.97 / 2.0 = 0.485
```

### `currentScaleToUnits` en AnchorManager

`AnchorManager.currentScaleToUnits` **siempre rastr ea el tamaño visual en metros**, no el factor interno de SceneView. Esto hace que `getModelTransform()` devuelva siempre un valor correcto para persistir:

```kotlin
var currentScaleToUnits: Float = 0.5f  // DEFAULT_SCALE_TO_UNITS

// scaleUp/Down actualiza ambos de forma consistente:
fun scaleUp(factor: Float) {
    modelNode.scale = modelNode.scale.times(factor)     // factor visual del nodo
    currentScaleToUnits *= factor                       // tamaño absoluto en metros
}

// getModelTransform devuelve currentScaleToUnits (no node.scale.x)
fun getModelTransform(): Pair<Float, Float> = Pair(currentScaleToUnits, rotY)
```

### Flujo completo de escala Admin → Backend → Visitante

```
Admin elige 1.0m de tamaño:
  currentScaleToUnits = 1.0f
       │
       ▼
Backend guarda: scale = 1.0
       │
       ▼
Visitante resuelve:
  ModelNode(scaleToUnits = 1.0f)     ← misma escala visual
  node.scale = 1.0 / bearBbox = 0.5  ← factor interno correcto
  visual size = 0.5 × 2m = 1.0m ✓
```

---

## 6. Bug de Escala — Diagnóstico y Fix

### Bug 1 (v1): Desincronización de `currentScaleToUnits`

**Síntoma inicial (ya resuelto):** El admin escalaba el cubo, seleccionaba un animal, y la escala reportada por `getModelTransform()` no coincidía con la visual real porque `currentScaleToUnits` no derivaba de las propiedades reales del nodo.

**Fix aplicado:** Se implementaron `deriveScaleToUnits()` y `syncScaleFromNode()` en `AnchorManager` para recalcular el tamaño visual _real_ a partir de `node.scale` y `node.halfExtent`. Esto garantiza que `currentScaleToUnits` refleje siempre el tamaño visual correcto, independientemente de cambios de modelo (cubo → animal con diferente bounding box).

### Bug 2 (v2): Offset cuadrático de `centerOrigin` — CAUSA RAÍZ

**Síntoma**: El admin coloca un modelo con cierto tamaño (ej. 5.0m). Al escanear, el modelo aparece a un tamaño visualmente **incorrecto** — parcialmente enterrado bajo la superficie. El error **aumenta con la escala**: a escalas pequeñas (≤0.5) es imperceptible, pero a escalas grandes es catastrófico.

### La función `centerOrigin` de SceneView 2.3

Internamente en `ModelNode.kt` (SceneView 2.3.0, líneas 232-233):

```kotlin
fun centerOrigin(origin: Position) {
    position += origin * size
}
```

Donde `size` es la dimensión **escalada** del modelo:

```kotlin
val halfExtent get() = boundingBox.halfExtent.let { v -> Float3(v[0], v[1], v[2]) }  // UNSCALED (model-space)
val extents get() = halfExtent * 2.0f                                                 // UNSCALED
val size get() = extents * scale                                                       // SCALED (proporcional a scaleToUnits)
```

**Dato clave:** `halfExtent` es el bounding box en espacio del modelo (NO escalado). `size` SÍ incluye el `node.scale` derivado de `scaleToUnits`.

### El bug en el código original

En `loadAnimalModel()` (admin) y `createModelNodeWithTransforms()` (visitante):

```kotlin
// ❌ BUG: centerOrigin depende de la escala
ModelNode(
    modelInstance = modelInstance,
    scaleToUnits = scale,
    centerOrigin = Position(y = -scale / 2f)   // ← origin PROPORCIONAL a la escala
)
```

`centerOrigin` **multiplica** `origin × size`. Como `size ∝ scaleToUnits`, el offset resultante es:

```
offset_y = (-scale / 2) × size_y ≈ (-scale / 2) × scale = -scale² / 2
```

**El offset crece con el CUADRADO de la escala** (cuadrático), no linealmente:

| scaleToUnits | origin.y | size.y ≈ | offset_y (posición) | Efecto visual |
|:---:|:---:|:---:|:---:|:---|
| 0.5 | -0.25 | 0.5 | **-0.125m** | Imperceptible |
| 1.0 | -0.50 | 1.0 | **-0.50m** | Modelo 50cm bajo tierra |
| 2.0 | -1.00 | 2.0 | **-2.0m** | Modelo enterrado 2m |
| 5.0 | -2.50 | 5.0 | **-12.5m** | Modelo 12m bajo tierra |
| 10.0 | -5.00 | 10.0 | **-50.0m** | Catastrófico |

A escala 5.0, el modelo se hunde **12.5 metros** bajo la superficie del ancla — el usuario solo ve la porción superior del modelo asomando (si acaso), dando la impresión de que "el tamaño no es el que puse".

**Comparación con el cubo placeholder** que SÍ funcionaba correctamente:

```kotlin
// ✅ El cubo usa un valor FIJO
sceneManager.loadModelNode(
    modelPath = "models/cube.glb",
    scaleToUnits = 0.5f,
    centerOffset = -0.5f     // ← CONSTANTE, no depende de la escala
)
```

### El fix aplicado (1 archivo, 2 cambios)

#### `ArFragment.kt` — `loadAnimalModel()` (admin carga modelo animal)

```kotlin
// ✅ FIX: centerOrigin con valor FIJO (igual que el cubo placeholder)
return ModelNode(
    modelInstance = modelInstance,
    autoAnimate = true,
    scaleToUnits = currentScale,
    centerOrigin = Position(y = -0.5f)   // ← Constante, offset lineal en vez de cuadrático
)
```

#### `ArFragment.kt` — `createModelNodeWithTransforms()` (visitante resuelve ancla)

```kotlin
// ✅ FIX: centerOrigin con valor FIJO
val node = ModelNode(
    modelInstance = modelInstance,
    autoAnimate = true,
    scaleToUnits = scale,
    centerOrigin = Position(y = -0.5f)   // ← Constante
)
```

Con `centerOrigin = Position(y = -0.5f)`, el offset es ahora **lineal**:

```
offset_y = -0.5 × size_y ≈ -0.5 × scale
```

| scaleToUnits | origin.y | size.y ≈ | offset_y | Efecto visual |
|:---:|:---:|:---:|:---:|:---|
| 0.5 | -0.5 | 0.5 | **-0.25m** | Correcto |
| 5.0 | -0.5 | 5.0 | **-2.5m** | Correcto (top al nivel del ancla) |
| 10.0 | -0.5 | 10.0 | **-5.0m** | Correcto |

### Aclaración: `addChildNode()` NO resetea transforms

Verificado directamente del código fuente de SceneView 2.3.0 (`Node.kt`):

```kotlin
// Node.kt — addChildNode es simplemente:
fun addChildNode(node: Node) { childNodes += node }

// El setter de childNodes asigna parent, y la documentación del setter de parent dice:
// "The local position, rotation, and scale of this node will remain the same."
```

**`addChildNode()` NO resetea `node.scale` a `Scale(1,1,1)`.** La hipótesis anterior (Bug 1 v1) sobre el reset de escala en `addChildNode` era incorrecta. El patrón `preservedScale` que se documentó previamente era innecesario (no-op). La causa real del problema visual a escalas grandes era el offset cuadrático de `centerOrigin`.

---

## 7. Modelos 3D — Estructura y Carga

### Archivos GLB en el sistema

| Archivo | Animal | Dónde reside |
|---------|--------|-------------|
| `bear.glb` | Oso Andino | `uploads/map-models/` |
| `cattle.glb` | Toro | `uploads/map-models/` |
| `chicken.glb` | Gallina | `uploads/map-models/` |
| `cow.glb` | Vaca Lechera | `uploads/map-models/` |
| `dog.glb` | Perro Criollo | `uploads/map-models/` |
| `horse.glb` | Caballo | `uploads/map-models/` |
| `leopard.glb` | Jaguar | `uploads/map-models/` |
| `lizard.glb` | Lagarto Tegu | `uploads/map-models/` |
| `mermaid.glb` | Sirena | `uploads/map-models/` |
| `pig.glb` | Chancho | `uploads/map-models/` |
| `tiger.glb` | Puma | `uploads/map-models/` |
| `viper.glb` | Víbora | `uploads/map-models/` |
| `cube.glb` | Cubo placeholder admin | `app/src/main/assets/models/` |

### `ModelResolver` — Local vs Remoto

```
ModelResolver.resolve(context, modelUrl)
    │
    ├── modelUrl == null  → ModelResolution.Local("models/cube.glb")
    ├── modelUrl contiene nombre del archivo que existe en assets/models/
    │       → ModelResolution.Local("models/bear.glb")
    └── modelUrl es URL/ruta remota
            → ModelResolution.Remote(url)
```

**Local**: `sceneView.modelLoader.loadModelInstance("models/bear.glb")` — instantáneo, incluido en APK.  
**Remote**: Descarga con `OkHttp` autenticado (`AuthInterceptor` inyecta Bearer token), crea `ByteBuffer` directo (requerido por Filament), luego `modelLoader.createModelInstance(buffer)`.

### Animaciones

`ModelNode(autoAnimate = true)` — SceneView reproduce automáticamente la primera animación disponible en el GLB. Esto funciona tanto en colocación como en resolución.

---

## 8. Backend — API de Anchor Points

### Endpoint: `POST /api/anchor-points` (crear)
```json
Request body:
{
  "anchor_code": "ua-...",
  "virtual_asset_id": "uuid",
  "latitude": -16.488,
  "longitude": -68.145,
  "scale": 0.97,
  "rotation_y": 45.0,
  "spatial_data": { ... },
  "is_active": true
}
```

### Endpoint: `GET /api/anchor-points/active` (leer)
Respuesta incluye `scale` y `rotation_y` para cada anchor. La app móvil usa estos valores en `loadModelForAnchor()`.

### Campo `scale` en BD
- Tipo: `FLOAT`, default `1.0`, validación `min: 0.01` (sin máximo)  
- Representa: tamaño en **metros** del modelo (valor `scaleToUnits` de SceneView)  
- **No** es el factor interno `node.scale` de Filament/SceneView

### Normalización camelCase ↔ snake_case
`AnchorPointService.normalizeData()` mapea `rotationY → rotation_y`, `virtualAssetId → virtual_asset_id`, etc. El móvil puede enviar camelCase (Gson con `@SerializedName`) y el backend lo normaliza.

---

## 9. `ArSimpleFragment` — Estado Actual

`ArSimpleFragment` es actualmente un **placeholder vacío** (placeholder stub). La funcionalidad de AR Simple (Camera2 + SceneView sin ARCore) fue eliminada/deshabilitada. El fragmento solo muestra un botón "Volver". Si se reactiva, consistiría en:
- `Camera2` API para el preview de cámara como fondo
- `SceneView` (sin ARCore) para modelos 3D flotantes sobre la cámara
- Sin cloud anchors — los modelos se posicionan por carousel/GPS

---

## 10. `SpatialData` — VPS (Virtual Point Space Map)

Cuando el admin coloca un ancla, `SpatialMapper` captura:

| Campo | Descripción |
|-------|-------------|
| `anchor_pose` | Pose del ancla relativa al plano dominante (matriz 4×4) |
| `plane_equation` | Ecuación del plano de superficie (nx, ny, nz, d) |
| `plane_type` | HORIZONTAL_UPWARD / HORIZONTAL_DOWNWARD / VERTICAL |
| `plane_boundary` | Polígono del plano en coordenadas locales |
| `feature_points` | Puntos de característica ARCore cercanos al ancla (x,y,z,confidence) |
| `compass_heading` | Orientación magnética al momento de colocación |
| `gps_accuracy` | Precisión GPS en metros |

En resolución, `SpatialMapper.matchEnvironment()` compara estos datos con el entorno actual. Si la confianza es ≥ 0.5, crea un `AnchorNode` más preciso (VPS refinement).

---

## 11. `ArDeviceCompatibility` — Dos Modos

```
App abre ArFragment
     │
     ├── ArDeviceCompatibility.check(context)
     │       │
     │       ├── ARCore instalado + dispositivo en allowlist
     │       │       → ArFragment (Cloud Anchors, plena RM)
     │       │
     │       └── No compatible
     │               → ArUnsupportedFragment (mensaje informativo)
     │
     └── (ArSimpleFragment desactivado actualmente)
```

Allowlist curada: Samsung Galaxy S/A/Z series, Pixel 4+, OnePlus 8+, Xiaomi 12+, etc.

---

## 12. Checklist para Depurar Problemas de Escala

Si el tamaño del modelo en resolución no coincide con el guardado por el admin:

- [ ] Verificar que `location.scale` en el backend sea > 0 y razonable
- [ ] Revisar logs: `Timber.i("loadModelForAnchor: '%s' scale=%.3f")` — ¿coincide con lo guardado?
- [ ] Verificar que `centerOrigin` usa un valor **fijo** (`Position(y = -0.5f)`), NO dependiente de la escala
- [ ] Confirmar que el modelo GLB usado en resolución es el mismo que en colocación (mismo bounding box)
- [ ] Si `ModelResolver` usa ruta local en un caso y remota en el otro, los bounding boxes serían idénticos pero verificar
- [ ] En `ArPerformanceManager.getRecommendedScale()`: solo afecta al cubo inicial en `loadDefaultModel()`, no al modelo del animal (no se llama en `loadAnimalModel` ni en `createModelNodeWithTransforms`)
- [ ] Recordar: `addChildNode()` **NO** resetea transforms — verificado del source de SceneView 2.3
- [ ] `halfExtent` es **UNSCALED** (model-space), `size` es **SCALED** — `deriveScaleToUnits` es correcto
