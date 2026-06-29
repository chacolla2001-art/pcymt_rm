# Estilo visual del mapa — Cartoon isométrico (tipo Carbot)

> **Propósito.** Este documento es la **fuente de verdad** del aspecto del mapa del
> parque (frontend web, `apps/web-admin`, feature `map`). Cualquier cambio en
> texturas de suelo, árboles o efectos ambientales debe respetar estas reglas
> para mantener una estética coherente: **cartoon plano, isométrico, con
> contorno, tipo Carbot** (las parodias de StarCraft de CarbotAnimations).
>
> Si el código y este documento difieren, **prioriza el código y actualiza este
> archivo**. Última actualización: Junio 2026.

---

## 1. Filosofía estética

El mapa NO busca realismo. Busca un **mundo de juego**: limpio, legible, alegre,
con piezas que parecen *sprites* dibujados a mano. Tres palabras guía:

1. **Plano** — colores sólidos, sin degradados fotorrealistas ni ruido de grano.
2. **Contorneado** — todo elemento "sólido" (árbol, gota, hoja, piedra) lleva un
   borde oscuro que lo separa del fondo.
3. **Exagerado** — formas redondeadas y simples; siluetas reconocibles a tamaño
   pequeño y a distancia.

---

## 2. Principios visuales (reglas duras)

| Regla | Detalle |
|---|---|
| **Dirección de luz** | Fija, desde **arriba-izquierda**. La luz/highlight va arriba-izquierda; la sombra abajo-derecha. Coherente en TODOS los elementos. |
| **Contorno (outline)** | Oscuro (casi negro, tinte del color base). Grosor proporcional al tamaño del elemento: `lineW ≈ tamaño * 0.04–0.06`. Nunca un negro puro plano si rompe la armonía: usar el tono `stroke`/`line` de la paleta. |
| **Cel-shading** | Máximo **2–3 tonos por elemento**: base + sombra + (opcional) luz. Nada de gradientes suaves multitono. |
| **Highlight especular** | Círculo blanco semitransparente (`alpha ≈ 0.5`) arriba-izquierda en copas y elementos redondeados. |
| **Formas** | Círculos, elipses, triángulos y curvas Bézier suaves. Evitar polígonos ruidosos o detalle fino innecesario. |
| **Saturación** | Colores vivos y definidos. Las zonas se distinguen por **tono**, no por textura. |
| **Determinismo** | Toda aleatoriedad usa `seededRand(seed)` para que el render sea **estable** entre frames (no debe "hervir"/parpadear). |
| **Proyección** | Pseudo-isométrica: sombras y bases son **elipses aplastadas** (factor vertical ~0.3–0.4), no círculos. |

---

## 3. Paletas por zona

Las paletas viven en código y son la referencia canónica. **No inventar colores
sueltos**; extender la paleta si hace falta.

### Suelo — `groundPaletteForSection()` / `parkBasePalette()` / `mapBackdropPalette()`
Campos: `base` (relleno), `accent` (parche/sombra), `speck` (piedra/flor),
`line` (contorno), `light` (luz).

| Zona | Tema claro `base` | Carácter |
|---|---|---|
| Tierras Altas (0) | `#D8B878` | tierra/arena/marrón seco |
| Tierras Medias (1) | `#7DBE3F` | verde saturado brillante |
| Tierras Bajas (2) | `#2E8B40` | verde selva intenso |
| Base parque (-1) | `#8FA86A` | gris-verdoso neutro |
| Fondo mapa (-2) | `#AEB8A6` | neutro fuera del parque |

### Árboles — `treePaletteForSection()`
Campos: `light`, `mid`, `dark` (3 tonos cel), `highlight`, `stroke` (contorno),
`trunk`, `trunkDark`. Acentos florales (no dependen de la zona) como constantes:
`BLOOM_JACARANDA` (violeta), `BLOOM_TOBOROCHI` (rosa), `PUYA_SPIKE` (crema).

Cada zona tiene **3 especies reales de Bolivia**; la `variant` (0/1/2) elige la
especie (ver §5). El color de copa lo da la paleta de zona.

