import { Component, inject, Inject, PLATFORM_ID, OnInit, Input } from '@angular/core';
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
import { AnchorPointService } from '../../services/anchor-point.service';
import { VirtualAssetService } from '../../../virtual-assets/services/virtual-asset.service';
import { AnchorPoint, ParkSection } from '../../models/anchor-point.model';
import { VirtualAsset, VirtualAssetDTO } from '../../../virtual-assets/models/virtual-asset.model';
import { DialogData } from '../../../../shared/modal-dialogs/create-dialog';

/**
 * Componente de tabla para gestión de puntos de anclaje
 * Extiende BaseTableComponent con funcionalidad específica de anchor points
 */
@Component({
  selector: 'anchor-table',
  templateUrl: './anchor-table.component.html',
  styleUrls: ['../../../../shared/controls/base-table/base-table.component.scss', './anchor-table.component.scss'],
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
export class AnchorTableComponent extends BaseTableComponent implements OnInit {
  private readonly anchorPointService = inject(AnchorPointService);
  private readonly virtualAssetService = inject(VirtualAssetService);

  @Input() sectionFilter: string | null = null;
  isFilteredBySection = false;
  private allAnchorData: AnchorPoint[] = [];

  virtualAssetsData: VirtualAsset[] = [];

  readonly sectionOptions = [
    { value: '1', label: 'Tierras Altas' },
    { value: '2', label: 'Tierras Medias' },
    { value: '3', label: 'Tierras Bajas' },
    { value: '4', label: 'Mitos y Leyendas' },
    { value: 'Tierras Altas', label: 'Tierras Altas' },
    { value: 'Tierras Medias', label: 'Tierras Medias' },
    { value: 'Tierras Bajas', label: 'Tierras Bajas' },
    { value: 'Mitos y Leyendas', label: 'Mitos y Leyendas' }
  ];

  private readonly sectionNameToCode: Record<string, string> = {
    'Tierras Altas': '1',
    'Tierras Medias': '2',
    'Tierras Bajas': '3',
    'Mitos y Leyendas': '4'
  };

  private readonly sectionCodeToName: Record<string, string> = {
    '1': 'Tierras Altas',
    '2': 'Tierras Medias',
    '3': 'Tierras Bajas',
    '4': 'Mitos y Leyendas'
  };

  readonly anchorPointColumnNames = {
    name: 'Nombre del Punto',
    latitude: 'Latitud',
    longitude: 'Longitud',
    virtualAssetId: 'Modelo asociado',
    active: 'Activo',
    edit: 'Editar',
    section: 'Sección',
    showInMap: 'Mostrar en Mapa',
  };

  constructor(@Inject(PLATFORM_ID) platformId: object) {
    super(platformId);
    this.currentLoadType = 'anchorPoints';
  }

  override ngOnInit(): void {
    super.ngOnInit();
    if (this.isBrowser) {
      this.virtualAssetService.getAllVirtualAssets().subscribe(assets => {
        this.virtualAssetsData = assets;
      });
    }
  }

  public override loadData(type: TableDataType): void {
    if (!this.isBrowser) return;

    this.isLoading = true;
    this.currentLoadType = type;

    if (type !== 'anchorPoints') {
      console.warn('AnchorTableComponent solo debería cargar datos de tipo "anchorPoints"');
      return;
    }

    this.anchorPointService.getAllAnchorPoints(this.getIsActiveFilter()).subscribe((anchorPoints: AnchorPoint[]) => {
      const sortedAnchorPoints = anchorPoints.sort(this.sortByUpdated);
      this.allAnchorData = sortedAnchorPoints;

      if (this.sectionFilter) {
        // Normalize filter: accept both numeric codes ('1') and full names ('Tierras Altas')
        const filterName = this.sectionCodeToName[this.sectionFilter] || this.sectionFilter;
        const filterCode = this.sectionNameToCode[this.sectionFilter] || this.sectionFilter;
        const filtered = sortedAnchorPoints.filter(ap =>
          ap.section === filterCode || ap.section === filterName
        );
        this.isFilteredBySection = true;
        this.setupDataSource(filtered);
      } else {
        this.isFilteredBySection = false;
        this.setupDataSource(sortedAnchorPoints);
      }
    });
  }

  protected getColumnNames(): { [key: string]: string } {
    return this.anchorPointColumnNames;
  }

  protected getDisplayedColumns(): string[] {
    return [
      'name', 'latitude', 'longitude',
      'section', 'showInMap', 'virtualAssetId', 'active', 'edit'
    ];
  }

  protected getSearchFields(): string[] {
    return ['name'];
  }

  /**
   * Limpia el filtro por sección y muestra todos los registros
   */
  public clearSectionFilter(): void {
    this.isFilteredBySection = false;
    this.sectionFilter = null;
    this.setupDataSource(this.allAnchorData);
  }

  /**
   * Obtiene la etiqueta de la sección según el valor
   */
  public getSectionLabel(value: string | null | undefined): string {
    if (!value) return '–';
    // Handle both numeric codes and full names
    const nameFromCode = this.sectionCodeToName[value];
    if (nameFromCode) return nameFromCode;
    // Check if it's already a full name
    if (this.sectionNameToCode[value]) return value;
    const opt = this.sectionOptions.find(o => o.value === value);
    return opt ? opt.label : value;
  }

  /**
   * Obtiene un activo virtual por su ID
   */
  public getVirtualAssetById(id: string): VirtualAssetDTO | undefined {
    return this.virtualAssetsData.find(a => a.id === id);
  }

  /**
   * Maneja el cambio de modelo virtual asociado a un punto de anclaje
   */
  public onVirtualAssetChange(anchor: AnchorPoint, newAssetId: string): void {
    anchor.virtualAssetId = newAssetId;
    this.anchorPointService.updateAnchorPoint(anchor.id, anchor).subscribe({
      next: () => {
        this.alertService.showAlert('Modelo actualizado', 'success', 1500);
      },
      error: () => {
        this.alertService.showAlert('Error al actualizar el modelo', 'error', 2000);
      }
    });
  }

  protected buildEditDialog(element: AnchorPoint): DialogData {
    return {
      groups: {
        anchorInfo: {
          label: 'Editar Información del Punto de Anclaje',
          controls: {
            pointName: {
              type: 'text',
              label: 'Nombre del Punto',
              enabled: true,
              defaultValue: element?.name,
              allowWhitespaces: true
            },
            latitude: {
              type: 'text',
              label: 'Latitude',
              enabled: false,
              defaultValue: element?.latitude
            },
            longitude: {
              type: 'text',
              label: 'Longitude',
              enabled: false,
              defaultValue: element?.longitude
            },
            virtualAssetId: {
              type: 'select',
              label: 'Modelo Asociado',
              enabled: true,
              options: this.virtualAssetsData.map(asset => ({
                value: asset.id,
                label: asset.name
              })),
              defaultValue: element?.virtualAssetId || ''
            },
            section: {
              type: 'select',
              label: 'Sección',
              options: [
                { value: '1', label: 'Tierras Altas' },
                { value: '2', label: 'Tierras Medias' },
                { value: '3', label: 'Tierras Bajas' },
                { value: '4', label: 'Mitos y Leyendas' }
              ],
              enabled: true,
              defaultValue: element.section
            },
            showInMap: {
              type: 'toggle',
              label: 'Mostrar en Mapa',
              enabled: true,
              defaultValue: element.showInMap ?? true
            },
            active: {
              type: 'toggle',
              label: 'Activo',
              enabled: true,
              defaultValue: element?.active
            },
          }
        },
      },
      titleText: 'Editar Información del Punto de Anclaje',
    };
  }

  protected buildCreateDialog(): DialogData {
    return {
      groups: {
        anchorInfo: {
          controls: {
            pointName: {
              type: 'text',
              label: 'Nombre del Punto',
              enabled: true,
            },
            coordinates: {
              type: 'text',
              inputType: 'number',
              label: 'Latitude',
              enabled: true,
            },
            longitude: {
              type: 'text',
              inputType: 'number',
              label: 'Longitude',
              enabled: true,
            },
          },
          hint: {
            type: 'info',
            message: 'Ingrese las coordenadas GPS y el nombre del punto de anclaje.'
          }
        },
      },
      customClass: 'anchor-info-dialog',
      titleText: 'Añadir Punto de Anclaje'
    };
  }

  protected processEditResult(result: Record<string, Record<string, unknown>>, element: AnchorPoint): void {
    const anchorInfo = result['anchorInfo'];
    const sectionValue = anchorInfo['section'] as string;
    const validSection: ParkSection | undefined =
      (sectionValue === '1' || sectionValue === '2' || sectionValue === '3' || sectionValue === '4')
        ? sectionValue as ParkSection
        : undefined;

    const updatedAnchor = new AnchorPoint({
      ...element,
      name: String(anchorInfo['pointName'] ?? ''),
      latitude: anchorInfo['latitude'] as number,
      longitude: anchorInfo['longitude'] as number,
      virtualAssetId: String(anchorInfo['virtualAssetId'] ?? ''),
      active: Boolean(anchorInfo['active']),
      section: validSection,
      showInMap: Boolean(anchorInfo['showInMap']),
      updatedAt: new Date()
    });

    this.anchorPointService.updateAnchorPoint(element.id, updatedAnchor).subscribe({
      next: () => {
        this.alertService.showAlert('Punto de anclaje editado correctamente', 'success', 2000);
        this.loadData(this.currentLoadType);
      },
      error: () => {
        this.alertService.showAlert('Error al editar punto de anclaje', 'error', 2000);
      }
    });
  }

  protected processCreateResult(result: Record<string, Record<string, unknown>>): void {
    const anchorInfo = result['anchorInfo'];

    const dataToSave = new AnchorPoint({
      name: String(anchorInfo['pointName']),
      latitude: parseFloat(String(anchorInfo['coordinates']).split(',')[0].trim()),
      longitude: parseFloat(String(anchorInfo['coordinates']).split(',')[1].trim()),
      createdAt: new Date(),
      updatedAt: new Date(),
      active: true
    });

    this.anchorPointService.createAnchorPoint(dataToSave).subscribe({
      next: () => {
        this.alertService.showAlert('Punto de Anclaje creado correctamente', 'success', 2000);
        this.loadData(this.currentLoadType);
      },
      error: () => {
        this.alertService.showAlert('Error al crear el Punto de Anclaje', 'error', 2000);
      }
    });
  }
}
