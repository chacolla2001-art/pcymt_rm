import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Inject,
  ViewEncapsulation,
  OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  AbstractControl,
  ValidatorFn
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatSliderModule } from '@angular/material/slider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { ConfirmDialogComponent } from '../controls/confirm-dialog/confirm-dialog.component';

// ==================== TIPOS E INTERFACES ====================

export type InputType = 'text' | 'password' | 'email' | 'number' | 'tel' | 'url' | 'username';

export type ControlType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'multiselect'
  | 'toggle'
  | 'checkbox'
  | 'radio'
  | 'date'
  | 'time'
  | 'datetime'
  | 'file'
  | 'image'
  | 'json'
  | 'slider'
  | 'autocomplete'
  | 'color'
  | 'hidden';

export type HintType = 'info' | 'warning' | 'error' | 'success';

export interface SelectOption {
  value: string | number | boolean;
  label: string;
  disabled?: boolean;
  icon?: string;
}

export interface ControlConfig {
  type: ControlType;
  label: string;
  enabled?: boolean;
  defaultValue?: string | number | boolean | Date | null;
  placeholder?: string;
  hint?: string;
  icon?: string;
  prefixIcon?: string;
  suffixIcon?: string;

  // Validaciones
  required?: boolean;
  validators?: ValidatorFn[];
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string | RegExp;

  // Opciones para select, radio, autocomplete
  options?: SelectOption[];

  // Configuración específica por tipo
  inputType?: InputType;
  allowWhitespaces?: boolean;
  rows?: number;
  accept?: string;
  multiple?: boolean;
  step?: number;
  tickInterval?: number;

  // Callbacks
  onChange?: (value: any) => void;
  onBlur?: (value: any) => void;

  // Estilos
  width?: 'full' | 'half' | 'third' | 'quarter';
  cssClass?: string;

  // Password utilities
  /** Muestra botones de generar contraseña y copiar (solo para inputType=password) */
  canGenerate?: boolean;
  /** Muestra el indicador de fortaleza (solo para inputType=password) */
  showStrength?: boolean;
}

export interface GroupConfig {
  label?: string;
  description?: string;
  icon?: string;
  controls: { [key: string]: ControlConfig };
  hint?: { type: HintType; message: string };
  collapsible?: boolean;
  collapsed?: boolean;
  columns?: 1 | 2 | 3 | 4;
}

/** Configuración de método de validación para el diálogo */
export interface DialogMethodConfig {
  /** Función a ejecutar (puede ser async) */
  fn: (...args: string[]) => boolean | Promise<boolean>;
  /** Lista de parámetros en formato 'grupo.control' */
  params: string[];
}

/** Configuración completa del diálogo */
export interface DialogData {
  /** Grupos de controles del formulario */
  groups: { [group: string]: GroupConfig };
  /** Título del diálogo */
  titleText?: string;
  /** Icono del título */
  titleIcon?: string;
  /** Subtítulo descriptivo */
  subtitle?: string;
  /** Clase CSS personalizada */
  customClass?: string;
  /** Ancho del diálogo */
  width?: string;
  /** Mostrar confirmación antes de cerrar */
  showConfirmation?: boolean;
  /** Mensaje de confirmación */
  confirmationMessage?: string;
  /** Texto del botón de envío */
  submitButtonText?: string;
  /** Texto del botón de cancelar */
  cancelButtonText?: string;
  /** Icono del botón de envío */
  submitButtonIcon?: string;
  /** Icono del botón de cancelar */
  cancelButtonIcon?: string;
  /** Métodos de validación a ejecutar antes del submit */
  methods?: DialogMethodConfig[];
  /** Ocultar el botón de guardar (modo solo lectura) */
  hideSubmitButton?: boolean;
  /** Datos adicionales opcionales */
  optionalData?: Record<string, unknown>;
}

// ==================== COMPONENTE ====================

@Component({
  selector: 'create-dialog',
  templateUrl: 'create-dialog.html',
  styleUrls: ['create-dialog.css'],
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatIconModule,
    MatSlideToggleModule,
    MatCheckboxModule,
    MatRadioModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatAutocompleteModule,
    MatSliderModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDividerModule
  ]
})
export class CreateDialogComponent implements OnInit {
  form!: FormGroup;
  orderedGroups: string[] = [];
  isSubmitting = false;
  passwordVisibility: Record<string, boolean> = {};
  collapsedGroups: Record<string, boolean> = {};
  imagePreview: Record<string, string | null> = {};
  filteredOptions: Record<string, SelectOption[]> = {};

