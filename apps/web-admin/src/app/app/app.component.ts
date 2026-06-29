import { RouterOutlet } from '@angular/router';
import { PLATFORM_ID, Inject, Component, inject, AfterViewInit, ViewChild } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NgProgressbar } from 'ngx-progressbar';
import { NgProgressHttp } from 'ngx-progressbar/http';
import { AuthService } from '../core/services/auth.service';
import { ProgressBarService } from '../core/services/progress-bar.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NgProgressbar, NgProgressHttp],
  template: `
    <ng-progress #progressBar ngProgressHttp color="var(--sys-primary)" />
    <router-outlet></router-outlet>
  `,
})
export class AppComponent implements AfterViewInit {
  private readonly progressBarService = inject(ProgressBarService);

  @ViewChild('progressBar') progressBar!: NgProgressbar;

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private authService: AuthService
  ) {}

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId) && this.progressBar?.progressRef) {
      this.progressBarService.setRef(this.progressBar.progressRef);
    }
  }

  ngOnInit(): void {
    this.authService.isUserAuthenticated();
  }
}
