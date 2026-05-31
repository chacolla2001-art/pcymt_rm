/**
 * Tipos e interfaces para el componente de tabla genérica
 * Separa las definiciones de tipos para mejorar la mantenibilidad
 */

import { User } from '../../../core/models/user.model';
import { AnchorPoint } from '../../../core/models/anchor-point.model';
import { VirtualAsset } from '../../../core/models/virtual-asset.model';

/** Tipos de datos que puede cargar la tabla */
export type TableDataType = 'users' | 'anchorPoints' | 'virtualAssets';

/** Estados de filtro para registros activos/inactivos */
export type StatusFilter = 'active' | 'inactive' | 'all';

/** Tipo unión para los elementos de la tabla */
export type TableElement = User | AnchorPoint | VirtualAsset;

/** Configuración de columnas para usuarios */
export interface UserColumnConfig {
  key: keyof User | 'edit';
  name: string;
  sortable?: boolean;
}

/** Configuración de columnas para puntos de anclaje */
export interface AnchorPointColumnConfig {
  key: keyof AnchorPoint | 'edit' | 'virtualAssetId' | 'showInMap';
  name: string;
  sortable?: boolean;
}

/** Configuración de columnas para activos virtuales */
export interface VirtualAssetColumnConfig {
  key: keyof VirtualAsset | 'play' | 'edit';
  name: string;
  sortable?: boolean;
}

/** Opciones de sección del parque */
export interface SectionOption {
  value: string;
  label: string;
}

/** Mapeo de nombres de columnas */
export interface ColumnNamesMap {
  [key: string]: string;
}
