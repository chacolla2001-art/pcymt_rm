import { Component, inject, Input, OnInit, ViewChild, PLATFORM_ID, Inject } from '@angular/core';
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

import { UserService } from '../../../core/services/user.service';
import { AnchorPointService } from '../../../core/services/anchor-point.service';
import { VirtualAssetService } from '../../../core/services/virtual-asset.service';
import { AlertService } from '../../../core/services/alert.service';
import { ApiRoutesService } from '../../../core/services/api-routes.service';

import { User } from '../../../core/models/user.model';
import { AnchorPoint, ParkSection } from '../../../core/models/anchor-point.model';
import { VirtualAsset, VirtualAssetDTO } from '../../../core/models/virtual-asset.model';

import { CreateDialogComponent, DialogData } from '../../modal-dialogs/create-dialog';
import { ModelViewerComponent } from '../../../features/model-viewer/model-viewer.component';
import { getSpanishPaginatorIntl } from './spanish-paginator-intl';

/** Tipos de datos que puede cargar la tabla */
export type TableDataType = 'users' | 'anchorPoints' | 'virtualAssets';

/** Estados de filtro para registros activos/inactivos */
export type StatusFilter = 'active' | 'inactive' | 'all';

/** Tipo unión para los elementos de la tabla */
export type TableElement = User | AnchorPoint | VirtualAsset;

/**
 * Componente de tabla genérica para CRUD
 * Soporta usuarios, puntos de anclaje y activos virtuales
 */
