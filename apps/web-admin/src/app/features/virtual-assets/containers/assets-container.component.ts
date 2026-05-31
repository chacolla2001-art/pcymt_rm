import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { VirtualAssetTableComponent } from '../components/asset-table/virtual-asset-table.component';

/**
 * SMART CONTAINER for Virtual Assets Feature
 *
 * Responsibilities:
 * - Manages virtual assets (3D models) state
 * - Coordinates between table and 3D viewer
 * - Handles asset CRUD operations
 */
@Component({
  selector: 'app-assets-container',
  standalone: true,
  imports: [CommonModule, VirtualAssetTableComponent],
  template: `
    <div class="container-wrapper">
      <virtual-asset-table [highlightedId]="highlightedId"></virtual-asset-table>
    </div>
  `,
  styles: [`
    .container-wrapper {
      padding: 20px;
      height: 100%;
      overflow: auto;
    }
  `]
})
export class AssetsContainerComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  highlightedId: string | null = null;

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.highlightedId = params['filterId'] || null;
    });
  }
}
