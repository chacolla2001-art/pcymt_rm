/** Ajustes de escena ambiental (valores 0–1 salvo índices). */
export interface AmbientSceneSettings {
  showRainEffect: boolean;
  rainIntensity: number;
  rainSize: number;
  rainSectionIndex: number;
  showFogEffect: boolean;
  fogIntensity: number;
  fogSize: number;
  showMotesEffect: boolean;
  motesIntensity: number;
  motesSize: number;
  showCloudShadows: boolean;
  cloudShadowIntensity: number;
  cloudShadowSize: number;
  showLeavesEffect: boolean;
  leavesIntensity: number;
  leavesSize: number;
  showTreesEffect: boolean;
  treesIntensity: number;
  treesSize: number;
  showLightningEffect: boolean;
  showNightMistEffect: boolean;
  nightMistIntensity: number;
  ambientWindDeg: number;
  ambientWindStrength: number;
}

export interface AmbientScenarioTint {
  top: string;
  bottom: string;
  alpha: number;
}

export interface AmbientScenario {
  id: string;
  label: string;
  emoji: string;
  description: string;
  /** Cambia tema del panel/mapa para apreciar el efecto. */
  theme: 'dark' | 'light' | null;
  /** Encuadra sección (0–3) o -1 = todo el parque. null = sin mover cámara. */
  focusSection: number | null;
  tint: AmbientScenarioTint | null;
  /** Sube opacidad del fill en la zona activa para contrastar partículas. */
  sectionOpacityBoost: number;
  scene: AmbientSceneSettings;
}

const baseOff: AmbientSceneSettings = {
  showRainEffect: false,
  rainIntensity: 0.45,
  rainSize: 1,
  rainSectionIndex: -1,
  showFogEffect: false,
  fogIntensity: 0.35,
  fogSize: 1,
  showMotesEffect: false,
  motesIntensity: 0.4,
  motesSize: 1,
  showCloudShadows: false,
  cloudShadowIntensity: 0.4,
  cloudShadowSize: 1,
  showLeavesEffect: false,
  leavesIntensity: 0.45,
  leavesSize: 1,
  showTreesEffect: false,
  treesIntensity: 0.55,
  treesSize: 1,
  showLightningEffect: false,
  showNightMistEffect: false,
  nightMistIntensity: 0.35,
  ambientWindDeg: 245,
  ambientWindStrength: 0.45,
};