@Component({
  selector: 'table-control',
  templateUrl: './table.html',
  styleUrls: ['./table.css'],
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
export class TableControl implements OnInit {
  private _snackBar = inject(MatSnackBar);
  columnNames: { [key: string]: string | undefined } = {
    username: 'Nombre de Usuario',
    email: 'Correo Electrónico',
    role: 'Rol',
    is_active: 'Activo',
    edit: 'Editar',
    play: 'Reproducir',
    species: 'Sector',
    name: 'Nombre',
    description: 'Descripción'
  };
  readonly dialog = inject(MatDialog);
  dataSource = new MatTableDataSource<any>();
  displayedColumns: string[] = ['username', 'email', 'active', 'edit', 'play'];
  @ViewChild(MatPaginator, { static: false }) paginator!: MatPaginator;

  currentLoadType!: 'users' | 'anchorPoints' | 'virtualAssets';
  selectedStatus: 'active' | 'inactive' | 'all' = 'active';
  public apiRoutes = inject(ApiRoutesService);
// 1) Opciones de sección
  readonly sectionOptions = [
    { value: '1', label: 'Altiplano' },
    { value: '2', label: 'Valles'    },
    { value: '3', label: 'Llanos'    }
  ];

  // 2) Método para traducir
  getSectionLabel(value: string | null | undefined): string {
    if (!value) return '–';
    const opt = this.sectionOptions.find(o => o.value === value);
    return opt ? opt.label : '–';
  }

  applyStatusFilter(): void {
    this.dataSource.filterPredicate = (data: any, filter: string) => {
      const searchText = filter.trim().toLowerCase();

      // Support both 'is_active' (User, VirtualAsset) and 'active' (AnchorPoint)
      const isActive = 'is_active' in data ? data.is_active : data.active;
      const statusMatch =
        this.selectedStatus === 'all' ||
        (this.selectedStatus === 'active' && isActive === true) ||
        (this.selectedStatus === 'inactive' && isActive === false);

      const fieldsToSearch = ['username', 'email'];

      const textMatch = fieldsToSearch.some(field =>
        (data[field] || '').toString().toLowerCase().includes(searchText)
      );

      return statusMatch && textMatch;
    };
    this.dataSource.filter = this.dataSource.filter || ''; // mantiene el texto actual
  }


  public isLoading = false;

  virtualAssetsData: VirtualAsset[] = [];
  private readonly isBrowser: boolean;

  @Input() highlightedId: string | null = null;
  constructor(
    private userService: UserService,
    private anchorPointService: AnchorPointService,
    private virtualAssetService: VirtualAssetService,
    private http: HttpClient,
    private alertService: AlertService,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }



  onVirtualAssetChange(anchor: AnchorPoint, newAssetId: string): void {
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
  private sortByUpdated(a: any, b: any): number {
    const dateA = new Date(a.updated_at ?? a.updatedAt).getTime();
    const dateB = new Date(b.updated_at ?? b.updatedAt).getTime();
    return dateB - dateA;
  }

  ngOnInit() {
    // Solo cargar datos en el navegador (no en SSR)
    if (!this.isBrowser) return;

    this.virtualAssetService.getAllVirtualAssets().subscribe(assets => {
      this.virtualAssetsData = assets;
    });
  }
  //dg
  openSnackBar(message: string, action: string) {
    this._snackBar.open(message, action);
  }
  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this.openSnackBar('¡Enlace copiado al portapapeles!', 'Aceptar');
    }).catch(() => {
      this.alertService.showAlert('Error al copiar al portapapeles', 'error', 2000);
    });
  }
  ngAfterViewInit() {
    this.dataSource.filterPredicate = (data: any, filter: string) => {
      const searchText = filter.trim().toLowerCase();

      // Support both 'is_active' (User, VirtualAsset) and 'active' (AnchorPoint)
      const isActive = 'is_active' in data ? data.is_active : data.active;
      const statusMatch =
        this.selectedStatus === 'all' ||
        (this.selectedStatus === 'active' && isActive === true) ||
        (this.selectedStatus === 'inactive' && isActive === false);

      // Campos por tipo de dato
      const fieldsToSearch =
        this.currentLoadType === 'users'
          ? ['username', 'email']
          : this.currentLoadType === 'anchorPoints'
          ? ['name', 'description']
          : this.currentLoadType === 'virtualAssets'
          ? ['name', 'description']
          : [];

      const textMatch = fieldsToSearch.some(field =>
        (data[field] || '').toString().toLowerCase().includes(searchText)
      );

      return statusMatch && textMatch;
    };
  }
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

  search(){

  }
  public loadData(type: 'users' | 'anchorPoints' | 'virtualAssets') {
    // Solo cargar datos en el navegador (no en SSR)
    if (!this.isBrowser) {
      return;
    }

    this.isLoading = true;
    this.currentLoadType = type;

    switch (type) {
      case 'users':
        this.userService.getAllUsers().subscribe((users: User[]) => {
          const sortedUsers = users.sort((a, b) => {
            const dateA = new Date(a.updated_at || '').getTime();
            const dateB = new Date(b.updated_at || '').getTime();
            return dateB - dateA;
          });

          this.dataSource = new MatTableDataSource(sortedUsers);
          this.setDisplayedColumns(sortedUsers);

          this.dataSource.filterPredicate = (data: any, filter: string) => {
            const searchText = filter.trim().toLowerCase();
            const isActive = 'is_active' in data ? data.is_active : data.active;
            const statusMatch =
              this.selectedStatus === 'all' ||
              (this.selectedStatus === 'active' && isActive === true) ||
              (this.selectedStatus === 'inactive' && isActive === false);

            const fieldsToSearch = ['username', 'email'];
            const textMatch = fieldsToSearch.some(field =>
              (data[field] || '').toString().toLowerCase().includes(searchText)
            );

            return statusMatch && textMatch;
          };

          setTimeout(() => {
            this.dataSource.paginator = this.paginator;
            this.applyStatusFilter();
          });

          this.isLoading = false;
        });
        break;

      case 'anchorPoints':
        this.anchorPointService.getAllAnchorPoints().subscribe((anchorPoints: AnchorPoint[]) => {
          const sortedAnchorPoints = anchorPoints.sort(this.sortByUpdated);
          this.dataSource = new MatTableDataSource(sortedAnchorPoints);
          this.setDisplayedColumns(sortedAnchorPoints);

          this.dataSource.filterPredicate = (data: any, filter: string) => {
            const searchText = filter.trim().toLowerCase();
            const isActive = 'is_active' in data ? data.is_active : data.active;
            const statusMatch =
              this.selectedStatus === 'all' ||
              (this.selectedStatus === 'active' && isActive === true) ||
              (this.selectedStatus === 'inactive' && isActive === false);

            const fieldsToSearch = ['name', 'description'];
            const textMatch = fieldsToSearch.some(field =>
              (data[field] || '').toString().toLowerCase().includes(searchText)
            );

            return statusMatch && textMatch;
          };

          setTimeout(() => {
            this.dataSource.paginator = this.paginator;
            this.applyStatusFilter();
          });

          this.isLoading = false;
        });
        break;

      case 'virtualAssets':
        this.virtualAssetService.getAllVirtualAssets().subscribe((assets: VirtualAsset[]) => {
          const sortedAssets = assets.sort(this.sortByUpdated);
          this.virtualAssetsData = sortedAssets;
          this.dataSource = new MatTableDataSource(sortedAssets);
          this.setDisplayedColumns(sortedAssets);

          this.dataSource.filterPredicate = (data: any, filter: string) => {
            const searchText = filter.trim().toLowerCase();
            const isActive = 'is_active' in data ? data.is_active : data.active;
            const statusMatch =
              this.selectedStatus === 'all' ||
              (this.selectedStatus === 'active' && isActive === true) ||
              (this.selectedStatus === 'inactive' && isActive === false);

            const fieldsToSearch = ['name', 'description'];
            const textMatch = fieldsToSearch.some(field =>
              (data[field] || '').toString().toLowerCase().includes(searchText)
            );

            return statusMatch && textMatch;
          };

          setTimeout(() => {
            this.dataSource.paginator = this.paginator;
            this.applyStatusFilter();
          });

          this.isLoading = false;
        });
        break;
    }
  }



   // Cambiar el estado 'activo' del usuario
   toggleActive(user: User) {
    const updatedUser = { ...user, active: !user.is_active };
    this.userService.toggleUserActive(user.id, updatedUser.active).subscribe(() => {
      user.is_active = updatedUser.active; // Actualiza el estado localmente
    });
  }


  applyFilter(filterValue: string): void {
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }



  readonly userColumns = [
    'username', 'email', 'role', 'is_active', 'edit'
  ];

  readonly userColumnNames = {
    username: 'Nombre de usuario',
    email: 'Correo electrónico',
    role: 'Rol',
    is_active: 'Activo',
    edit: 'Editar'
  };

  readonly anchorPointColumnNames = {
    name: 'Nombre del Punto',
    description: 'Descripción',
    latitude: 'Latitud',
    longitude: 'Longitud',
    virtualAssetId: 'Modelo asociado',
    active: 'Activo',
    edit: 'Editar',
    section: 'Sección',
    showInMap: 'Mostrar en Mapa',
  };

  readonly virtualAssetColumnNames = {
    name: 'Nombre del modelo',
    description: 'Descripción',
    is_active: 'Activo',
    icon_url: 'Icono',
    play: 'Ver Modelo',
    edit: 'Editar'
  };

  getVirtualAssetById(id: string): VirtualAssetDTO | undefined {
    return this.virtualAssetsData.find(a => a.id === id);
  }


  // Método para definir las columnas visibles dinámicamente
  setDisplayedColumns(data: any[]) {
    if (!data || data.length === 0) return;

    this.displayedColumns = [];

    if (this.currentLoadType === 'users') {
      this.displayedColumns = this.userColumns;
      this.columnNames = this.userColumnNames;
    }

    if (this.currentLoadType === 'anchorPoints') {
      this.displayedColumns = [
      'name','description','latitude','longitude',
      'section','showInMap','virtualAssetId','active','edit'
      ];
      this.columnNames = this.anchorPointColumnNames;
    }

    if (this.currentLoadType === 'virtualAssets') {
      this.displayedColumns = ['name', 'description', 'is_active', 'icon_url', 'play', 'edit'];
      this.columnNames = this.virtualAssetColumnNames;
    }
  }



  async checkEmailExistsForEdit(currentValue: string, newValue: string): Promise<boolean> {
    if (currentValue === newValue) {
      return(true); // Si no cambió, no existe duplicado.
    } else {
      const result = await this.userService.checkEmailExists(newValue).toPromise();
      if (result?.exists) {
      this.alertService.showAlert('El correo electrónico ya está registrado.', 'error', 2000);
      return false;
      }
    return true;
    }


  }

  async checkUsernameExistsForEdit(currentValue: string, newValue: string): Promise<boolean> {

    if (currentValue === newValue) {
      return(true); // Si no cambió, no existe duplicado.
    } else {
      const result = await this.userService.checkUsernameExists(newValue).toPromise();
      if (result?.exists) {
        this.alertService.showAlert('El nombre de usuario ya está registrado.', 'error', 2000);
        return false;
      }

      return true;
    }
  }


  /** Abre el diálogo de edición para el elemento seleccionado */
  onEdit(element: User | AnchorPoint | VirtualAsset): void {
    let dialogData: DialogData;

    switch (this.currentLoadType) {
      case 'users':
        dialogData = this.buildUserEditDialog(element as User);
        break;
      case 'anchorPoints':
        dialogData = this.buildAnchorPointEditDialog(element as AnchorPoint);
        break;
      case 'virtualAssets':
        dialogData = this.buildVirtualAssetEditDialog(element as VirtualAsset);
        break;
      default:
        return;
    }

    this.openEditDialog(dialogData, element);
  }

  /** Construye la configuración del diálogo para editar usuarios */
  private buildUserEditDialog(element: User): DialogData {
    return {
          groups: {
            userInfo: {
              controls: {
                username: {
                  type: 'text',
                  label: 'Nombre de Usuario',
                  enabled: false,
                  inputType: 'username',
                  defaultValue: element?.username,
                  maxLength: 50
                },
                email: {
                  type: 'text',
                  label: 'Correo Electrónico',
                  enabled: false,
                  inputType: 'email',
                  defaultValue: element?.email,
                  maxLength: 50
                },
                role: {
                  type: 'select',
                  label: 'Rol',
                  options: [
                    { value: 'admin', label: 'Administrador' },
                    { value: 'user', label: 'Visitante' },
                    { value: 'moderator', label: 'Moderador' }
                  ],
                  enabled: true,
                  defaultValue: element?.role
                },
                is_active: {
                  type: 'toggle',
                  label: 'Activo',
                  enabled: true,
                  defaultValue: element?.is_active
                }
              },
              hint: {
                type: 'info',
                message: 'La contraseña debe tener al menos 12 caracteres e incluya una combinación de letras mayúsculas y minúsculas, números y símbolos'
              }
            },
          },
          methods: [
            {
              fn: this.checkEmailExistsForEdit.bind(this, element?.email),
              params: ['userInfo.email'], // Valida el correo en edición
            },
            {
              fn: this.checkUsernameExistsForEdit.bind(this, element?.username),
              params: ['userInfo.username'], // Valida el nombre de usuario en edición
            },
          ],
          titleText: 'Editar información del usuario',
        };
  }

  /** Construye la configuración del diálogo para editar puntos de anclaje */
  private buildAnchorPointEditDialog(element: AnchorPoint): DialogData {
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
                  allowWhitespaces:true
                },
                description: {
                  type: 'textarea',
                  label: 'Descripción',
                  enabled: true,
                  defaultValue: element?.description,
                  allowWhitespaces:true
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
                  { value: '1', label: 'Altiplano' },
                  { value: '2', label: 'Valles' },
                  { value: '3', label: 'Llanos' }
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

  /** Construye la configuración del diálogo para editar activos virtuales */
  private buildVirtualAssetEditDialog(element: VirtualAsset): DialogData {
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

  /** Abre el diálogo de edición y procesa el resultado */
  private openEditDialog(dialogData: DialogData, element: User | AnchorPoint | VirtualAsset): void {
    const dialogRef = this.dialog.open(CreateDialogComponent, {
      data: dialogData,
    });

    dialogRef.afterClosed().subscribe((result: Record<string, Record<string, unknown>> | null) => {
      if (!result) return;

      this.processEditResult(result, element);
    });
  }

  /** Procesa el resultado del diálogo de edición */
  private processEditResult(result: Record<string, Record<string, unknown>>, element: User | AnchorPoint | VirtualAsset): void {
    switch (this.currentLoadType) {
      case 'users':
        this.updateUser(result, element as User);
        break;
      case 'anchorPoints':
        this.updateAnchorPoint(result, element as AnchorPoint);
        break;
      case 'virtualAssets':
        this.updateVirtualAsset(result, element as VirtualAsset);
        break;
    }
  }

  /** Actualiza un usuario */
  private updateUser(result: Record<string, Record<string, unknown>>, element: User): void {
    const userInfo = result['userInfo'];
    const formData = new FormData();

    formData.append('username', String(userInfo['username'] ?? ''));
    formData.append('email', String(userInfo['email'] ?? ''));
    formData.append('role', String(userInfo['role'] ?? '').toLowerCase());
    formData.append('is_active', String(userInfo['is_active'] ?? false));

    this.userService.updateUser(element.id, formData).subscribe({
      next: () => {
        this.alertService.showAlert('Usuario editado correctamente', 'success', 2000);
        this.loadData(this.currentLoadType);
      },
      error: () => {
        this.alertService.showAlert('Error al editar usuario', 'error', 2000);
      }
    });
  }

  /** Actualiza un punto de anclaje */
  private updateAnchorPoint(result: Record<string, Record<string, unknown>>, element: AnchorPoint): void {
    const anchorInfo = result['anchorInfo'];
    const sectionValue = anchorInfo['section'] as string;
    const validSections: string[] = ['Tierras Altas', 'Tierras Medias', 'Tierras Bajas', 'Mitos y Leyendas'];
    const validSection: ParkSection | undefined =
      validSections.includes(sectionValue)
        ? sectionValue as ParkSection
        : undefined;

    const updatedAnchor = new AnchorPoint({
      ...element,
      name: String(anchorInfo['pointName'] ?? ''),
      description: String(anchorInfo['description'] ?? ''),
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

  /** Actualiza un activo virtual */
  private updateVirtualAsset(result: Record<string, Record<string, unknown>>, element: VirtualAsset): void {
    const assetInfo = result['assetInfo'];
    const formData = new FormData();

    formData.append('name', String(assetInfo['name'] ?? ''));
    formData.append('description', String(assetInfo['description'] ?? ''));
    formData.append('is_active', String(assetInfo['is_active'] ?? false));

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


  // Método para manejar el botón "play"
  onPlay(element: any) {
    this.openModelViewer(this.apiRoutes.getModelUrl(element.modelURL));

    // Aquí puedes agregar la lógica para reproducir el modelo 3D o visualizarlo
  }

  openModelViewer(modelUrl: string) {
    this.dialog.open(ModelViewerComponent, {
      width: '80%',
      height: '80%',
      data: { modelUrl } // Pasar el enlace del modelo 3D
    });
  }

  async checkEmailExists(email: string): Promise<boolean> {
    const result = await this.userService.checkEmailExists(email).toPromise();
    if (result?.exists) {
      this.alertService.showAlert('El correo electrónico ya está registrado.', 'error', 2000);
      return false;
    }
    return true;
  }

  async checkUsernameExists(username: string): Promise<boolean> {
    const result = await this.userService.checkUsernameExists(username).toPromise();
    if (result?.exists) {
      this.alertService.showAlert('El nombre de usuario ya está registrado.', 'error', 2000);
      return false;
    }
    return true;
  }


  openDialog() {
    let dialogData: any;

    switch (this.currentLoadType) {
      case 'users':
        dialogData = {
          groups: {
            userInfo: {
              controls: {
                username: { type: 'text', label: 'Nombre de usuario', enabled: true,inputType: 'username',required: true,
                  maxLength: 50 },
                email: { type: 'text', label: 'Correo electrónico', enabled: true,inputType: 'email',required: true,
                  maxLength: 50 },
                role: {
                  type: 'select',
                  label: 'Rol',
                  options: [
                    { value: 'admin', label: 'Administrador' },
                    { value: 'user', label: 'Visitante' },
                    { value: 'moderator', label: 'Moderador' }
                  ],
                  enabled: true
                },
                is_active: { type: 'toggle', label: 'Activo', enabled: true },
              },
              hint: {
                type: 'info',
                message: 'La contraseña del usuario será enviada a su correo electrónico.'
              }
            },
          },
          methods: [
            {
              fn: this.checkEmailExists.bind(this),
              params: ['userInfo.email'] // Valida el correo electrónico
            },
            {
              fn: this.checkUsernameExists.bind(this),
              params: ['userInfo.username'] // Valida el nombre de usuario
            }
          ],
          customClass: 'user-info-dialog',
          titleText: 'Crear un nuevo usuario'

        };

        break;

      case 'anchorPoints':
        dialogData = {
          groups: {
            anchorInfo: {

              controls: {
                pointName: {
                  type: 'text',
                  label: 'Nombre del Punto',
                  enabled: true,
                },
                description: {
                  type: 'text',
                  label: 'Descripción',
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
                message: 'Incluya una descripción detallada del punto de anclaje para facilitar su identificación.'
              }
            },
          },
          customClass: 'anchor-info-dialog',
          titleText: 'Añadir Punto de Anclaje'
        };
        break;

      case 'virtualAssets':
        dialogData = {
          groups: {
            modelInfo: {

              controls: {
                model_name: { type: 'text', label: 'Nombre del modelo', enabled: true, required:true
                  , allowWhitespaces:true
                 },
                description: { type: 'textarea', label: 'Descripción', enabled: true, required:true
                  , allowWhitespaces:true
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
                  required:true
                },
                icon_url: {
                  type: 'file',
                  label: 'Cargar icono',
                  enabled: true,
                  required:true
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
        break;
    }
    const dialogRef = this.dialog.open(CreateDialogComponent, {
      data: dialogData,
    });


    dialogRef.afterClosed().subscribe((result: any) => {
      if (result) {
        let dataToSave;

        switch (this.currentLoadType) {
          case 'users':
           // Convertir el valor del rol a minúsculas
          if (result.userInfo.role) {
            result.userInfo.role = result.userInfo.role.toLowerCase();
          }

          // Crear FormData y agregar la imagen si está presente
          const formData2 = new FormData();
          formData2.append('username', result.userInfo.username);
          formData2.append('email', result.userInfo.email);
          formData2.append('role', result.userInfo.role);
          formData2.append('is_active', result.userInfo.is_active.toString());

          // Crear el nuevo usuario con FormData
          this.userService.createUser(formData2).subscribe({
            next: () => {
              this.alertService.showAlert('Usuario registrado correctamente, la contraseña fue enviada a su correo electrónico', 'success', 2000);
              this.loadData(this.currentLoadType);
            },
            error: () => {
              this.alertService.showAlert('Error al crear usuario', 'error', 2000);
            }
          });
          break;
          case 'anchorPoints':
            dataToSave = new AnchorPoint({
              name: result.anchorInfo.pointName,
              description: result.anchorInfo.description,
              latitude: parseFloat(result.anchorInfo.coordinates.split(',')[0].trim()),
              longitude: parseFloat(result.anchorInfo.coordinates.split(',')[1].trim()),
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
            break;
          case 'virtualAssets':
          const formData = new FormData();
          formData.append('name', String(result.modelInfo.model_name ?? ''));
          formData.append('description', String(result.modelInfo.description ?? ''));
          formData.append('active', String(result.modelInfo.active ?? false));

          if (result.modelInfo.model_url) {
            formData.append('model_url', result.modelInfo.model_url as Blob);
          }
          if (result.modelInfo.icon_url) {
            formData.append('icon_url', result.modelInfo.icon_url as Blob);
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
            break;
        }
      }
    });
  }

}
