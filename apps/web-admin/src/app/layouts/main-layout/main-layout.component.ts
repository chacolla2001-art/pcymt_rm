import { isPlatformBrowser } from '@angular/common';
import { Component, ViewChild, HostListener, Inject, PLATFORM_ID, inject, AfterViewInit } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationStart } from '@angular/router';
import { filter } from 'rxjs/operators';
import { MatIconModule } from '@angular/material/icon';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { DrawerService } from '../../core/services/drawer.service';
import { HeaderComponent } from '../components/header/header.component';
import { FooterComponent } from '../components/footer/footer.component';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { AppShellLoadService } from '../../core/services/app-shell-load.service';
import { ShellLoadOverlayComponent } from '../../shared/components/shell-load-overlay/shell-load-overlay.component';

const MOBILE_BREAKPOINT = 768;

/**
 * REFACTORED MainLayoutComponent
 *
 * This component is now a SHELL that:
 * 1. Manages the drawer/sidenav
 * 2. Handles navigation via Router (no more view toggles!)
 * 3. Provides a clean layout structure with <router-outlet>
 * 4. Maintains responsive behavior
 *
 * REMOVED:
 * - All view toggle logic (showTableControl, showMapControl, etc.)
 * - All @ViewChild references to feature components
 * - All charge* methods (chargeUsers, charge3DContent, etc.)
 * - Direct feature component imports
 *
 * KEPT:
 * - Drawer/sidenav management
 * - Responsive detection
 * - Layout structure
 */
@Component({
  selector: 'main-layout',
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.scss'],
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    MatSidenavModule,
    MatButtonModule,
    HeaderComponent,
    FooterComponent,
    TranslatePipe,
    ShellLoadOverlayComponent,
  ]
})
export class MainLayoutComponent implements AfterViewInit {
  readonly shellLoad = inject(AppShellLoadService);
  @ViewChild('drawer') drawer!: MatDrawer;

  // Responsive: detectar si es móvil
  isMobile = false;

  // Track current active route for nav highlighting
  activeRoute = '';

  // Flag para detectar si estamos en el navegador
  private readonly isBrowser: boolean;

  constructor(
    private drawerService: DrawerService,
    private router: Router,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.checkScreenSize();

    // Listen to route changes to highlight active nav item
    if (this.isBrowser) {
      this.activeRoute = this.router.url.split('?')[0];
      this.shellLoad.warmImageCache('assets/images/logo.png');

      if (this.router.navigated) {
        this.shellLoad.beginNavigation(this.router.url);
      }

      this.router.events
        .pipe(filter(event => event instanceof NavigationStart))
        .subscribe((event: NavigationStart) => {
          this.activeRoute = event.url.split('?')[0];
          this.shellLoad.beginNavigation(event.url);
        });
    }
  }

  @HostListener('window:resize')
  onResize() {
    this.checkScreenSize();
  }

  private checkScreenSize(): void {
    if (typeof window !== 'undefined') {
      this.isMobile = window.innerWidth < MOBILE_BREAKPOINT;
    }
  }

  ngAfterViewInit() {
    if (!this.isBrowser) return;

    this.drawerService.setDrawer(this.drawer);

    if (!this.isMobile) {
      this.drawer.open();
    }
  }

  closeDrawerIfMobile(): void {
    if (this.isMobile) {
      this.drawer.close();
    }
  }

  /** Whether user is currently on the map page (hide footer to maximize space) */
  get isMapRoute(): boolean {
    return this.activeRoute === '/map';
  }
}
