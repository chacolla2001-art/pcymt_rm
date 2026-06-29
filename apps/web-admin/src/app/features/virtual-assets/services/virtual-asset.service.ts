import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { VirtualAsset, VirtualAssetDTO } from '../models/virtual-asset.model';
import { AnimationSequence } from '../models/animation-sequence.model';

/** Respuesta estándar del backend */
interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

@Injectable({ providedIn: 'root' })
export class VirtualAssetService {
  private readonly baseUrl = environment.apiUrl + '/api/virtual-assets';

  constructor(private http: HttpClient) {}

  getAllVirtualAssets(isActive?: boolean): Observable<VirtualAsset[]> {
    let url = this.baseUrl;
    if (isActive !== undefined) {
      url += `?is_active=${isActive}`;
    }
    return this.http.get<ApiResponse<VirtualAssetDTO[]>>(url)
      .pipe(
        map((response) => response.data.map((dto: VirtualAssetDTO) => new VirtualAsset(dto)))
      );
  }

  getVirtualAssetById(id: string): Observable<VirtualAsset> {
    return this.http.get<ApiResponse<VirtualAssetDTO>>(`${this.baseUrl}/${id}`)
      .pipe(map((response) => new VirtualAsset(response.data)));
  }

  createVirtualAsset(asset: Partial<VirtualAsset> | FormData): Observable<VirtualAsset> {
    return this.http.post<ApiResponse<VirtualAssetDTO>>(this.baseUrl, asset)
      .pipe(map((response) => new VirtualAsset(response.data)));
  }

  updateVirtualAsset(id: string, asset: Partial<VirtualAsset> | FormData): Observable<VirtualAsset> {
    return this.http.put<ApiResponse<VirtualAssetDTO>>(`${this.baseUrl}/${id}`, asset)
      .pipe(map((response) => new VirtualAsset(response.data)));
  }

  deleteVirtualAsset(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  updateAnimationSequence(id: string, sequence: AnimationSequence): Observable<VirtualAsset> {
    return this.http.put<ApiResponse<VirtualAssetDTO>>(`${this.baseUrl}/${id}/animation-sequence`, { animation_sequence: sequence })
      .pipe(map((response) => new VirtualAsset(response.data)));
  }
}
