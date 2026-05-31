
import { RouterOutlet } from '@angular/router';
import { ThemeManagerService } from '../core/services/theme-manager.service';
import { PLATFORM_ID, Inject, Component, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NgProgressbar } from 'ngx-progressbar';
import { NgProgressHttp } from 'ngx-progressbar/http';
import { AuthService } from '../core/services/auth.service';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NgProgressbar, NgProgressHttp],
  template: `
  <ng-progress ngProgressHttp/>
  <router-outlet></router-outlet>
  `,
})
export class AppComponent {
  private themeService = inject(ThemeManagerService);

  constructor(@Inject(PLATFORM_ID) private platformId: Object, private authService: AuthService) {
    // Forzar inicialización del tema en el navegador
    if (isPlatformBrowser(this.platformId)) {
      // Tema inicializado automáticamente por ThemeManagerService
    }
  }

  ngAfterViewInit() {


  }
  ngOnInit(){
    this.authService.isUserAuthenticated(); // Esto fuerza la inicialización
  }

}