| Zona | Copa (tono) | Especies (variant 0 / 1 / 2) |
|---|---|---|
| Tierras Altas (0) | verde frío de puna | **Queñua** / **Kiswara** / **Puya Raimondii** |
| Tierras Medias (1) | **verde lima** brillante | **Molle** / **Jacarandá** / **Tipa** |
| Tierras Bajas (2) | verde selva intenso | **Toborochi** / **Palmera Motacú** / **Bibosi** |

---

## 4. Suelo — elementos vectoriales dibujados (no texturas raster)

**Problema histórico (resuelto Jun 2026):** el suelo se pintaba con una baldosa
rasterizada repetida (`createPattern(..., 'repeat')`). Eso causaba **dos defectos**:
1. **Borrosidad** — el raster se ampliaba con el zoom del canvas (`ctx.scale`).
2. **Deriva** — el patrón no estaba anclado a coordenadas del mundo, así que al
   hacer zoom in/out el suelo "resbalaba" hacia una esquina.

**Solución actual:** los elementos del suelo (piedras, hierba, paja, hojas, flores,
guijarros, grietas, arbustos, juncos, pétalos, tierra, parches) se **dibujan como
vectores directamente en espacio mundo**, igual que los árboles. Resultado: **nítidos
a cualquier zoom** y **anclados** (no derivan). Jerarquía por capa (en
`fillPolygonWithGroundTexture`):

1. **Color base sólido** de la zona (`palette.base`) — relleno plano, nítido.
2. **Variación macro** (`paintMacroVariation`) — manchas grandes de relieve.
3. **Elementos sembrados** (`scatterGroundElements`) — ver 4.1.
4. **Tinte de sección** (color de la zona, opacidad baja).
5. **Ecotono / puente** con la zona vecina (`paintEcotoneBridge`).

### 4.1 Scatter vectorial anclado por celda (`scatterGroundElements`)
- Cada tipo de elemento se siembra sobre una **grilla absoluta en coordenadas del
  mundo**: `cell = 8/√(densidad·calidad)` px mundo, una instancia por celda con
  jitter determinista (seed = hash de `celdaX, celdaY, sección, tipo`).
- Anclaje absoluto ⇒ **sin deriva** al hacer pan/zoom (la misma celda da siempre la
  misma posición). Vectorial ⇒ **sin borrosidad**.
- **Viewport culling**: solo se siembran las celdas dentro del viewport visible
  (`GroundViewport` que pasa `map-control`), así el coste no crece al alejar.
- **Presupuesto** (`SCATTER_BUDGET`): si el área visible pide demasiadas celdas, la
  celda se agranda → acota el nº de dibujos por frame.
- Tamaño de cada elemento = `unit · (sizeMin…sizeMax)` en px mundo (`unit =
  resolveGroundTilePx`), reutilizando las primitivas cartoon vía `drawElementWorld`.

### 4.2 Variación macro (`paintMacroVariation`, dentro de `fillPolygonWithGroundTexture`)
- Manchas **grandes** (radio decenas–cientos de px) en **coordenadas del mundo**,
  deterministas por polígono (seed del bounding box + sección).
- **No se repiten** con el patrón ⇒ a distancia el suelo parece **terreno
  natural** (parches claros/oscuros, leve relieve), no una grilla.
- Alpha bajo (0.05–0.14) para no tapar el color de zona ni los iconos.

> **Resultado buscado:** de cerca se ven los elementos cartoon nítidos (hierba,
> piedras); de lejos, suelo con variación orgánica y elementos finos que se ocultan
> por LOD. Si se ve "vacío", **sube la densidad** de los elementos o la
> **densidad/escala de `paintMacroVariation`**.

### 4.3 Configuración del suelo — `GROUND_STYLE` (punto único de ajuste)
**Todo el aspecto del suelo se controla desde `GROUND_STYLE`** en
`draw-ground-texture.ts`. Es un `Record<sección, ZoneGroundStyle>` con:

```ts
type GroundElementType =
  | 'patch' | 'stone' | 'grass' | 'leaf' | 'flower' | 'shadow'   // base
  | 'pebbles' | 'crack' | 'bush' | 'reed' | 'petal' | 'dirt';    // ampliación

interface GroundElementSpec {
  type: GroundElementType;
  density: number;   // por área (× span²/64). MÁS BAJO = más espacio plano
  min?: number;      // mínimo absoluto por baldosa
  sizeMin: number;   // tamaño en múltiplos de `unit` (escala a cualquier zoom)
  sizeMax: number;
}
interface ZoneGroundStyle {
  elements: GroundElementSpec[];
  macroDensity: number;
  macroAlpha: number;
  edgeBlend?: number;       // px mundo del ecotono (difuminado de borde). 0 = corte duro
  edgeBlendAlpha?: number;  // intensidad del ecotono (0..1)
}
```

