import { isPlatformBrowser } from '@angular/common';
import { Component, ViewChild, HostListener, Inject, PLATFORM_ID } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { MatIconModule } from '@angular/material/icon';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { DrawerService } from '../../core/services/drawer.service';
import { HeaderComponent } from '../components/header/header.component';
import { FooterComponent } from '../components/footer/footer.component';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

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
    MatIconModule,
    MatSidenavModule,
    MatButtonModule,
    HeaderComponent,
    FooterComponent,
    TranslatePipe,
  ]
})
export class MainLayoutComponent {
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
      this.router.events
        .pipe(filter(event => event instanceof NavigationEnd))
        .subscribe((event: any) => {
          this.activeRoute = event.urlAfterRedirects.split('?')[0];
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
    // Solo ejecutar en el navegador
    if (!this.isBrowser) return;

    this.drawerService.setDrawer(this.drawer);

    // Open drawer by default on desktop
    if (!this.isMobile) {
      this.drawer.open();
    }
  }

  /**
   * Navigate to a specific route
   * Called by nav buttons in the sidenav
   */
  navigateTo(route: string): void {
    this.router.navigate([`/${route}`]);
    if (this.isMobile) {
      this.drawer.close();
    }
  }

  /**
   * Check if a route is currently active
   */
  isRouteActive(route: string): boolean {
    return this.activeRoute.includes(route);
  }

  /** Whether user is currently on the map page (hide footer to maximize space) */
  get isMapRoute(): boolean {
    return this.activeRoute === '/map';
  }
}
