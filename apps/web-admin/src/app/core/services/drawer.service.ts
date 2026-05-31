import { Injectable } from '@angular/core';
import { MatDrawer } from '@angular/material/sidenav';

@Injectable({
  providedIn: 'root'
})
export class DrawerService {
  private drawer!: MatDrawer;

  setDrawer(drawer: MatDrawer): void {
    this.drawer = drawer;
  }

  toggle(): void {
    if (this.drawer) {
      this.drawer.toggle();
    }
  }

  open(): void {
    if (this.drawer) {
      this.drawer.open();
    }
  }

  close(): void {
    if (this.drawer) {
      this.drawer.close();
    }
  }
}