### 4.3.1 Tipos de textura disponibles
| Tipo | Dibujo | Buen uso |
|---|---|---|
| `patch` | mancha plana de color | romper uniformidad (todas las zonas) |
| `grass` | 3 briznas curvas | pradera |
| `stone` | piedra con luz | árido / orillas |
| `pebbles` | racimo de guijarros | árido, caminos |
| `dirt` | granos finos oscuros | suelo terroso |
| `crack` | grieta de tierra seca | **Altas** (café) |
| `leaf` | hoja con nervadura | selva |
| `flower` | flor con centro claro | pradera |
| `petal` | pétalos caídos | pradera florida |
| `bush` | arbusto bajo cel-shaded | selva / valle |
| `reed` | juncos altos | humedal / selva |
| `shadow` | elipse oscura suave | dosel selvático |

### 4.3.2 Ecotono elaborado — puente entre zonas (`edgeBlend` + `DEFAULT_ECOTONE_BRIDGE`)

**El problema:** cada zona se recorta con `clip()` exacto → Altas (café) choca con Medias (verde).

**La solución** tiene **4 capas** en la franja del borde (`paintEcotoneBridge`):

1. **Fade hacia la zona vecina** — anillos con el **color base de la base parque** (más opaco hacia el borde) → el verde/café se diluye en el puente neutro.
2. **Lavado de paleta** — `lerpPalette(zona, baseParque, t)` en anillos concéntricos → el color base se mezcla suavemente.
3. **Relieve cartoon** — acentos de luz en la franja.
4. **Iconos de puente** — hierba, tierra, guijarros… sembrados a lo largo del perímetro con alpha ∝ distancia al borde; paleta también mezclada.

Como **ambas zonas vecinas** funden hacia la **misma base neutra**, el encuentro café↔verde pasa por un ecotono visible en lugar de una línea.

```ts
interface EcotoneBridgeStyle {
  elements: GroundElementSpec[];  // texturas del puente
  paletteMix: number;             // 0..1 mezcla de color hacia base
  basePatternMix: number;         // 0..1 patrón de base sobre la franja
  zoneFade: number;               // 0..1 intensidad del fade de zona
}
```

**Preset de referencia** (copiar / aprender): `DEFAULT_ECOTONE_BRIDGE` en `draw-ground-texture.ts`:

| Zona | Texturas del puente | paletteMix |
|---|---|---|
| Altas (0) | dirt, pebbles, grass, patch | 0.92 |
| Medias (1) | grass, dirt, patch, pebbles | 0.88 |
| Bajas (2) | leaf, grass, dirt, patch | 0.85 |
| Base (-1) | patch, grass, stone | 0.78 |

Controles UI: `edgeBlend` (ancho px, default 28–34) y `edgeBlendAlpha` (fuerza). El puente usa el preset salvo que `ZoneGroundStyle.bridge` lo sobreescriba.

### 4.3.3 Zoom, nitidez y rendimiento

Al dibujarse como **vectores en espacio mundo** bajo el `ctx.scale` del canvas, los
elementos **siempre se ven nítidos** (no hay raster que ampliar) y **no derivan** (la
posición sale de una grilla absoluta del mundo). El coste por frame se controla con
tres palancas: **viewport culling** (solo se siembra lo visible), **presupuesto de
celdas** (`SCATTER_BUDGET`) y el dial de **Calidad**. El **Tamaño base** de los
elementos se ajusta con `groundTilePx` (2–48 px mundo) o en **Auto** (preset + tamaño
+ calidad).

### 4.3.4 Presets, tamaño, calidad y LOD — `utils/ground-preset.ts`

El admin controla el suelo con **un preset + dos diales**, todo en la UI (Panel → **Capas** → *Elementos del suelo* → **Preset suelo**):

