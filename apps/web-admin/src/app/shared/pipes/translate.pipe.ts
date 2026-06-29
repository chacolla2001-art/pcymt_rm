import { Pipe, PipeTransform, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { I18nService } from '../../core/services/i18n.service';

@Pipe({
  name: 'translate',
  standalone: true,
  pure: false,
})
export class TranslatePipe implements PipeTransform, OnDestroy {
  private lastKey = '';
  private lastValue = '';
  private sub: Subscription;

  constructor(
    private readonly i18n: I18nService,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.sub = this.i18n.lang$.subscribe(() => {
      if (this.lastKey) {
        this.lastValue = this.i18n.t(this.lastKey);
        this.cdr.markForCheck();
      }
    });
  }

  transform(key: string): string {
    this.lastKey = key;
    this.lastValue = this.i18n.t(key);
    return this.lastValue;
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
