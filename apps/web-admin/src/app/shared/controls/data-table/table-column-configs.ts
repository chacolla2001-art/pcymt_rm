/**
 * Configuraciones de columnas para la tabla genérica
 * Centraliza todas las definiciones de columnas y sus nombres
 */

import { ColumnNamesMap, SectionOption } from './table-types';

/** Columnas para tabla de usuarios */
export const USER_COLUMNS = [
  'username',
  'email',
  'role',
  'is_active',
  'edit'
];

/** Nombres de columnas para usuarios */
export const USER_COLUMN_NAMES: ColumnNamesMap = {
  username: 'Nombre de usuario',
  email: 'Correo electrónico',
  role: 'Rol',
  is_active: 'Activo',
  edit: 'Editar'
};

/** Nombres de columnas para puntos de anclaje */
export const ANCHOR_POINT_COLUMN_NAMES: ColumnNamesMap = {
  name: 'Nombre del Punto',
  description: 'Descripción',
  latitude: 'Latitud',
  longitude: 'Longitud',
  virtualAssetId: 'Modelo asociado',
  active: 'Activo',
  edit: 'Editar',
  section: 'Sección',
  showInMap: 'Mostrar en Mapa'
};

/** Nombres de columnas para activos virtuales */
export const VIRTUAL_ASSET_COLUMN_NAMES: ColumnNamesMap = {
  name: 'Nombre del modelo',
  description: 'Descripción',
  is_active: 'Activo',
  icon_url: 'Icono',
  play: 'Ver Modelo',
  edit: 'Editar'
};

/** Opciones de sección del parque — valores = etiquetas de texto (normalizadas con backend y móvil) */
export const SECTION_OPTIONS: SectionOption[] = [
  { value: 'Tierras Altas', label: 'Tierras Altas' },
  { value: 'Tierras Medias', label: 'Tierras Medias' },
  { value: 'Tierras Bajas', label: 'Tierras Bajas' },
  { value: 'Mitos y Leyendas', label: 'Mitos y Leyendas' }
];

/** Obtiene el label de una sección por su valor */
export function getSectionLabel(value: string | null | undefined): string {
  if (!value) return '–';
  const option = SECTION_OPTIONS.find(o => o.value === value);
  return option ? option.label : '–';
}

/** Placeholders de búsqueda según el tipo de dato */
export const SEARCH_PLACEHOLDERS: Record<string, string> = {
  users: 'Nombre de usuario | Correo',
  anchorPoints: 'Nombre del punto | Descripción',
  virtualAssets: 'Nombre del modelo | Descripción'
};
