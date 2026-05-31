import { Component, inject, Input, ViewChild, PLATFORM_ID, Inject, AfterViewInit, OnInit } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatPaginator, MatPaginatorIntl, MatPaginatorModule } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AlertService } from '../../../core/services/alert.service';
import { ApiRoutesService } from '../../../core/services/api-routes.service';

import { CreateDialogComponent, DialogData } from '../../modal-dialogs/create-dialog';
import { ModelViewerComponent } from '../../../features/virtual-assets/components/model-viewer/model-viewer.component';
import { getSpanishPaginatorIntl } from '../data-table/spanish-paginator-intl';

/** Tipos de datos que puede cargar la tabla */
export type TableDataType = 'users' | 'anchorPoints' | 'virtualAssets';

/** Estados de filtro para registros activos/inactivos */
export type StatusFilter = 'active' | 'inactive' | 'all';

/** Tipo unión para los elementos de la tabla */
export type TableElement = any;

/**
 * Componente base abstracto para tablas CRUD
 * Proporciona funcionalidad común para filtrado, paginación y diálogos
 */
@Component({
  selector: 'base-table',
  templateUrl: './base-table.component.html',
  styleUrls: ['./base-table.component.scss'],
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
  ],
  providers: [
    { provide: MatPaginatorIntl, useValue: getSpanishPaginatorIntl() }
  ]
})
export abstract class BaseTableComponent<T = any> implements OnInit, AfterViewInit {
  protected _snackBar = inject(MatSnackBar);
  protected readonly dialog = inject(MatDialog);
  public readonly apiRoutes = inject(ApiRoutesService);
  protected readonly alertService = inject(AlertService);
  protected readonly http = inject(HttpClient);
  protected readonly isBrowser: boolean;

  // Propiedades de la tabla
  dataSource = new MatTableDataSource<any>();
  displayedColumns: string[] = [];
  columnNames: { [key: string]: string | undefined } = {};

  @ViewChild(MatPaginator, { static: false }) paginator!: MatPaginator;
  @Input() highlightedId: string | null = null;

  // Estado de la tabla
  public isLoading = false;
  public selectedStatus: StatusFilter = 'active';
  public currentLoadType!: TableDataType;

  // Filtrado por ID desde dashboard
  public isFilteredById = false;
  private allData: T[] = [];

  constructor(@Inject(PLATFORM_ID) platformId: object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.onComponentInit();
    // Disparar carga inicial de datos después de la inicialización del componente
    if (this.currentLoadType) {
      this.loadData(this.currentLoadType);
    }
  }

  ngAfterViewInit(): void {
    this.setupFilterPredicate();
  }

  /**
   * Hook para inicialización específica del componente hijo
   */
  protected onComponentInit(): void {
    // Override en componentes hijos si necesario
  }

  /**
   * Carga los datos según el tipo especificado
   */
  public abstract loadData(type: TableDataType): void;

  /**
   * Devuelve los nombres de las columnas para el tipo actual
   */
  protected abstract getColumnNames(): { [key: string]: string };

  /**
   * Devuelve las columnas a mostrar para el tipo actual
   */
  protected abstract getDisplayedColumns(): string[];

  /**
   * Devuelve los campos en los que buscar según el tipo de datos
   */
  protected abstract getSearchFields(): string[];

  /**
   * Construye el diálogo de edición para el elemento
   */
  protected abstract buildEditDialog(element: any): DialogData;

  /**
   * Construye el diálogo de creación
   */
  protected abstract buildCreateDialog(): DialogData;

  /**
   * Procesa el resultado de edición
   */
  protected abstract processEditResult(result: Record<string, Record<string, unknown>>, element: any): void;

  /**
   * Procesa el resultado de creación
   */
  protected abstract processCreateResult(result: Record<string, Record<string, unknown>>): void;

  /**
   * Define las columnas visibles dinámicamente
   */
  protected setDisplayedColumns(data: T[]): void {
    if (!data || data.length === 0) return;

    this.displayedColumns = this.getDisplayedColumns();
    this.columnNames = this.getColumnNames();
  }

  /**
   * Configura el predicado de filtrado (solo búsqueda de texto, el estado se filtra en el backend)
   */
  protected setupFilterPredicate(): void {
    this.dataSource.filterPredicate = (data: any, filter: string) => {
      const searchText = filter.trim().toLowerCase();
      if (!searchText) return true;

      const fieldsToSearch = this.getSearchFields();
      return fieldsToSearch.some(field =>
        (data[field] || '').toString().toLowerCase().includes(searchText)
      );
    };
  }