- **Preset** (`GroundPresetId`): `performance` (⚡ menos elementos, grano grueso, LOD on), `subtle`, `balanced` (default), `rich`, `carbot`. Cada uno fija `recipeScale`, `baseQuality` y `baseTilePx`.
- **Tamaño general** (`scalePercent`, 50–200 %): escala **proporcionalmente** densidad y tamaño de elementos, ecotono (`edgeBlend`) y tamaño base Auto.
- **Calidad** (`qualityPercent`, 25–100 %): reduce **solo el número** de elementos (densidad, scatter del ecotono, macro) para ganar rendimiento; **no cambia el tamaño** de cada elemento. `densidadFinal = tamaño × calidad`.
- **LOD al alejar** (`lodEnabled` + umbrales `lodFineZoom`/`lodMediumZoom`/`lodEcotoneZoom`): al alejar el zoom, primero desaparece el detalle fino (piedras, guijarros, flores, pétalos, grietas, tierra, juncos), luego el medio (hierba, hojas, arbustos), y el ecotono se simplifica (8→5→3→0 pasos).

Persistencia: `groundSettings` (preset/tamaño/calidad/LOD) y `groundStyle` (overrides finos por zona) en `MapConfigData`. El tamaño base manual (`groundTilePx`) tiene prioridad hasta pulsar **Auto**.

Para **cambiar el aspecto de una zona** editas su lista de elementos en la UI:
- **Menos elementos / más plano** → baja la **Densidad** del elemento.
- **Elementos más grandes/pequeños** → ajusta **Tamaño mín** / **Tamaño máx**.
- **Menos/más variación a distancia** → `macroDensity` / `macroAlpha` (0 = sin macro).
- **Añadir/quitar un elemento** → **+ elemento** / botón **×**.
- **Suavizar bordes** → sube `edgeBlend` / `edgeBlendAlpha`.
- **Igualar todas las zonas** → **⇊ Aplicar a todas las zonas** copia los elementos
  (y macro/ecotono) de la zona en edición a las 3 zonas + base + fondo.

**UI del mapa (admin):** Panel lateral → **Capas** → con *Elementos del suelo* activos,
sección **Elementos por zona**: selector de zona + **Difuminado borde** + **Fuerza**
+ por elemento (densidad, tamaño mín/máx, quitar) + **+ elemento** + **⇊ Aplicar a
todas las zonas** + macro + restaurar.
Persiste en sesión local y en configuraciones guardadas (`groundStyle` en
`MapConfigData`). Los defaults de código siguen en `GROUND_STYLE`; la UI escribe
overrides vía `setGroundStyleOverride()` / `exportGroundStyleSnapshot()`.

**Estado actual por zona** (resumen; la verdad está en el código):
| Zona | Iconos (density) | edgeBlend | Carácter |
|---|---|---|---|
| Altas (0) | patch · crack · stone · pebbles · grass | 16 | árido, **mucho plano**, grietas |
| Medias (1) | patch · grass · flower · petal · bush | 16 | pradera densa con flores |
| Bajas (2) | patch · shadow · leaf · bush · reed · stone | 18 | hojarasca + sotobosque |
| Base parque (-1) | patch · grass | 22 | pradera neutra **puente** entre zonas |
| Fondo (-2) | patch · stone · grass | 0 | textura neutra **muy sutil** |

---

## 5. Árboles — `draw-simple-tree.ts`

**Técnica clave para NO dejar huecos: silueta unificada (`paintLobes`).**
Una copa es un array de lóbulos `{x,y,r}`. Para que la unión sea una sola
silueta con contorno limpio y **sin espacios transparentes** entre lóbulos:

1. Dibujar **TODOS** los lóbulos inflados (`r + lw`) en `stroke` (underlay negro).
2. Dibujar **TODOS** los lóbulos en `dark` (relleno base).
3. Por lóbulo (clip): tono `mid` y `light` desplazados arriba-izquierda.
4. **Highlight blanco** en el lóbulo más alto-izquierdo.

> ⚠️ Para que no aparezcan huecos, **los lóbulos deben solaparse** (distancia
> entre centros < suma de radios). Es el error #1 al añadir una especie.

Para trazos (ramas, fronds, lianas, flecos) se usa `outlinedStroke()` (negro
grueso debajo + color encima). Para flores, `bloomDots()`.

