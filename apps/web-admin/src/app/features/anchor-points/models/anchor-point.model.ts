/**
 * Tipo para la zona/sección del parque
 * Valores normalizados: texto descriptivo (coincide con backend y móvil)
 */
export type ParkSection = 'Tierras Altas' | 'Tierras Medias' | 'Tierras Bajas' | 'Mitos y Leyendas';

/**
 * Modelo de Punto de Anclaje
 * Representa ubicaciones en el mapa donde se muestran modelos 3D
 */
export class AnchorPoint {
  id: string;
  name: string;
  anchorCode?: string;
  latitude: number;
  longitude: number;
  /** Zona: '1' = Altiplano, '2' = Valles, '3' = Llanos */
  section?: ParkSection;
  /** Indica si debe mostrarse en el mapa */
  showInMap?: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  animalModelId?: string;
  virtualAssetId?: string;

  constructor(data?: Partial<AnchorPoint>) {
    this.id = data?.id ?? '';
    this.name = data?.name ?? '';
    this.anchorCode = data?.anchorCode;
    this.latitude = data?.latitude ?? 0;
    this.longitude = data?.longitude ?? 0;
    this.section = data?.section;
    this.showInMap = data?.showInMap;
    this.active = data?.active ?? true;
    this.createdAt = data?.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data?.updatedAt ? new Date(data.updatedAt) : new Date();
    this.animalModelId = data?.animalModelId || data?.virtualAssetId;
    this.virtualAssetId = data?.virtualAssetId || data?.animalModelId;
  }

  /** Coordenadas formateadas */
  get coordinates(): string {
    return `${this.latitude.toFixed(6)}, ${this.longitude.toFixed(6)}`;
  }
}

/**
 * Cluster — grupo de puntos de anclaje que comparten el mismo virtual asset.
 * Se usa para renderizar zonas/polígonos en el mapa cuando hay varios anchors
 * del mismo animal en una misma área.
 */
export interface AnchorCluster {
  virtualAssetId: string;
  section: ParkSection;
  count: number;
  isCluster: boolean;
  center: { lat: number; lng: number };
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  polygon: { lat: number; lng: number }[] | null;
  locations: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    anchorCode?: string;
    showInMap?: boolean;
    scale?: number;
    rotationY?: number;
  }[];
}
