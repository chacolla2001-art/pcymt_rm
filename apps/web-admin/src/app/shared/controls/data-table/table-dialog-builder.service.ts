/**
 * Servicio para construir configuraciones de diálogos
 * Separa la lógica de creación de diálogos del componente principal
 */

import { Injectable } from '@angular/core';
import { DialogData } from '../../modal-dialogs/create-dialog';
import { User } from '../../../core/models/user.model';
import { AnchorPoint, ParkSection } from '../../../core/models/anchor-point.model';
import { VirtualAsset } from '../../../core/models/virtual-asset.model';
import { SECTION_OPTIONS } from './table-column-configs';

@Injectable({ providedIn: 'root' })
export class TableDialogBuilderService {

  /**
   * Construye la configuración del diálogo para crear usuarios
   */
  buildUserCreateDialog(): DialogData {
    return {
      groups: {
        userInfo: {
          controls: {
            username: {
              type: 'text',
              label: 'Nombre de usuario',
              enabled: true,
              inputType: 'username',
              required: true,
              maxLength: 50
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
              enabled: true
            },
            is_active: {
              type: 'toggle',
              label: 'Activo',
              enabled: true
            }
          },
          hint: {
            type: 'info',
            message: 'La contraseña del usuario será enviada a su correo electrónico.'
          }
        }
      },
      titleText: 'Registro de Usuario'
    };
  }

  /**
   * Construye la configuración del diálogo para editar usuarios
   */
  buildUserEditDialog(element: User): DialogData {
    return {
      groups: {
        userInfo: {
          label: 'Información del Usuario',
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
          }
        }
      },
      titleText: 'Editar información del usuario'
    };
  }

  /**
   * Construye la configuración del diálogo para crear puntos de anclaje
   */
  buildAnchorPointCreateDialog(): DialogData {
    return {
      groups: {
        anchorInfo: {
          controls: {
            pointName: {
              type: 'text',
              label: 'Nombre del Punto',
              enabled: true,
              allowWhitespaces: true,
              required: true
            },
            description: {
              type: 'textarea',
              label: 'Descripción',
              enabled: true,
              allowWhitespaces: true,
              required: true
            },
            coordinates: {
              type: 'text',
              label: 'Coordenadas (lat, lng)',
              enabled: true,
              inputType: 'text',
              required: true
            },
            section: {
              type: 'select',
              label: 'Sección',
              options: SECTION_OPTIONS,
              enabled: true,
              required: true
            }
          }
        }
      },
      titleText: 'Crear Punto de Anclaje'
    };
  }

  /**
   * Construye la configuración del diálogo para editar puntos de anclaje
   */
  buildAnchorPointEditDialog(element: AnchorPoint, virtualAssets: VirtualAsset[]): DialogData {
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
            description: {
              type: 'textarea',
              label: 'Descripción',
              enabled: true,
              defaultValue: element?.description,
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
              options: virtualAssets.map(asset => ({
                value: asset.id,
                label: asset.name
              })),
              defaultValue: element?.virtualAssetId || ''
            },
            section: {
              type: 'select',
              label: 'Sección',
              options: SECTION_OPTIONS,
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
            }
          }
        }
      },
      titleText: 'Editar Información del Punto de Anclaje'
    };
  }

  /**
   * Construye la configuración del diálogo para crear activos virtuales
   */
  buildVirtualAssetCreateDialog(): DialogData {
    return {
      groups: {
        modelInfo: {
          controls: {
            model_name: {
              type: 'text',
              label: 'Nombre del Modelo',
              enabled: true,
              allowWhitespaces: true,
              required: true
            },
            description: {
              type: 'textarea',
              label: 'Descripción',
              enabled: true,
              allowWhitespaces: true,
              required: true
            },
            model_url: {
              type: 'file',
              label: 'Archivo del Modelo 3D (.glb)',
              enabled: true,
              accept: '.glb',
              required: true
            },
            icon_url: {
              type: 'file',
              label: 'Icono (.png, .jpg)',
              enabled: true,
              accept: 'image/*'
            },
            scientific_name: {
              type: 'text',
              label: 'Nombre Científico',
              enabled: true,
              allowWhitespaces: true
            },
            category: {
              type: 'select',
              label: 'Categoría',
              options: [
                { value: 'Mamífero', label: 'Mamífero' },
                { value: 'Ave', label: 'Ave' },
                { value: 'Reptil', label: 'Reptil' },
                { value: 'Mito', label: 'Mito' }
              ],
              enabled: true
            },
            habitat: {
              type: 'text',
              label: 'Hábitat',
              enabled: true,
              allowWhitespaces: true
            },
            display_order: {
              type: 'text',
              inputType: 'number',
              label: 'Orden de Visualización',
              enabled: true,
              defaultValue: 0
            },
            active: {
              type: 'toggle',
              label: 'Activo',
              enabled: true,
              defaultValue: true
            }
          }
        }
      },
      titleText: 'Crear Modelo 3D'
    };
  }

  /**
   * Construye la configuración del diálogo para editar activos virtuales
   */
  buildVirtualAssetEditDialog(element: VirtualAsset): DialogData {
    return {
      groups: {
        assetInfo: {
          label: 'Editar Información del Activo Virtual',
          controls: {
            name: {
              type: 'text',
              label: 'Nombre',
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
            model_url: {
              type: 'file',
              label: 'Archivo del Modelo 3D (.glb)',
              enabled: true,
              accept: '.glb'
            },
            icon_url: {
              type: 'file',
              label: 'Icono (.png, .jpg)',
              enabled: true,
              accept: 'image/*'
            },
            is_active: {
              type: 'toggle',
              label: 'Activo',
              enabled: true,
              defaultValue: element?.is_active
            }
            ,
            scientific_name: {
              type: 'text',
              label: 'Nombre Científico',
              enabled: true,
              defaultValue: element?.scientific_name,
              allowWhitespaces: true
            },
            category: {
              type: 'select',
              label: 'Categoría',
              options: [
                { value: 'Mamífero', label: 'Mamífero' },
                { value: 'Ave', label: 'Ave' },
                { value: 'Reptil', label: 'Reptil' },
                { value: 'Mito', label: 'Mito' }
              ],
              enabled: true,
              defaultValue: element?.category
            },
            habitat: {
              type: 'text',
              label: 'Hábitat',
              enabled: true,
              defaultValue: element?.habitat,
              allowWhitespaces: true
            },
            display_order: {
              type: 'text',
              inputType: 'number',
              label: 'Orden de Visualización',
              enabled: true,
              defaultValue: element?.display_order ?? 0
            }
          }
        }
      },
      titleText: 'Editar Información del Activo Virtual'
    };
  }
}