### 5.1 Especies por zona (3 c/u, variant 0/1/2)
| Zona | Especie | Cómo se dibuja |
|---|---|---|
| Altas | **Queñua** (Polylepis) | tronco rojizo retorcido (curva) + copa pequeña irregular (5 lóbulos) |
| Altas | **Kiswara** (Buddleja) | tronco recto esbelto + copa redonda compacta |
| Altas | **Puya Raimondii** | roseta de hojas espinosas radiales + **espiga floral** crema gigante |
| Medias | **Molle** | copa redonda + **flecos colgantes** (follaje llorón) |
| Medias | **Jacarandá** | copa redonda + **floración violeta** (`bloomDots`) |
| Medias | **Tipa** | copa ancha frondosa tipo paraguas (5 lóbulos) |
| Bajas | **Toborochi** | **tronco abombado** (`bulbTrunk`) + copa paraguas + **flores rosadas** |
| Bajas | **Palmera Motacú** | tronco fino curvo anillado + **corona de fronds** radiales |
| Bajas | **Bibosi** | tronco ancho con contrafuertes + **lianas** + copa ancha |

Tronco estándar (`trunkTrapezoid`): trapecio relleno + **sombra cel a la
derecha** + contorno. Base: **elipse de sombra** aplastada (proyección iso).

### 5.2 Configuración de árbol — `TREE_STYLE`
`Record<sección, { scale, outline, shadowW }>`. Todo es **relativo a la altura
`h`**, así que un árbol acepta cualquier `height` que se le pase:
- `scale` — multiplicador de altura por zona.
- `outline` — grosor de contorno como fracción de `h` (≈ 0.045–0.05).
- `shadowW` — ancho de la sombra proyectada como fracción de `h`.

Las secciones negativas (marco exterior) caen a la config de Medias (`?? [1]`).

---

## 6. Efectos ambientales (estilo cartoon)

Todos restilizados con formas limpias y contorno. Lógica de física en `tick()`,
estética en `draw()`.

| Efecto | Archivo | Estilo |
|---|---|---|
| **Lluvia** | `map-rain-effect.ts` | Gotas en **forma de lágrima** (Bézier), relleno azul, **contorno negro**, brillo blanco. Ondas de impacto = anillo doble (oscuro + claro). |
| **Hojas** | `map-leaves-effect.ts` | Silueta de **corazón aplanado** con contorno, nervadura central y brillo en el lóbulo superior-izquierdo. Volteo 3D por escala horizontal. |
| **Motas/Luciérnagas** | `map-motes-effect.ts` | Círculo de color + **halo** radial + contorno fino + **punto blanco central**. Cálidas (ámbar) y frías (celeste). |
| **Niebla** | `map-fog-effect.ts` | Nubes *puff* planas (varios discos cel de borde suave), alpha bajo. Deriva con el viento. |
| **Relámpago** | `map-lightning-effect.ts` | **Zigzag amarillo con contorno negro y núcleo blanco**, estilo cómic. Fogonazo cálido de fondo. |
| Sombras de nube | `map-cloud-shadow-effect.ts` | Manchas oscuras blandas que cruzan con el viento. |

Color de acento de efectos: amarillo `#FFD628` (rayo), azul `#46A0EB` (gotas),
ámbar `#FFCE46` / celeste `#96DCFF` (luciérnagas).

---

## 6.5 Tamaños ideales y escalabilidad

Nada está fijado en píxeles absolutos: **el suelo escala con `unit`** (tamaño base
del elemento) y **los árboles con `h`** (altura mundo). Por eso aceptan cualquier
tamaño. Referencias (en `map-park-visual-scale.ts` → `PARK_MAP_VIS`):

| Cosa | Variable | Ideal | Rango válido |
|---|---|---|---|
| Tamaño base del elemento | `groundTilePx` | **5 px** | `groundTileMin`=2 … `groundTileMax`=48 |
| Separación de scatter | `cell = 8/√(densidad·calidad)` | ~10–25 px mundo | `SCATTER_MIN_CELL`=5 … acotado por presupuesto |
| Elemento de suelo | `unit * sizeMin..sizeMax` | piedra ≈0.2·unit, hierba ≈0.3·unit, parche ≈1·unit | cualquiera, definido por zona |
| Mancha macro | `min(w,h) * 0.32 × (0.6..1.7)` | decenas–cientos px (mundo) | escala con el polígono |
| Árbol (altura) | `treeBaseWorld`=8 · `scale` | **8 px mundo** | mínimo `treeMinWorld`=3.2 |
| Contorno árbol | `h * outline` | `h * 0.045` | proporcional, nunca fijo |
| Sombra de árbol | `h * shadowW` | `h * 0.66–0.98` | proporcional |

