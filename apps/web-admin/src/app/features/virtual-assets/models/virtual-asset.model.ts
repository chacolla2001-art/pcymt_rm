import { AnimationSequence } from './animation-sequence.model';

// Modelo VirtualAsset para reflejar el backend actualizado
export interface VirtualAssetDTO {
  id?: string;
  name: string;
  scientific_name?: string;
  description?: string;
  model_url: string;
  icon_url?: string;
  thumbnail_url?: string;
  category?: string;
  habitat?: string;
  display_order?: number;
  is_active: boolean;
  animation_sequence?: AnimationSequence;
  created_at: Date;
  updated_at: Date;
}

export class VirtualAsset {
  id: string;
  name: string;
  scientific_name?: string;
  description?: string;
  model_url: string;
  icon_url?: string;
  thumbnail_url?: string;
  category?: string;
  habitat?: string;
  display_order?: number;
  is_active: boolean;
  animation_sequence?: AnimationSequence;
  created_at: Date;
  updated_at: Date;

  constructor(data?: Partial<VirtualAsset> | VirtualAssetDTO) {
    this.id = data?.id ?? '';
    this.name = data?.name ?? '';
    this.scientific_name = data?.scientific_name;
    this.description = data?.description;
    this.model_url = data?.model_url ?? '';
    this.icon_url = data?.icon_url;
    this.thumbnail_url = data?.thumbnail_url;
    this.category = data?.category;
    this.habitat = data?.habitat;
    this.display_order = data?.display_order;
    this.is_active = data?.is_active ?? true;
    this.animation_sequence = data?.animation_sequence;
    this.created_at = data?.created_at ? new Date(data.created_at) : new Date();
    this.updated_at = data?.updated_at ? new Date(data.updated_at) : new Date();
  }
}
