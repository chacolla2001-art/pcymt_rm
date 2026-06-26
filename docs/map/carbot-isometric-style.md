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

## 4. Suelo — sistema de baldosas (anti-grilla)

**Problema que resolvemos:** una baldosa pequeña repetida con `createPattern`
se lee como una grilla desde lejos. Solución de dos capas (ver
`draw-ground-texture.ts`):

### 4.1 Súper-baldosa (`buildGroundPatternTile`)
- `unit = clampGroundTilePx(tilePx)` → tamaño de las *features* (grano), constante.
- `span = unit * repeatFactor(unit)` → el lienzo del patrón abarca **varias
  celdas** (`repeat` 2–6). Las features se dispersan por todo el `span` con
  tamaño `unit` ⇒ **el período de repetición es mucho mayor que el grano**.
- Teselado sin costuras: features cerca de un borde se **clonan** ±span con
  `wrapped()`.
- **Sin rejilla isométrica literal** en la baldosa (era el principal culpable del
  "look de grilla"). El fondo es color sólido + manchas planas (`flatPatch`) +
  iconos cartoon (hierba, piedra, hoja, flor).

### 4.2 Variación macro (`paintMacroVariation`, dentro de `fillPolygonWithGroundTexture`)
- Manchas **grandes** (radio decenas–cientos de px) en **coordenadas del mundo**,
  deterministas por polígono (seed del bounding box + sección).
- **No se repiten** con el patrón ⇒ a distancia el suelo parece **terreno
  natural** (parches claros/oscuros, leve relieve), no una grilla.
- Alpha bajo (0.05–0.14) para no tapar el color de zona ni los iconos.

> **Resultado buscado:** de cerca se ven las baldosas cartoon (hierba, piedras);
> de lejos se ve un suelo con variación orgánica. Si vuelve a verse "cuadriculado",
> primero **sube `repeatFactor`** y/o **sube la densidad/escala de
> `paintMacroVariation`**; no añadas líneas de grilla.

### 4.3 Configuración del suelo — `GROUND_STYLE` (punto único de ajuste)
**Todo el aspecto del suelo se controla desde `GROUND_STYLE`** en
`draw-ground-texture.ts`. Es un `Record<sección, ZoneGroundStyle>` con:

```ts
interface GroundElementSpec {
  type: 'patch'|'stone'|'grass'|'leaf'|'flower'|'shadow';
  density: number;   // por área (× span²/64). MÁS BAJO = más espacio plano
  min?: number;      // mínimo absoluto por baldosa
  sizeMin: number;   // tamaño en múltiplos de `unit` (escala a cualquier zoom)
  sizeMax: number;
}
interface ZoneGroundStyle { elements: GroundElementSpec[]; macroDensity: number; macroAlpha: number; }
```

Para **cambiar el aspecto de una zona** solo editas su entrada. Reglas prácticas:
- **Menos elementos / más plano** → baja `density` (y `min`) del icono.
- **Iconos más grandes/pequeños** → ajusta `sizeMin/sizeMax` (en unidades de `unit`).
- **Menos/más variación a distancia** → `macroDensity` / `macroAlpha` (0 = sin macro).
- **Añadir un icono** → agrega un `GroundElementSpec` al array de la zona.

**UI del mapa (admin):** Panel lateral → **Capas** → con *Texturas suelo* activas,
sección **Estilo suelo por zona** (sliders de densidad + macro). Persiste en sesión
local y en configuraciones guardadas (`groundStyle` en `MapConfigData`). Los defaults
de código siguen en `GROUND_STYLE`; la UI escribe overrides vía
`setGroundStyleOverride()` / `exportGroundStyleSnapshot()`.

**Estado actual por zona** (resumen; la verdad está en el código):
| Zona | Iconos (density) | Carácter |
|---|---|---|
| Altas (0) | patch 0.18 · **stone 0.16** · **grass 0.16** | árido, **mucho plano**, pocas piedras/paja |
| Medias (1) | patch 0.3 · grass 0.7 · flower 0.22 | pradera densa con florecillas |
| Bajas (2) | patch 0.34 · shadow 0.3 · leaf 0.42 · stone 0.16 | hojarasca + sombras de dosel |
| Base parque (-1) | patch 0.26 · grass 0.4 | pradera neutra suave |
| Fondo (-2) | patch 0.16 · stone 0.07 · grass 0.08 | textura neutra **muy sutil** alrededor del mapa |

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

Nada está fijado en píxeles absolutos: **el suelo escala con `unit`** (tamaño de
baldosa) y **los árboles con `h`** (altura mundo). Por eso aceptan cualquier
tamaño. Referencias (en `map-park-visual-scale.ts` → `PARK_MAP_VIS`):

| Cosa | Variable | Ideal | Rango válido |
|---|---|---|---|
| Baldosa (grano del suelo) | `groundTilePx` | **5 px** | `groundTileMin`=2 … `groundTileMax`=48 |
| Súper-baldosa (lienzo patrón) | `span = unit * repeatFactor(unit)` | `repeat` 2–6 (≈`150/unit`) | ≤ ~190 px de lado |
| Icono de suelo | `unit * sizeMin..sizeMax` | piedra ≈0.2·unit, hierba ≈0.3·unit, parche ≈1·unit | cualquiera, definido por zona |
| Mancha macro | `min(w,h) * 0.32 × (0.6..1.7)` | decenas–cientos px (mundo) | escala con el polígono |
| Árbol (altura) | `treeBaseWorld`=8 · `scale` | **8 px mundo** | mínimo `treeMinWorld`=3.2 |
| Contorno árbol | `h * outline` | `h * 0.045` | proporcional, nunca fijo |
| Sombra de árbol | `h * shadowW` | `h * 0.66–0.98` | proporcional |

**Regla de oro para “aceptar cualquier tamaño”:** expresa toda medida como
fracción de `unit` (suelo) o de `h` (árbol/efecto). Nunca pongas px crudos.
Si necesitas un grano más fino al alejar, **baja `tilePx`**; el `repeatFactor`
sube solo para mantener un período de repetición grande (anti-grilla).

---

## 7. Reglas técnicas (no romper)

1. **Contratos exportados estables.** No cambiar firmas de:
   `buildGroundPatternTile`, `GroundPatternCache`, `fillPolygonWithGroundTexture`,
   `MapBackdropCache`, `fillMapRectWithBackdrop`, `groundPaletteForSection`,
   `drawSimpleTree`, `treePaletteForSection`, ni las clases de efectos
   (`tick`/`draw`/`setIntensity`/`setSizeMul`/`setContainsPoint`/`clear`).
2. **Determinismo.** Aleatoriedad SIEMPRE vía `seededRand`. Mismo input ⇒ mismo
   render.
3. **Teselado.** Todo icono de suelo grande usa `wrapped()` para no cortar en el
   borde de la súper-baldosa.
4. **Caché.** Los patrones se cachean por `(sección, tema, tilePx)` en
   `GroundPatternCache`. Si cambias el tamaño/seed, invalida con `clear()`.
5. **Coordenadas.** Los efectos viven en el **plano del mapa** (`bx,by`) y se
   proyectan con `toScreen`; así rotan/zoom con la vista. El relámpago vive en
   el **viewport** (0..1).
6. **Performance.** Sin `shadowBlur` en bucles grandes; sin `filter`; preferir
   relleno plano. Súper-baldosa ≤ ~190 px de lado.

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
