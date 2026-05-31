/**
 * Interfaces para métricas del dashboard
 * Reemplaza el uso de 'any' con tipos específicos
 */

/** Estadísticas de usuarios por rol */
export interface UserRoleCount {
  role: string;
  count: number;
}

/** Estadísticas de usuarios por estado */
export interface UserStatusCount {
  status: 'active' | 'inactive';
  count: number;
}

/** Interacciones por tipo */
export interface InteractionsByType {
  type: string;
  count: number;
}

/** Interacción con información de fecha y tipo para series temporales */
export interface TimeSeriesInteraction {
  date: string;
  interactionType: string;
  count: number;
}

/** Modelo virtual más interactuado */
export interface TopVirtualAsset {
  id: string;
  name: string;
  interactionCount: number;
}

/** Usuario con más interacciones */
export interface TopUser {
  id: string;
  name: string;
  email: string;
  interactionCount: number;
}

/** Interacciones por sección del parque */
export interface InteractionsBySection {
  section: string;
  interactionCount: number;
}

/** Serie temporal de sesiones */
export interface SessionTimeSeries {
  date: string;
  count: number;
}

/** Totales generales del dashboard */
export interface DashboardTotals {
  totalUsers: number;
  activeUsers: number;
  totalVirtualAssets: number;
  totalAnchorPoints: number;
  totalInteractions: number;
}

/** Métricas avanzadas consolidadas */
export interface AdvancedMetrics {
  topVirtualAssets: TopVirtualAsset[];
  topUsers: TopUser[];
  interactionsBySection: InteractionsBySection[];
}
