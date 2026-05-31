import { Component, inject, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DrawerService } from '../../../core/services/drawer.service';
import { ThemeManagerService, ThemeMode } from '../../../core/services/theme-manager.service';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog } from '@angular/material/dialog';
import { UserService } from '../../../features/users/services/user.service';
import { AlertService } from '../../../core/services/alert.service';
import { ApiRoutesService } from '../../../core/services/api-routes.service';
import { CreateDialogComponent } from '@shared/modal-dialogs/create-dialog';

/**
 * REFACTORED HeaderComponent
 *
 * Changes:
 * 1. Now emits navigation events instead of calling DashboardService
 * 2. Uses Router for navigation instead of service-based approach
 * 3. More decoupled from feature-specific logic
 *
 * The header is now a pure presentation component that emits events
 * when user wants to navigate. The parent (MainLayoutComponent) or
 * the Router itself handles the actual navigation.
 */
@Component({
  selector: 'main-header',
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  standalone: true,
  imports: [
    MatFormFieldModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatDividerModule,
    MatTooltipModule
  ]
})
export class HeaderComponent {
  readonly dialog = inject(MatDialog);
  readonly themeManager = inject(ThemeManagerService);
  readonly apiRoutes = inject(ApiRoutesService);

  // Event emitters for navigation (if parent wants to handle it)
  @Output() navigateTo = new EventEmitter<string>();

  /** Nombre completo del usuario */
  userName: string = '';
  /** Rol del usuario */
  userRol: string = '';
  /** Primer nombre del usuario */
  userFirstName: string = '';
  /** URL de la imagen de perfil */
  profileImageUrl: string | null = null;

  get isDarkMode(): boolean {
    return this.themeManager.isDarkMode();
  }

  setThemeMode(mode: ThemeMode): void {
    this.themeManager.setThemeMode(mode);
  }

  constructor(
    private authService: AuthService,
    private alertService: AlertService,
    private drawerService: DrawerService,
    private userService: UserService,
    private router: Router
  ) {
    this.userName = this.authService.currentUser?.name ?? '';
    this.userRol = this.authService.currentUser?.role ?? '';
    this.userFirstName = this.userName;
  }