**Regla de oro para “aceptar cualquier tamaño”:** expresa toda medida como
fracción de `unit` (suelo) o de `h` (árbol/efecto). Nunca pongas px crudos. Los
elementos del suelo se **dibujan como vectores** (nunca raster) para no perder
nitidez al ampliar.

---

## 7. Reglas técnicas (no romper)

1. **Contratos exportados estables.** No cambiar firmas de:
   `fillPolygonWithGroundTexture`, `fillMapRectWithBackdrop`, `GroundPatternCache`
   (shell de compatibilidad), `MapBackdropCache`, `groundPaletteForSection`,
   `drawSimpleTree`, `treePaletteForSection`, ni las clases de efectos
   (`tick`/`draw`/`setIntensity`/`setSizeMul`/`setContainsPoint`/`clear`).
   **El suelo ya NO usa patrón raster** (`buildGroundPatternTile`/`createPattern`
   fueron eliminados): se dibuja con `scatterGroundElements` en espacio mundo.
2. **Determinismo.** Aleatoriedad SIEMPRE vía `seededRand`. Mismo input ⇒ mismo
   render.
3. **Suelo vectorial en espacio mundo.** Los elementos se dibujan con
   `drawElementWorld` / `scatterGroundElements`, anclados a una grilla absoluta del
   mundo (sin raster, sin deriva). No reintroducir `createPattern`.
4. **Culling + presupuesto.** `scatterGroundElements` solo siembra el viewport
   visible y acota celdas con `SCATTER_BUDGET`. Pasar siempre el `GroundViewport`.
5. **Coordenadas.** Los efectos viven en el **plano del mapa** (`bx,by`) y se
   proyectan con `toScreen`; así rotan/zoom con la vista. El relámpago vive en
   el **viewport** (0..1).
6. **Performance.** Sin `shadowBlur` en bucles grandes; sin `filter`; preferir
   relleno plano. Ajustar densidad/calidad/LOD si baja el FPS.

---

## 8. Previsualización

Harness independiente (fuera del build) que importa las funciones reales y las
renderiza en un canvas:

```bash
cd apps/web-admin
npx esbuild scripts/preview/preview-entry.ts --bundle --format=iife \
  --outfile=scripts/preview/preview.bundle.js
npx http-server scripts/preview -p 8778 -c-1
# abrir http://127.0.0.1:8778/preview.html
```

Muestra: baldosas de cada zona (claro/oscuro), siluetas de árbol A/B/C e
instantáneas de cada efecto.

---

## 9. Checklist para añadir un elemento nuevo en estilo

- [ ] ¿Usa la **paleta** de su zona (sin colores sueltos)?
- [ ] ¿Tiene **contorno** oscuro proporcional?
- [ ] ¿Máximo **2–3 tonos** (cel-shading)?
- [ ] ¿Luz arriba-izquierda + **highlight blanco**?
- [ ] ¿Sombra/base como **elipse aplastada** (iso)?
- [ ] ¿Aleatoriedad **determinista** (`seededRand`)?
- [ ] Si es suelo: ¿**tesela** con `wrapped()` y respeta `unit`/`span`? ¿Está en `GROUND_STYLE`?
- [ ] Si es árbol: ¿los lóbulos **se solapan** (sin huecos)? ¿usa `TREE_STYLE`?
- [ ] ¿Toda medida es **fracción de `unit`/`h`** (ningún px crudo)?
- [ ] ¿Se ve bien **a tamaño pequeño** y **a distancia** (sin grilla)?

---

## 10. Roadmap (opcional, futuro)

- Proyección isométrica real (matriz 2:1) para árboles y POIs, no solo sombras.
- Atlas de *sprites* pre-renderizados por zona para más variedad de baldosa.
- Más especies por zona (algarrobo, churqui, ceibo, mara) reutilizando `paintLobes`.
- Estaciones / hora del día como *tints* globales coherentes con la paleta.
