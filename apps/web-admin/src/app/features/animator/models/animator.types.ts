import * as THREE from 'three';

/**
 * Estados del animador
 * 1 = Sin modelo cargado
 * 2 = Modelo cargado, modo visualización
 * 3 = Modo edición de secuencia
 */
export type AnimatorState = 1 | 2 | 3;

/**
 * Bloque de animación en la línea de tiempo
 */
export interface TimelineBlock {
  /** Índice del clip o nombre */
  clip: number | string;
  /** Duración en segundos */
  duration: number;
}

/**
 * Dirección de redimensionamiento del bloque
 */
export type ResizeDirection = 'left' | 'right';

/**
 * Datos del modelo 3D cargado
 */
export interface LoadedModelData {
  id: string;
  url: string;
  mixer: THREE.AnimationMixer | null;
  clips: THREE.AnimationClip[];
  originalPose: Map<string, THREE.Matrix4>;
}

/**
 * Configuración del renderizador
 */
export interface RendererConfig {
  clearColor: number;
  antialias: boolean;
  shadowMapEnabled: boolean;
}

/**
 * Configuración de la cámara
 */
export interface CameraConfig {
  fov: number;
  near: number;
  far: number;
  position: THREE.Vector3Like;
}

/**
 * Configuración de controles orbitales
 */
export interface ControlsConfig {
  enableDamping: boolean;
  dampingFactor: number;
  maxDistance: number;
  minDistance: number;
}

/**
 * Constantes del animador
 */
export const ANIMATOR_CONSTANTS = {
  /** Píxeles por segundo en la línea de tiempo */
  PIXELS_PER_SECOND: 100,
  /** Duración mínima de un bloque en segundos */
  MIN_BLOCK_DURATION: 0.5,
  /** Duración por defecto de un nuevo bloque */
  DEFAULT_BLOCK_DURATION: 2.0,
  /** Intervalo de actualización del loop de reproducción (ms) */
  PLAYBACK_INTERVAL_MS: 100,
} as const;

/**
 * Configuración por defecto del renderizador
 */
export const DEFAULT_RENDERER_CONFIG: RendererConfig = {
  clearColor: 0xe5e5e5,
  antialias: true,
  shadowMapEnabled: true,
};

/**
 * Colores de fondo del canvas 3D según el tema
 */
export const THEME_CANVAS_COLORS = {
  light: 0xf5f5f5,
  dark: 0x1e1e1e,
} as const;

/**
 * Configuración por defecto de la cámara
 */
export const DEFAULT_CAMERA_CONFIG: CameraConfig = {
  fov: 75,
  near: 0.1,
  far: 1000,
  position: { x: 0, y: 1.5, z: 5 },
};

/**
 * Configuración por defecto de controles
 */
export const DEFAULT_CONTROLS_CONFIG: ControlsConfig = {
  enableDamping: true,
  dampingFactor: 0.25,
  maxDistance: 20,
  minDistance: 2,
};