  /**
   * Aplica filtro de estado (activo/inactivo/todos) — recarga datos desde el backend
   */
  public applyStatusFilter(): void {
    this.loadData(this.currentLoadType);
  }

  /**
   * Convierte el filtro de estado seleccionado a un booleano para el backend
   * @returns undefined si es 'all', true si es 'active', false si es 'inactive'
   */
  protected getIsActiveFilter(): boolean | undefined {
    if (this.selectedStatus === 'all') return undefined;
    return this.selectedStatus === 'active';
  }

  /**
   * Aplica filtro de búsqueda de texto
   */
  public applyFilter(filterValue: string): void {
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  /**
   * Devuelve el placeholder del campo de búsqueda
   */
  get searchPlaceholder(): string {
    switch (this.currentLoadType) {
      case 'users':
        return 'Nombre de usuario | Correo | Nombres';
      case 'anchorPoints':
        return 'Nombre del punto | Descripción';
      case 'virtualAssets':
        return 'Nombre del modelo | Descripción';
      default:
        return 'Buscar...';
    }
  }

  /**
   * Ordena elementos por fecha de actualización (más reciente primero)
   */
  protected sortByUpdated(a: any, b: any): number {
    const dateA = new Date(a.updated_at ?? a.updatedAt).getTime();
    const dateB = new Date(b.updated_at ?? b.updatedAt).getTime();
    return dateB - dateA;
  }

  /**
   * Configura el datasource con datos y paginador
   */
  protected setupDataSource(data: T[]): void {
    this.allData = data;

    // Si hay un ID resaltado, filtrar a solo ese registro
    if (this.highlightedId) {
      const filtered = data.filter((item: any) => item.id === this.highlightedId);
      if (filtered.length > 0) {
        this.isFilteredById = true;
        this.dataSource = new MatTableDataSource(filtered);
      } else {
        this.isFilteredById = false;
        this.dataSource = new MatTableDataSource(data);
      }
    } else {
      this.isFilteredById = false;
      this.dataSource = new MatTableDataSource(data);
    }

    this.setDisplayedColumns(data);
    this.setupFilterPredicate();

    setTimeout(() => {
      this.dataSource.paginator = this.paginator;
    });

    this.isLoading = false;
  }

  /**
   * Limpia el filtro por ID y muestra todos los registros
   */
  public clearIdFilter(): void {
    this.isFilteredById = false;
    this.highlightedId = null;
    this.loadData(this.currentLoadType);
  }

  /**
   * Abre el diálogo de edición
   */
  public onEdit(element: any): void {
    const dialogData = this.buildEditDialog(element);
    this.openEditDialog(dialogData, element);
  }

  /**
   * Abre el diálogo de creación
   */
  public openDialog(): void {
    const dialogData = this.buildCreateDialog();
    const dialogRef = this.dialog.open(CreateDialogComponent, {
      data: dialogData,
    });

    dialogRef.afterClosed().subscribe((result: any) => {
      if (result) {
        this.processCreateResult(result);
      }
    });
  }

  /**
   * Abre el diálogo de edición y procesa el resultado
   */
  protected openEditDialog(dialogData: DialogData, element: any): void {
    const dialogRef = this.dialog.open(CreateDialogComponent, {
      data: dialogData,
    });

    dialogRef.afterClosed().subscribe((result: Record<string, Record<string, unknown>> | null) => {
      if (!result) return;
      this.processEditResult(result, element);
    });
  }

  /**
   * Abre el visor de modelos 3D
   */
  protected openModelViewer(modelUrl: string): void {
    this.dialog.open(ModelViewerComponent, {
      width: '80%',
      height: '80%',
      data: { modelUrl }
    });
  }

  /**
   * Verifica si hay contenido proyectado para una columna específica
   * Se sobreescribe en componentes hijos que necesiten columnas personalizadas
   */
  protected hasColumnContent(column: string): boolean {
    return false;
  }

  /**
   * Copia texto al portapapeles
   */
  public copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this.openSnackBar('¡Enlace copiado al portapapeles!', 'Aceptar');
    }).catch(() => {
      this.alertService.showAlert('Error al copiar al portapapeles', 'error', 2000);
    });
  }

  /**
   * Muestra un snackbar
   */
  protected openSnackBar(message: string, action: string): void {
    this._snackBar.open(message, action);
  }
}
