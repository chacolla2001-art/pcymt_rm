import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'main-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: []
})
export class FooterComponent {
  currentYear = new Date().getFullYear();
}
