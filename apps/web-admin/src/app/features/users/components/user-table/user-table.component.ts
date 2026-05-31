import { Component, inject, Inject, PLATFORM_ID, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTableDataSource } from '@angular/material/table';

import { BaseTableComponent, TableDataType } from '../../../../shared/controls/base-table/base-table.component';
import { UserService } from '../../services/user.service';
import { User } from '../../models/user.model';
import { CreateDialogComponent, DialogData } from '../../../../shared/modal-dialogs/create-dialog';

/**
 * Componente de tabla para gestión de usuarios
 * Extiende BaseTableComponent con funcionalidad específica de usuarios
 */
@Component({
  selector: 'user-table',
  templateUrl: './user-table.component.html',
  styleUrls: ['../../../../shared/controls/base-table/base-table.component.scss', './user-table.component.scss'],
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
    MatProgressSpinnerModule,
    MatTooltipModule
  ]
})
export class UserTableComponent extends BaseTableComponent implements AfterViewInit {
  private readonly userService = inject(UserService);

  // Role filter state
  public selectedRole: string = 'all';
  public readonly roleOptions: { value: string; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'admin', label: 'Administrador' },
    { value: 'moderator', label: 'Moderador' },
    { value: 'user', label: 'Visitante' },
  ];

  readonly userColumns = [
    'name', 'email', 'role', 'is_active', 'actions'
  ];

  readonly userColumnNames = {
    name: 'Nombre',
    email: 'Correo electrónico',
    role: 'Rol',
    is_active: 'Estado',
    actions: 'Acciones'
  };

  // Server-side pagination state
  public currentPage = 1;
  public pageSize = 5;
  public totalCount = 0;
  private currentSearch = '';

  /** Confirmar y eliminar usuario */
  public onDelete(element: User): void {
    const confirmed = window.confirm(`¿Dar de baja al usuario ${element.name || element.email}? La cuenta quedará desactivada y no podrá iniciar sesión.`);
    if (!confirmed) return;
    this.userService.deleteUser(element.id).subscribe({
      next: () => {
        this.alertService.showAlert(`Usuario ${element.name || element.email} eliminado correctamente`, 'success', 3000);
        this.loadData(this.currentLoadType);
      },
      error: () => {
        this.alertService.showAlert('Error al eliminar el usuario', 'error', 2000);
      }
    });
  }

  constructor(@Inject(PLATFORM_ID) platformId: object) {
    super(platformId);
    this.currentLoadType = 'users';
  }

  protected override onComponentInit(): void {
    // Inicialización específica de usuarios si es necesaria
  }

  public override loadData(type: TableDataType): void {
    if (!this.isBrowser) return;

    this.isLoading = true;
    this.currentLoadType = type;

    if (type !== 'users') {
      console.warn('UserTableComponent solo debería cargar datos de tipo "users"');
      return;
    }

    const isActive = this.getIsActiveFilter();
    this.userService.getUsersPaginated({
      page: this.currentPage,
      limit: this.pageSize,
      is_active: isActive,
      search: this.currentSearch || undefined,
      role: this.selectedRole && this.selectedRole !== 'all' ? this.selectedRole : undefined,
    }).subscribe({
      next: (result) => {
        this.totalCount = result.total;
        this.setupDataSource(result.rows);
      },
      error: () => {
        this.isLoading = false;
        this.alertService.showAlert('Error al cargar usuarios', 'error', 2000);
      }
    });
  }

  /** Server-side paginator: handle page changes */
  public onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadData(this.currentLoadType);
  }

  /** Override: set server-side paginator length after loading */
  protected override setupDataSource(data: any[]): void {
    this.dataSource = new MatTableDataSource(data);
    this.setDisplayedColumns(data);
    this.setupFilterPredicate();
    // For server-side pagination: do NOT connect dataSource to paginator
    // (that would override our manual length). Set length directly.
    setTimeout(() => {
      if (this.paginator) {
        this.paginator.length = this.totalCount;
        this.paginator.pageIndex = this.currentPage - 1;
        this.paginator.pageSize = this.pageSize;
      }
    });
    this.isLoading = false;
  }

  /** Override: server-side search */
  public override applyFilter(filterValue: string): void {
    this.currentSearch = filterValue.trim();
    this.currentPage = 1;
    this.loadData(this.currentLoadType);
  }

  /** Override: server-side status filter */
  public override applyStatusFilter(): void {
    this.currentPage = 1;
    this.loadData(this.currentLoadType);
  }

  /** Apply role filter (server-side) */
  public applyRoleFilter(): void {
    this.currentPage = 1;
    this.loadData(this.currentLoadType);
  }

  protected getColumnNames(): { [key: string]: string } {
    return this.userColumnNames;
  }

  protected getDisplayedColumns(): string[] {
    return this.userColumns;
  }

  protected getSearchFields(): string[] {
    return ['name', 'email'];
  }

  /**
   * Abre el diálogo de cambio de contraseña y procesa el resultado
   */
  public onChangePassword(element: User): void {
    const dialogData = this.buildChangePasswordDialog(element);
    const dialogRef = this.dialog.open(CreateDialogComponent, {
      data: dialogData,
    });
    dialogRef.afterClosed().subscribe((result: Record<string, Record<string, unknown>> | null) => {
      if (!result) return;
      this.processChangePasswordResult(result, element);
    });
  }

  /**
   * Valida si un email existe (para creación)
   */
  async checkEmailExists(email: string): Promise<boolean> {
    const result = await this.userService.checkEmailExists(email).toPromise();
    if (result?.exists) {
      this.alertService.showAlert('El correo electrónico ya está registrado.', 'error', 2000);
      return false;
    }
    return true;
  }

  /**
   * Cambia el estado activo/inactivo del usuario
   */
  public toggleActive(user: User): void {
    const updatedUser = { ...user, active: !user.is_active };
    this.userService.toggleUserActive(user.id, updatedUser.active).subscribe(() => {
      user.is_active = updatedUser.active;
    });
  }

  /**
   * Obtiene el icono correspondiente al rol del usuario
   */
  public getRoleIcon(role: string): string {
    const roleIcons: { [key: string]: string } = {
      admin: 'admin_panel_settings',
      moderator: 'manage_accounts',
      user: 'person',
      visitor: 'person_outline'
    };
    return roleIcons[role?.toLowerCase()] || 'person';
  }

  protected buildEditDialog(element: User): DialogData {
    return {
      titleText: 'Editar usuario',
      titleIcon: 'manage_accounts',
      subtitle: `${element?.name || element?.email} · ${element?.email}`,
      showConfirmation: false,
      groups: {
        userInfo: {
          controls: {
            name: {
              type: 'text',
              label: 'Nombre',
              enabled: false,
              inputType: 'text',
              defaultValue: element?.name,
              maxLength: 100
            },
            email: {
              type: 'text',
              label: 'Correo electrónico',
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
                { value: 'moderator', label: 'Moderador' },
                { value: 'user', label: 'Visitante' }
              ],
              enabled: true,
              defaultValue: element?.role,
              required: true
            },
            is_active: {
              type: 'toggle',
              label: 'Cuenta activa',
              enabled: true,
              defaultValue: element?.is_active,
              hint: 'Desactivar impedirá que el usuario inicie sesión'
            }
          },
          hint: {
            type: 'info',
            message: 'Solo se puede modificar el rol y el estado. Para cambiar la contraseña use el botón de clave.'
          }
        },
      },
      submitButtonText: 'Guardar cambios',
      submitButtonIcon: 'save',
    };
  }

  protected buildCreateDialog(): DialogData {
    return {
      titleText: 'Crear nuevo usuario',
      titleIcon: 'person_add',
      groups: {
        userInfo: {
          controls: {
            name: {
              type: 'text',
              label: 'Nombre completo',
              enabled: true,
              inputType: 'text',
              required: false,
              maxLength: 100
            },
            email: {
              type: 'text',
              label: 'Correo electrónico',
              enabled: true,
              inputType: 'email',
              required: true,
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
              defaultValue: 'user',
              required: true
            },
            is_active: {
              type: 'toggle',
              label: 'Cuenta activa',
              enabled: true,
              defaultValue: true
            },
          },
        },
        passwordGroup: {
          label: 'Contraseña inicial',
          icon: 'lock',
          controls: {
            password_hash: {
              type: 'text',
              inputType: 'password',
              label: 'Contraseña',
              enabled: true,
              required: false,
              minLength: 8,
              maxLength: 128,
              hint: 'Min. 8 chars · mayúscula · minúscula · número · símbolo (@$!%*?&_#-.)',
              pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_#\-.])[A-Za-z\d@$!%*?&_#\-.]{8,}$/,
              canGenerate: true,
              showStrength: true,
            },
          },

        },
      },
      methods: [
        {
          fn: this.checkEmailExists.bind(this),
          params: ['userInfo.email']
        }
      ],
      showConfirmation: false,
      customClass: 'user-info-dialog',
      submitButtonText: 'Crear usuario',
      submitButtonIcon: 'person_add',
    };
  }

  protected processEditResult(result: Record<string, Record<string, unknown>>, element: User): void {
    const userInfo = result['userInfo'];
    const formData = new FormData();

    // Solo enviamos los campos editables (role e is_active)
    // username y email NO se incluyen: el backend los ignora y el esquema los rechazaría
    formData.append('role', String(userInfo['role'] ?? '').toLowerCase());
    formData.append('is_active', String(userInfo['is_active'] ?? false));

    this.userService.updateUser(element.id, formData).subscribe({
      next: () => {
        this.alertService.showAlert('Usuario actualizado correctamente', 'success', 2000);
        this.loadData(this.currentLoadType);
      },
      error: () => {
        this.alertService.showAlert('Error al actualizar usuario', 'error', 2000);
      }
    });
  }

  protected buildChangePasswordDialog(element: User): DialogData {
    return {
      titleText: 'Cambiar contraseña',
      titleIcon: 'lock_reset',
      subtitle: `Establecer nueva contraseña para ${element?.name || element?.email}`,
      showConfirmation: false,
      groups: {
        passwordInfo: {
          controls: {
            newPassword: {
              type: 'text',
              inputType: 'password',
              label: 'Nueva contraseña',
              enabled: true,
              required: true,
              minLength: 8,
              maxLength: 128,
              hint: 'Min. 8 chars · mayúscula · minúscula · número · símbolo (@$!%*?&_#-.)',
              pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_#\-.])[A-Za-z\d@$!%*?&_#\-.]{8,}$/,
              canGenerate: true,
              showStrength: true,
            },
            confirmPassword: {
              type: 'text',
              inputType: 'password',
              label: 'Confirmar contraseña',
              enabled: true,
              required: true,
              minLength: 8,
              maxLength: 128,
              hint: 'Repite la contraseña para confirmar',
            }
          },
          hint: {
            type: 'warning',
            message: 'La nueva contraseña se aplica de inmediato. El usuario deberá iniciar sesión nuevamente.'
          }
        },
      },
      methods: [
        {
          fn: this.validatePasswordsMatch.bind(this),
          params: ['passwordInfo.newPassword', 'passwordInfo.confirmPassword']
        }
      ],
      submitButtonText: 'Cambiar contraseña',
      submitButtonIcon: 'lock_reset',
    };
  }

  async validatePasswordsMatch(newPassword: string, confirmPassword: string): Promise<boolean> {
    if (newPassword !== confirmPassword) {
      this.alertService.showAlert('Las contraseñas no coinciden', 'error', 3000);
      return false;
    }
    return true;
  }

  protected processChangePasswordResult(result: Record<string, Record<string, unknown>>, element: User): void {
    const passwordInfo = result['passwordInfo'];
    const newPassword = String(passwordInfo['newPassword'] ?? '');

    this.userService.adminSetPassword(element.id, newPassword).subscribe({
      next: () => {
        this.alertService.showAlert(`Contraseña actualizada para ${element.name || element.email}`, 'success', 3000);
      },
      error: () => {
        this.alertService.showAlert('Error al cambiar la contraseña', 'error', 2000);
      }
    });
  }

  protected processCreateResult(result: Record<string, Record<string, unknown>>): void {
    const userInfo = result['userInfo'];
    const passwordGroup = result['passwordGroup'];

    if (userInfo['role']) {
      userInfo['role'] = String(userInfo['role']).toLowerCase();
    }

    const formData = new FormData();
    formData.append('name', String(userInfo['name'] ?? ''));
    formData.append('email', String(userInfo['email']));
    formData.append('role', String(userInfo['role']));
    formData.append('is_active', String(userInfo['is_active']));
    // Only include password if provided
    const pwd = passwordGroup?.['password_hash'];
    if (pwd && String(pwd).trim().length > 0) {
      formData.append('password_hash', String(pwd));
    }

    this.userService.createUser(formData).subscribe({
      next: () => {
        this.alertService.showAlert('Usuario creado correctamente', 'success', 3000);
        this.loadData(this.currentLoadType);
      },
      error: (err) => {
        if (err?.status === 409) {
          this.alertService.showAlert('El usuario ya existe. Verifique el correo o nombre de usuario.', 'error', 4000);
        } else {
          this.alertService.showAlert('Error al crear usuario', 'error', 2000);
        }
      }
    });
  }
}
