import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { UserTableComponent } from '../components/user-table/user-table.component';

/**
 * SMART CONTAINER for Users Feature
 *
 * Responsibilities:
 * - Manages user table state
 * - Handles business logic
 * - Coordinates data flow between services and components
 *
 * This is the ROUTED component that gets lazy loaded.
 * The actual table component is a DUMB component that receives data.
 */
@Component({
  selector: 'app-users-container',
  standalone: true,
  imports: [CommonModule, UserTableComponent],
  template: `
    <div class="container-wrapper">
      <user-table [highlightedId]="highlightedId"></user-table>
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
export class UsersContainerComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  highlightedId: string | null = null;

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.highlightedId = params['filterId'] || null;
    });
  }
}