/** Escenarios listos para apreciar cada efecto ambiental en el mapa web. */
export const AMBIENT_SCENARIOS: AmbientScenario[] = [
  {
    id: 'clear',
    label: 'Día despejado',
    emoji: '☀️',
    description: 'Sin efectos; colores normales del parque.',
    theme: 'light',
    focusSection: -1,
    tint: null,
    sectionOpacityBoost: 0,
    scene: { ...baseOff },
  },
  {
    id: 'storm-bajas',
    label: 'Tormenta Bajas',
    emoji: '⛈️',
    description: 'Lluvia fuerte, nubes, relámpagos; tono gris-azul.',
    theme: 'dark',
    focusSection: 2,
    tint: { top: 'rgb(30, 45, 70)', bottom: 'rgb(15, 25, 45)', alpha: 0.38 },
    sectionOpacityBoost: 0.18,
    scene: {
      ...baseOff,
      rainSectionIndex: 2,
      showRainEffect: true,
      rainIntensity: 0.88,
      rainSize: 0.42,
      showCloudShadows: true,
      cloudShadowIntensity: 0.62,
      cloudShadowSize: 1.15,
      showFogEffect: true,
      fogIntensity: 0.48,
      fogSize: 1.1,
      showLightningEffect: true,
      ambientWindDeg: 200,
      ambientWindStrength: 0.82,
    },
  },
  {
    id: 'mist-altas',
    label: 'Neblina Altas',
    emoji: '🌫️',
    description: 'Niebla densa y sombras suaves en el altiplano.',
    theme: 'light',
    focusSection: 0,
    tint: { top: 'rgb(200, 220, 240)', bottom: 'rgb(170, 195, 220)', alpha: 0.32 },
    sectionOpacityBoost: 0.14,
    scene: {
      ...baseOff,
      rainSectionIndex: 0,
      showFogEffect: true,
      fogIntensity: 0.78,
      fogSize: 1.25,
      showCloudShadows: true,
      cloudShadowIntensity: 0.38,
      cloudShadowSize: 0.95,
      ambientWindDeg: 90,
      ambientWindStrength: 0.25,
    },
  },
  {
    id: 'sunset-medias',
    label: 'Atardecer Medias',
    emoji: '🌅',
    description: 'Polen dorado, hojas al viento y luz cálida.',
    theme: 'light',
    focusSection: 1,
    tint: { top: 'rgb(255, 210, 140)', bottom: 'rgb(255, 170, 90)', alpha: 0.28 },
    sectionOpacityBoost: 0.1,
    scene: {
      ...baseOff,
      rainSectionIndex: 1,
      showMotesEffect: true,
      motesIntensity: 0.72,
      motesSize: 1.15,
      showLeavesEffect: true,
      leavesIntensity: 0.58,
      leavesSize: 1.05,
      showTreesEffect: true,
      treesIntensity: 0.62,
      treesSize: 1.05,
      showCloudShadows: true,
      cloudShadowIntensity: 0.28,
      cloudShadowSize: 1.2,
      ambientWindDeg: 45,
      ambientWindStrength: 0.55,
    },
  },
  {
    id: 'myth-night',
    label: 'Noche Mítica',
    emoji: '🌙',
    description: 'Bruma azul, chispas y tema oscuro en Mitos.',
    theme: 'dark',
    focusSection: -1,
    tint: { top: 'rgb(40, 60, 130)', bottom: 'rgb(20, 30, 80)', alpha: 0.42 },
    sectionOpacityBoost: 0.16,
    scene: {
      ...baseOff,
      rainSectionIndex: -1,
      showNightMistEffect: true,
      nightMistIntensity: 0.72,
      showMotesEffect: true,
      motesIntensity: 0.65,
      motesSize: 1.2,
      showCloudShadows: true,
      cloudShadowIntensity: 0.22,
      cloudShadowSize: 1.3,
    },
  },
  {
    id: 'rain-zoom',
    label: 'Lluvia fina (zoom)',
    emoji: '💧',
    description: 'Gotas pequeñas en todo el parque para probar zoom.',
    theme: 'dark',
    focusSection: -1,
    tint: { top: 'rgb(50, 70, 95)', bottom: 'rgb(35, 50, 75)', alpha: 0.22 },
    sectionOpacityBoost: 0.12,
    scene: {
      ...baseOff,
      showRainEffect: true,
      rainIntensity: 0.68,
      rainSize: 0.1,
      showCloudShadows: true,
      cloudShadowIntensity: 0.35,
      cloudShadowSize: 1.05,
      ambientWindDeg: 120,
      ambientWindStrength: 0.68,
    },
  },
  {
    id: 'jungle-bajas',
    label: 'Selva húmeda',
    emoji: '🌿',
    description: 'Lluvia ligera, niebla verde y hojas en Tierras Bajas.',
    theme: 'light',
    focusSection: 2,
    tint: { top: 'rgb(60, 120, 70)', bottom: 'rgb(40, 90, 55)', alpha: 0.3 },
    sectionOpacityBoost: 0.12,
    scene: {
      ...baseOff,
      rainSectionIndex: 2,
      showRainEffect: true,
      rainIntensity: 0.52,
      rainSize: 0.35,
      showFogEffect: true,
      fogIntensity: 0.55,
      fogSize: 1.15,
      showLeavesEffect: true,
      leavesIntensity: 0.48,
      leavesSize: 0.9,
      showTreesEffect: true,
      treesIntensity: 0.78,
      treesSize: 1.1,
      showCloudShadows: true,
      cloudShadowIntensity: 0.3,
    },
  },
  {
    id: 'dawn-altas',
    label: 'Amanecer Altas',
    emoji: '🌄',
    description: 'Bruma baja, polvo dorado y luz rosada del alba en el altiplano.',
    theme: 'light',
    focusSection: 0,
    tint: { top: 'rgb(255, 200, 165)', bottom: 'rgb(230, 175, 195)', alpha: 0.3 },
    sectionOpacityBoost: 0.1,
    scene: {
      ...baseOff,
      showFogEffect: true,
      fogIntensity: 0.5,
      fogSize: 1.3,
      showMotesEffect: true,
      motesIntensity: 0.55,
      motesSize: 1.1,
      showCloudShadows: true,
      cloudShadowIntensity: 0.32,
      cloudShadowSize: 1.25,
      ambientWindDeg: 70,
      ambientWindStrength: 0.3,
    },
  },
  {
    id: 'fireflies-night',
    label: 'Luciérnagas',
    emoji: '✨',
    description: 'Noche cálida con enjambre de luciérnagas y bruma tenue.',
    theme: 'dark',
    focusSection: 1,
    tint: { top: 'rgb(30, 40, 75)', bottom: 'rgb(18, 24, 50)', alpha: 0.4 },
    sectionOpacityBoost: 0.18,
    scene: {
      ...baseOff,
      showMotesEffect: true,
      motesIntensity: 0.92,
      motesSize: 1.35,
      showNightMistEffect: true,
      nightMistIntensity: 0.5,
      showCloudShadows: true,
      cloudShadowIntensity: 0.18,
      cloudShadowSize: 1.3,
      ambientWindDeg: 30,
      ambientWindStrength: 0.25,
    },
  },
  {
    id: 'windy-medias',
    label: 'Viento en valles',
    emoji: '🍃',
    description: 'Ráfagas fuertes con hojas y polen cruzando los valles.',
    theme: 'light',
    focusSection: 1,
    tint: { top: 'rgb(180, 210, 140)', bottom: 'rgb(150, 185, 110)', alpha: 0.2 },
    sectionOpacityBoost: 0.08,
    scene: {
      ...baseOff,
      showLeavesEffect: true,
      leavesIntensity: 0.85,
      leavesSize: 1.1,
      showMotesEffect: true,
      motesIntensity: 0.45,
      motesSize: 0.9,
      showTreesEffect: true,
      treesIntensity: 0.6,
      showCloudShadows: true,
      cloudShadowIntensity: 0.45,
      cloudShadowSize: 1.1,
      ambientWindDeg: 290,
      ambientWindStrength: 0.92,
    },
  },
];

export function findAmbientScenario(id: string): AmbientScenario | undefined {
  return AMBIENT_SCENARIOS.find((s) => s.id === id);
}
