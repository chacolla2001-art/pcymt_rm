import { ApplicationConfig, provideZoneChangeDetection, isDevMode, inject, provideAppInitializer } from '@angular/core';
import { AppConfigService } from './core/services/app-config.service';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors, withFetch } from '@angular/common/http';
import { provideClientHydration } from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { provideNgProgressOptions } from 'ngx-progressbar';
import { progressInterceptor } from 'ngx-progressbar/http';

import { routes } from './app.routes';
import { tokenInterceptor } from './core/interceptors/token.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { provideServiceWorker } from '@angular/service-worker';

/**
 * Configuración principal de la aplicación Angular
 * Incluye:
 * - Zone.js con event coalescing para mejor performance
 * - Router con lazy loading
 * - HttpClient con interceptores de token, errores y progreso
 * - SSR con hidratación del cliente
 * - Animaciones y gráficos
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideAppInitializer(() => inject(AppConfigService).ensureLoaded()),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideClientHydration(),
    provideHttpClient(
      withFetch(),
      withInterceptors([tokenInterceptor, errorInterceptor, progressInterceptor])
    ),
    provideAnimationsAsync(),
    provideCharts(withDefaultRegisterables()),
    provideNgProgressOptions({}), provideServiceWorker('ngsw-worker.js', {
            enabled: !isDevMode(),
            registrationStrategy: 'registerWhenStable:30000'
          })
  ]
};