  /** Human-friendly role label for display in UI */
  get userRoleDisplay(): string {
    const role = this.authService.currentUser?.role ?? this.userRol ?? '';
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'moderator':
        return 'Moderador';
      case 'user':
        return 'Visitante';
      default:
        return role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Visitante';
    }
  }

  ngOnInit(): void {
    // Inicializar la imagen de perfil
    this.initProfileImage();

    // Escucha los cambios de pantalla completa (activado/desactivado)
    document.addEventListener("fullscreenchange", () => {
      this.isFullscreen = !!document.fullscreenElement;
    });
  }

  private initProfileImage(): void {
    const rawUrl = this.authService.currentUser?.avatar_url ?? '';
    if (!rawUrl) {
      this.profileImageUrl = null;
      return;
    }

    // Si la URL viene de Google, úsala tal cual; si no, antepone el API URL
    if (rawUrl.includes('googleusercontent.com')) {
      this.profileImageUrl = rawUrl;
    } else {
      this.profileImageUrl = this.apiRoutes.getAssetUrl(rawUrl);
    }
  }

  toggleDrawer() {
    this.drawerService.toggle();
  }

  logout(): void {
    this.authService.logout();
  }

  /**
   * REFACTORED: Navigate to dashboard using Router instead of DashboardService
   * This is more aligned with Angular best practices
   */
  openMainDashboard(): void {
    this.router.navigate(['/dashboard']);
    // Alternative: emit event for parent to handle
    // this.navigateTo.emit('dashboard');
  }

  // ... Rest of the methods remain the same (profile picture upload, password change, etc.)

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      this.alertService.showAlert('Por favor selecciona un archivo de imagen válido', 'error');
      return;
    }

    // Validar tamaño (máximo 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      this.alertService.showAlert('La imagen no debe superar los 5MB', 'error');
      return;
    }

    this.uploadProfilePicture(file);
  }

  private uploadProfilePicture(file: File): void {
    const userId = this.authService.currentUser?.id;
    if (!userId) {
      this.alertService.showAlert('Error: Usuario no identificado', 'error');
      return;
    }

    this.userService.updateProfilePicture(userId, file).subscribe({
      next: (response: { profile_picture_url: string }) => {
        // Actualizar la URL de la imagen con cache-busting
        const rawUrl = response.profile_picture_url ?? '';
        const cacheBuster = `&t=${Date.now()}`;
        if (rawUrl.includes('googleusercontent.com')) {
          this.profileImageUrl = rawUrl;
        } else {
          this.profileImageUrl = this.apiRoutes.getAssetUrl(rawUrl) + cacheBuster;
        }

        // Actualizar el usuario en el AuthService
        const currentUser = this.authService.currentUser;
        if (currentUser) {
          currentUser.avatar_url = rawUrl;
          this.authService.updateCurrentUser(currentUser);
        }

        this.alertService.showAlert('Foto de perfil actualizada correctamente', 'success');
      },
      error: () => {
        this.alertService.showAlert('Error al actualizar la foto de perfil', 'error');
      }
    });
  }

  toggleTheme(): void {
    this.themeManager.toggleTheme();
  }

  openDialogVerInfo() {
    const dialogData = {
      groups: {
        personaluser: {
          label: '',
            controls: {
            name: {
              type: 'text',
              label: 'Nombre',
              enabled: false,
              defaultValue: this.authService.currentUser?.name,
              maxLength: 100
            },
            email: {
              type: 'text',
              label: 'Correo electrónico',
              enabled: false,
              defaultValue: this.authService.currentUser?.email,
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
              enabled: false,
              defaultValue: this.authService.currentUser?.role
            },
            is_active: {
              type: 'toggle',
              label: 'Activo',
              enabled: false,
              defaultValue: this.authService.currentUser?.is_active
            },
          },
        }
      },
      customClass: 'view-info-dialog',
      titleText: 'Información de usuario',
      hideSubmitButton: true
    };

    const dialogRef = this.dialog.open(CreateDialogComponent, {
      width: '1000px',
      data: dialogData,
    });

    dialogRef.afterClosed().subscribe((result: any) => {
      // Aquí puedes manejar el resultado del diálogo si es necesario
    });
  }

  async verifyPassword(currentPassword: string): Promise<boolean> {
    const email = this.authService.currentUser?.email;
    const isPasswordCorrect = await this.userService.verifyPassword(email, currentPassword).toPromise();

    if (isPasswordCorrect?.message === "Password is correct") {
      return true;
    } else {
      this.alertService.showAlert('La contraseña actual es incorrecta', 'error', 1000)
      return false;
    }
  }

  validatePasswordMatch(password: string, rep_password: string): boolean {
    if (password !== rep_password) {
      this.alertService.showAlert('Las contraseñas no coinciden', 'error', 2000);
      return false;
    }
    return true;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<boolean> {
    try {
      const email = this.authService.currentUser?.email;
      const isPasswordCorrect = await this.userService.changePassword(email, currentPassword, newPassword).toPromise();
      if (isPasswordCorrect?.message === "Password changed successfully") {
        this.alertService.showAlert('Contraseña actualizada exitosamente', 'success', 2000)
        return true;
      } else {
        return false;
      }
    } catch (error: any) {
      // Extraer mensaje de error del backend y traducirlo
      const backendErrors = error?.error?.errors;
      let errorMessage = 'Error al cambiar la contraseña';

      if (backendErrors?.length) {
        errorMessage = this.translatePasswordError(backendErrors[0].message);
      } else if (error?.error?.message) {
        errorMessage = this.translatePasswordError(error.error.message);
      }

      this.alertService.showAlert(errorMessage, 'error', 4000)
      return false
    }
  }

  /** Traduce mensajes de error de contraseña al español */
  private translatePasswordError(message: string): string {
    const translations: Record<string, string> = {
      'Password must be at least 8 characters with uppercase, lowercase, number, and special character (@$!%*?&)':
        'La contraseña debe tener al menos 8 caracteres con mayúscula, minúscula, número y símbolo (@$!%*?&_#-.)',
      'Password must be at least 8 characters with uppercase, lowercase, number, and special character (@$!%*?&_#-.)':
        'La contraseña debe tener al menos 8 caracteres con mayúscula, minúscula, número y símbolo (@$!%*?&_#-.)',
      'Password must be at least 8 characters':
        'La contraseña debe tener al menos 8 caracteres',
      'Password cannot exceed 128 characters':
        'La contraseña no puede exceder 128 caracteres',
      'Current password is incorrect':
        'La contraseña actual es incorrecta',
      'User not found':
        'Usuario no encontrado',
    };

    return translations[message] || message;
  }

  openDialogChangePass() {
    // Patrón de contraseña: mínimo 8 caracteres, mayúscula, minúscula, número y carácter especial
    const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_#\-.])[A-Za-z\d@$!%*?&_#\-.]{8,}$/;

    const dialogData = {
      groups: {
        changePassword: {
          controls: {
            password_hash: {
              type: 'text',
              label: 'Contraseña actual',
              enabled: true,
              inputType: 'password',
              required: true,
              maxLength: 128
            },
            password: {
              type: 'text',
              label: 'Nueva contraseña',
              enabled: true,
              inputType: 'password',
              required: true,
              minLength: 8,
              maxLength: 128,
              pattern: passwordPattern,
              hint: 'Mínimo 8 caracteres, mayúscula, minúscula, número y símbolo (@$!%*?&_#-.)'
            },
            rep_password: {
              type: 'text',
              label: 'Confirmar contraseña',
              enabled: true,
              inputType: 'password',
              required: true,
              maxLength: 128
            }
          },
          hint: {
            type: 'info',
            message: 'La contraseña debe tener al menos 8 caracteres con mayúscula, minúscula, número y símbolo (@$!%*?&_#-.)'
          }
        }
      },
      methods: [
        {
          fn: this.validatePasswordMatch.bind(this),
          params: ['changePassword.password', 'changePassword.rep_password']
        },
        {
          fn: this.verifyPassword.bind(this),
          params: ['changePassword.password_hash']
        },
        {
          fn: this.changePassword.bind(this),
          params: ['changePassword.password_hash', 'changePassword.password']
        }
      ],
      customClass: 'change-pass-dialog',
      titleText: 'Cambiar contraseña'
    };

    const dialogRef = this.dialog.open(CreateDialogComponent, {
      width: '400px',
      data: dialogData,
    });

    dialogRef.afterClosed().subscribe((result: any) => {
      // Handle dialog close if needed
    });
  }

  isFullscreen = false;

  // Método para entrar en fullscreen
  openFullscreen() {
    const elem = document.documentElement;

    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if ((elem as any).webkitRequestFullscreen) { // Safari
      (elem as any).webkitRequestFullscreen();
    } else if ((elem as any).msRequestFullscreen) { // IE11
      (elem as any).msRequestFullscreen();
    }
    this.isFullscreen = true;
  }

  // Método para salir de fullscreen
  closeFullscreen() {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if ((document as any).webkitExitFullscreen) { // Safari
      (document as any).webkitExitFullscreen();
    } else if ((document as any).msExitFullscreen) { // IE11
      (document as any).msExitFullscreen();
    }
    this.isFullscreen = false;
  }
}