  private allMethodsSuccessful = true;

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog,
    public dialogRef: MatDialogRef<CreateDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) {}

  ngOnInit(): void {
    this.orderedGroups = Object.keys(this.data.groups);
    this.form = this.createForm(this.data.groups);
    this.initializeGroupStates();
    this.initializeAutocomplete();
  }

  // ==================== INICIALIZACIÓN ====================

  private initializeGroupStates(): void {
    this.orderedGroups.forEach(groupKey => {
      const group = this.data.groups[groupKey];
      this.collapsedGroups[groupKey] = group.collapsed ?? false;
    });
  }

  private initializeAutocomplete(): void {
    this.orderedGroups.forEach(groupKey => {
      const controls = this.data.groups[groupKey].controls;
      Object.keys(controls).forEach(controlKey => {
        const config = controls[controlKey];
        if (config.type === 'autocomplete' && config.options) {
          const key = `${groupKey}.${controlKey}`;
          this.filteredOptions[key] = this.normalizeOptions(config.options);
        }
      });
    });
  }

  private createForm(groups: { [group: string]: GroupConfig }): FormGroup {
    const formGroup: { [group: string]: FormGroup } = {};

    Object.keys(groups).forEach(groupKey => {
      const controls = groups[groupKey].controls;
      const groupControls: { [key: string]: AbstractControl } = {};

      Object.keys(controls).forEach(controlKey => {
        const config = controls[controlKey];
        const validators = this.buildValidators(config);

        groupControls[controlKey] = this.fb.control(
          { value: config.defaultValue ?? '', disabled: config.enabled === false },
          validators
        );

        if (config.inputType === 'password') {
          this.passwordVisibility[controlKey] = false;
        }
      });

      formGroup[groupKey] = this.fb.group(groupControls);
    });

    return this.fb.group(formGroup);
  }

  private buildValidators(config: ControlConfig): ValidatorFn[] {
    const validators: ValidatorFn[] = [];

    if (config.required) validators.push(Validators.required);
    if (config.minLength) validators.push(Validators.minLength(config.minLength));
    if (config.maxLength) validators.push(Validators.maxLength(config.maxLength));
    if (config.min !== undefined) validators.push(Validators.min(config.min));
    if (config.max !== undefined) validators.push(Validators.max(config.max));
    if (config.pattern) validators.push(Validators.pattern(config.pattern));
    if (config.inputType === 'email') validators.push(Validators.email);
    if (config.inputType === 'url') validators.push(Validators.pattern(/^https?:\/\/.+/));
    if (config.validators) validators.push(...config.validators);

    return validators;
  }

  // ==================== GETTERS Y HELPERS ====================

  getControlKeys(groupKey: string): string[] {
    return Object.keys(this.data.groups[groupKey]?.controls || {});
  }

  getControl(groupKey: string, controlKey: string): AbstractControl | null {
    return this.form.get([groupKey, controlKey]);
  }

  getConfig(groupKey: string, controlKey: string): ControlConfig {
    return this.data.groups[groupKey].controls[controlKey];
  }

  getInputType(groupKey: string, controlKey: string): string {
    const config = this.getConfig(groupKey, controlKey);
    if (config.inputType === 'password') {
      return this.passwordVisibility[controlKey] ? 'text' : 'password';
    }
    return config.inputType || 'text';
  }

  getControlWidth(config: ControlConfig): string {
    const widthMap: Record<string, string> = {
      full: '100%',
      half: 'calc(50% - 8px)',
      third: 'calc(33.33% - 10px)',
      quarter: 'calc(25% - 12px)'
    };
    return widthMap[config.width || 'full'];
  }

  normalizeOptions(options: SelectOption[] | any[]): SelectOption[] {
    if (!options?.length) return [];
    return options.map(opt =>
      typeof opt === 'object' && 'value' in opt
        ? opt
        : { value: opt, label: String(opt) }
    );
  }

  getHintIcon(type: HintType | undefined): string {
    const iconMap: Record<HintType, string> = {
      info: 'info_outline',
      warning: 'warning_amber',
      error: 'error_outline',
      success: 'check_circle_outline'
    };
    return iconMap[type || 'info'];
  }

  hasError(groupKey: string, controlKey: string, errorType: string): boolean {
    const control = this.getControl(groupKey, controlKey);
    return control ? control.hasError(errorType) && control.touched : false;
  }

  getCharCount(groupKey: string, controlKey: string): string {
    const control = this.getControl(groupKey, controlKey);
    const config = this.getConfig(groupKey, controlKey);
    const current = control?.value?.length || 0;
    const max = config.maxLength || 500;
    return `${current}/${max}`;
  }

  // ==================== ACCIONES DE CONTROLES ====================

  togglePasswordVisibility(controlKey: string): void {
    this.passwordVisibility[controlKey] = !this.passwordVisibility[controlKey];
  }

  // ==================== PASSWORD UTILITIES ====================

  /**
   * Genera una contraseña segura que cumple la política:
   * mínimo 8 caracteres, mayúscula, minúscula, número, carácter especial
   */
  generateSecurePassword(length = 16): string {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const special = '@$!%*?&_#-.';
    const all = upper + lower + digits + special;

    let password = [
      upper[Math.floor(Math.random() * upper.length)],
      lower[Math.floor(Math.random() * lower.length)],
      digits[Math.floor(Math.random() * digits.length)],
      special[Math.floor(Math.random() * special.length)],
    ];
    for (let i = 4; i < length; i++) {
      password.push(all[Math.floor(Math.random() * all.length)]);
    }
    // Shuffle
    return password.sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Auto-rellena el campo de contraseña con una contraseña generada.
   * Si hay un campo "confirmPassword" en el mismo grupo con el mismo valor,
   * también se actualiza.
   */
  fillGenerated(groupKey: string, controlKey: string): void {
    const generated = this.generateSecurePassword();
    const group = this.form.get(groupKey) as import('@angular/forms').FormGroup;
    if (group) {
      group.get(controlKey)?.setValue(generated);
      group.get(controlKey)?.markAsDirty();
      // Auto-fill confirmPassword if present
      const confirmKey = Object.keys(this.data.groups[groupKey].controls)
        .find(k => k.toLowerCase().includes('confirm') && k !== controlKey);
      if (confirmKey) {
        group.get(confirmKey)?.setValue(generated);
        group.get(confirmKey)?.markAsDirty();
      }
      // Reveal the password so user can see it
      this.passwordVisibility[controlKey] = true;
      if (confirmKey) this.passwordVisibility[confirmKey] = true;
      this.cdr.markForCheck();
    }
  }

  /**
   * Copia el valor del campo al portapapeles
   */
  copyFieldValue(groupKey: string, controlKey: string): void {
    const value = this.form.get(groupKey)?.get(controlKey)?.value;
    if (value && navigator.clipboard) {
      navigator.clipboard.writeText(value).then(() => {
        // Brief visual feedback via tooltip or state could be added here
      });
    }
  }

  /**
   * Calcula la fortaleza de la contraseña (0-4)
   */
  getPasswordStrength(groupKey: string, controlKey: string): number {
    const value: string = this.form.get(groupKey)?.get(controlKey)?.value || '';
    let score = 0;
    if (value.length >= 8) score++;
    if (/[A-Z]/.test(value)) score++;
    if (/[0-9]/.test(value)) score++;
    if (/[@$!%*?&_#\-.]/.test(value)) score++;
    return score;
  }

  /**
   * Devuelve la etiqueta de fortaleza según el nivel
   */
  getPasswordStrengthLabel(level: number): string {
    return ['', 'Débil', 'Regular', 'Buena', 'Fuerte'][level] || '';
  }

  /**
   * Clase CSS de color para la barra de fortaleza
   */
  getPasswordStrengthClass(level: number): string {
    return ['', 'strength-weak', 'strength-fair', 'strength-good', 'strength-strong'][level] || '';
  }

  toggleGroup(groupKey: string): void {
    if (this.data.groups[groupKey].collapsible) {
      this.collapsedGroups[groupKey] = !this.collapsedGroups[groupKey];
    }
  }

  preventInvalidInput(event: KeyboardEvent, config: ControlConfig): void {
    const key = event.key;
    const allowed = ['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];

    if (allowed.includes(key) || event.ctrlKey || event.metaKey) return;

    if (config.inputType === 'number' || config.inputType === 'tel') {
      if (!/[\d\-+.]/.test(key)) event.preventDefault();
    }

    if (!config.allowWhitespaces && key === ' ') {
      event.preventDefault();
    }
  }

  onAutocompleteInput(event: Event, groupKey: string, controlKey: string): void {
    const value = (event.target as HTMLInputElement).value.toLowerCase();
    const config = this.getConfig(groupKey, controlKey);
    const key = `${groupKey}.${controlKey}`;
    const allOptions = this.normalizeOptions(config.options || []);

    this.filteredOptions[key] = value
      ? allOptions.filter(opt => opt.label.toLowerCase().includes(value))
      : allOptions;
  }

  displayFn(option: SelectOption): string {
    return option?.label || '';
  }

  onFileSelected(event: Event, groupKey: string, controlKey: string): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files?.length) return;

    const config = this.getConfig(groupKey, controlKey);
    const control = this.getControl(groupKey, controlKey);
    const file = config.multiple ? Array.from(files) : files[0];

    control?.patchValue(file);

    if (config.type === 'image' && files[0]) {
      const reader = new FileReader();
      reader.onload = () => {
        this.imagePreview[`${groupKey}.${controlKey}`] = reader.result as string;
        this.cdr.markForCheck();
      };
      reader.readAsDataURL(files[0]);
    }
  }

  removeFile(groupKey: string, controlKey: string): void {
    const control = this.getControl(groupKey, controlKey);
    control?.patchValue(null);
    this.imagePreview[`${groupKey}.${controlKey}`] = null;
  }

  getFileName(groupKey: string, controlKey: string): string {
    const control = this.getControl(groupKey, controlKey);
    const value = control?.value;
    if (!value) return '';
    if (Array.isArray(value)) return value.map(f => f.name).join(', ');
    return value.name || '';
  }

  // ==================== SUBMIT ====================

  async confirmSave(): Promise<void> {
    if (this.data.showConfirmation !== false) {
      const ref = this.dialog.open(ConfirmDialogComponent, {
        width: '400px',
        disableClose: true,
        data: {
          title: 'Confirmar operación',
          message: this.data.confirmationMessage || '¿Desea guardar los cambios?',
          confirmText: 'Sí, guardar',
          cancelText: 'Cancelar'
        }
      });

      const confirmed = await ref.afterClosed().toPromise();
      if (confirmed) this.onSubmit();
    } else {
      this.onSubmit();
    }
  }

  async onSubmit(): Promise<void> {
    if (this.isSubmitting || this.form.invalid) return;

    this.isSubmitting = true;
    this.allMethodsSuccessful = true;
    this.cdr.markForCheck();

    try {
      if (this.data.methods?.length) {
        for (const methodConfig of this.data.methods) {
          const success = await this.executeMethod(methodConfig);
          if (!success) {
            this.allMethodsSuccessful = false;
            break;
          }
        }
      }

      if (this.allMethodsSuccessful) {
        this.dialogRef.close(this.form.getRawValue());
      }
    } catch {
      // Error manejado silenciosamente
    } finally {
      this.isSubmitting = false;
      this.cdr.markForCheck();
    }
  }

  /** Ejecuta un método de validación con sus parámetros */
  private async executeMethod(methodConfig: DialogMethodConfig): Promise<boolean> {
    try {
      const paramValues = methodConfig.params.map(param => {
        const [groupName, controlName] = param.split('.');
        return this.getControl(groupName, controlName)?.value;
      });
      const result = await methodConfig.fn(...paramValues);
      return !!result;
    } catch {
      return false;
    }
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }

  // ==================== TRACKBY FUNCTIONS ====================

  /** TrackBy para grupos ordenados */
  trackByGroup(_index: number, groupKey: string): string {
    return groupKey;
  }

  /** TrackBy para controles */
  trackByControl(_index: number, controlKey: string): string {
    return controlKey;
  }

  /** TrackBy para opciones de select */
  trackByOption(_index: number, option: SelectOption): string | number | boolean {
    return option.value;
  }
}

