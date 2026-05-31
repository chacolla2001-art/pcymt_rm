import { Component, inject, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';

import { BaseTableComponent, TableDataType } from '../../../../shared/controls/base-table/base-table.component';
import { VirtualAssetService } from '../../services/virtual-asset.service';
import { VirtualAsset } from '../../models/virtual-asset.model';
import { DialogData } from '../../../../shared/modal-dialogs/create-dialog';

/**
 * Componente de tabla para gestión de activos virtuales (modelos 3D)
 * Extiende BaseTableComponent con funcionalidad específica de virtual assets
 */
@Component({
  selector: 'virtual-asset-table',
  templateUrl: './virtual-asset-table.component.html',
  styleUrls: ['../../../../shared/controls/base-table/base-table.component.scss', './virtual-asset-table.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatSelectModule,
    MatPaginatorModule,
    MatCheckboxModule,
    MatButtonModule,
    MatTableModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule
  ]
})
export class VirtualAssetTableComponent extends BaseTableComponent {
  private readonly virtualAssetService = inject(VirtualAssetService);

  readonly virtualAssetColumnNames = {
    name: 'Nombre del modelo',
    description: 'Descripción',
    is_active: 'Activo',
    icon_url: 'Icono',
    play: 'Ver Modelo',
    edit: 'Editar'
  };

  constructor(@Inject(PLATFORM_ID) platformId: object) {
    super(platformId);
    this.currentLoadType = 'virtualAssets';
  }

  public override loadData(type: TableDataType): void {
    if (!this.isBrowser) return;

    this.isLoading = true;
    this.currentLoadType = type;

    if (type !== 'virtualAssets') {
      console.warn('VirtualAssetTableComponent solo debería cargar datos de tipo "virtualAssets"');
      return;
    }

    this.virtualAssetService.getAllVirtualAssets(this.getIsActiveFilter()).subscribe((assets: VirtualAsset[]) => {
      const sortedAssets = assets.sort(this.sortByUpdated);
      this.setupDataSource(sortedAssets);
    });
  }

  protected getColumnNames(): { [key: string]: string } {
    return this.virtualAssetColumnNames;
  }

  protected getDisplayedColumns(): string[] {
    return ['name', 'description', 'is_active', 'icon_url', 'play', 'edit'];
  }

  protected getSearchFields(): string[] {
    return ['name', 'description'];
  }

  /**
   * Abre el visor 3D para reproducir el modelo
   */
  public onPlay(element: VirtualAsset): void {
    this.openModelViewer(this.apiRoutes.getModelUrl(element.model_url));
  }

  protected buildEditDialog(element: VirtualAsset): DialogData {
    return {
      groups: {
        assetInfo: {
          label: 'Editar Recurso Virtual',
          controls: {
            name: {
              type: 'text',
              label: 'Nombre del recurso',
              enabled: true,
              defaultValue: element?.name,
              allowWhitespaces: true
            },
            description: {
              type: 'textarea',
              label: 'Descripción',
              enabled: true,
              defaultValue: element?.description,
              allowWhitespaces: true
            },
            is_active: {
              type: 'toggle',
              label: 'Activo',
              enabled: true,
              defaultValue: element?.is_active
            },
            model_url: {
              type: 'file',
              label: 'Cargar modelo',
              enabled: true
            },
            icon_url: {
              type: 'file',
              label: 'Cargar icono',
              enabled: true
            },
            scientific_name: {
              type: 'text',
              label: 'Nombre científico',
              enabled: true,
              defaultValue: element?.scientific_name
            },
            category: {
              type: 'select',
              label: 'Categoría',
              enabled: true,
              options: [
                { value: 'Mamífero', label: 'Mamífero' },
                { value: 'Ave', label: 'Ave' },
                { value: 'Reptil', label: 'Reptil' },
                { value: 'Mito', label: 'Mito' }
              ],
              defaultValue: element?.category
            },
            habitat: {
              type: 'text',
              label: 'Hábitat',
              enabled: true,
              defaultValue: element?.habitat
            },
            display_order: {
              type: 'text',
              inputType: 'number',
              label: 'Orden de visualización',
              enabled: true,
              defaultValue: element?.display_order ?? 0
            },
          },
          hint: {
            type: 'info',
            message: 'Asegúrese de que el archivo subido esté en un formato compatible GLB o FBX.'
          }
        },
      },
      titleText: 'Editar Recurso Virtual',
    };
  }

  protected buildCreateDialog(): DialogData {
    return {
      groups: {
        modelInfo: {
          controls: {
            model_name: {
              type: 'text',
              label: 'Nombre del modelo',
              enabled: true,
              required: true,
              allowWhitespaces: true
            },
            description: {
              type: 'textarea',
              label: 'Descripción',
              enabled: true,
              required: true,
              allowWhitespaces: true
            },
            active: {
              type: 'toggle',
              label: 'Activo',
              enabled: true,
            },
            model_url: {
              type: 'file',
              label: 'Cargar modelo',
              enabled: true,
              required: true
            },
            icon_url: {
              type: 'file',
              label: 'Cargar icono',
              enabled: true,
              required: true
            },
            scientific_name: {
              type: 'text',
              label: 'Nombre científico',
              enabled: true
            },
            category: {
              type: 'select',
              label: 'Categoría',
              enabled: true,
              options: [
                { value: 'Mamífero', label: 'Mamífero' },
                { value: 'Ave', label: 'Ave' },
                { value: 'Reptil', label: 'Reptil' },
                { value: 'Mito', label: 'Mito' }
              ]
            },
            habitat: {
              type: 'text',
              label: 'Hábitat',
              enabled: true
            },
            display_order: {
              type: 'text',
              inputType: 'number',
              label: 'Orden de visualización',
              enabled: true,
              defaultValue: 0
            },
          },
          hint: {
            type: 'info',
            message: 'Asegúrese de que el archivo subido esté en un formato compatible GLB o FBX.'
          }
        },
      },
      customClass: 'virtual-asset-dialog',
      titleText: 'Añadir CERM'
    };
  }

  protected processEditResult(result: Record<string, Record<string, unknown>>, element: VirtualAsset): void {
    const assetInfo = result['assetInfo'];
    const formData = new FormData();

    formData.append('name', String(assetInfo['name'] ?? ''));
    formData.append('description', String(assetInfo['description'] ?? ''));
    formData.append('is_active', String(assetInfo['is_active'] ?? false));
    if (assetInfo['scientific_name'] !== undefined) {
      formData.append('scientific_name', String(assetInfo['scientific_name'] ?? ''));
    }
    if (assetInfo['category'] !== undefined) {
      formData.append('category', String(assetInfo['category'] ?? ''));
    }
    if (assetInfo['habitat'] !== undefined) {
      formData.append('habitat', String(assetInfo['habitat'] ?? ''));
    }
    if (assetInfo['display_order'] !== undefined && assetInfo['display_order'] !== null) {
      formData.append('display_order', String(Number(assetInfo['display_order'])));
    }

    if (assetInfo['model_url']) {
      formData.append('model_url', assetInfo['model_url'] as Blob);
    }
    if (assetInfo['icon_url']) {
      formData.append('icon_url', assetInfo['icon_url'] as Blob);
    }

    this.virtualAssetService.updateVirtualAsset(element.id, formData).subscribe({
      next: () => {
        this.alertService.showAlert('Recurso virtual editado correctamente', 'success', 2000);
        this.loadData(this.currentLoadType);
      },
      error: () => {
        this.alertService.showAlert('Error al editar recurso virtual', 'error', 2000);
      }
    });
  }

  protected processCreateResult(result: Record<string, Record<string, unknown>>): void {
    const modelInfo = result['modelInfo'];
    const formData = new FormData();

    formData.append('name', String(modelInfo['model_name'] ?? ''));
    formData.append('description', String(modelInfo['description'] ?? ''));
    formData.append('is_active', String(modelInfo['active'] ?? false));
    if (modelInfo['scientific_name'] !== undefined) {
      formData.append('scientific_name', String(modelInfo['scientific_name'] ?? ''));
    }
    if (modelInfo['category'] !== undefined) {
      formData.append('category', String(modelInfo['category'] ?? ''));
    }
    if (modelInfo['habitat'] !== undefined) {
      formData.append('habitat', String(modelInfo['habitat'] ?? ''));
    }
    if (modelInfo['display_order'] !== undefined && modelInfo['display_order'] !== null) {
      formData.append('display_order', String(Number(modelInfo['display_order'])));
    }

    if (modelInfo['model_url']) {
      formData.append('model_url', modelInfo['model_url'] as Blob);
    }
    if (modelInfo['icon_url']) {
      formData.append('icon_url', modelInfo['icon_url'] as Blob);
    }

    this.virtualAssetService.createVirtualAsset(formData).subscribe({
      next: () => {
        this.alertService.showAlert('Modelo creado correctamente', 'success', 2000);
        this.loadData(this.currentLoadType);
      },
      error: (err) => {
        const errorMsg = err?.error?.message || 'Error al crear el modelo virtual';
        this.alertService.showAlert(errorMsg, 'error', 3000);
      }
    });
  }
}
