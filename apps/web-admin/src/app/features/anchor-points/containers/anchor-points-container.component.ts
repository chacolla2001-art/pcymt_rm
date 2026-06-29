import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { AnchorTableComponent } from '../components/anchor-table/anchor-table.component';

/**
 * SMART CONTAINER for Anchor Points Feature
 *
 * Responsibilities:
 * - Manages anchor points state
 * - Handles CRUD operations coordination
 * - Accepts URL params for highlighting specific anchors
 * - Integrates with map feature (clicking anchor on map navigates here with highlight)
 *
 * Usage:
 * - Navigate to /anchor-points to view all anchors
 * - Navigate to /anchor-points?highlight=anchor-123 to highlight specific anchor
 */
@Component({
  selector: 'app-anchor-points-container',
  standalone: true,
  imports: [CommonModule, AnchorTableComponent],
  template: `
    <div class="container-wrapper">
      <anchor-table [highlightedId]="highlightedAnchorId" [sectionFilter]="sectionFilter"></anchor-table>
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
export class AnchorPointsContainerComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  highlightedAnchorId: string | null = null;
  sectionFilter: string | null = null;

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.highlightedAnchorId = params['filterId'] || null;
      this.sectionFilter = params['section'] || null;
    });
  }
}
