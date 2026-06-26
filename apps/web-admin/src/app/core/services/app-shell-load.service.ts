import { Injectable, computed, signal } from '@angular/core';
import { finalize, type MonoTypeOperatorFunction } from 'rxjs';
import { ProgressBarService } from './progress-bar.service';

const NAV_FALLBACK_MS = 20000;

/**
 * Coordina el overlay unificado del shell en navegación y recargas de datos.
 */
@Injectable({ providedIn: 'root' })
export class AppShellLoadService {
  private readonly pending = signal<Set<string>>(new Set());
  private navigationTaskId: string | null = null;
  private navigationFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private refreshTaskId: string | null = null;

  readonly isBlocking = computed(() => this.pending().size > 0);

  constructor(private readonly progressBar: ProgressBarService) {}

  hasActiveNavigation(): boolean {
    return this.navigationTaskId !== null;
  }

  beginNavigation(routeKey: string): void {
    this.endNavigation();
    const key = routeKey.split('?')[0] || '/';
    this.navigationTaskId = `nav:${key}`;
    this.begin(this.navigationTaskId);
    this.navigationFallbackTimer = setTimeout(() => this.endNavigation(), NAV_FALLBACK_MS);
  }

  endNavigation(): void {
    if (this.navigationFallbackTimer) {
      clearTimeout(this.navigationFallbackTimer);
      this.navigationFallbackTimer = null;
    }
    if (this.navigationTaskId) {
      this.complete(this.navigationTaskId);
      this.navigationTaskId = null;
    }
  }

  /** Recargas en la misma ruta (filtros, paginación). */
  beginRefresh(scope: string): void {
    this.completeRefresh();
    this.refreshTaskId = `refresh:${scope}`;
    this.begin(this.refreshTaskId);
  }

  completeRefresh(): void {
    if (this.refreshTaskId) {
      this.complete(this.refreshTaskId);
      this.refreshTaskId = null;
    }
  }

  endNavigationWhenDone<T>(): MonoTypeOperatorFunction<T> {
    return (source) => source.pipe(finalize(() => this.endNavigation()));
  }

  refreshWhenDone<T>(scope: string): MonoTypeOperatorFunction<T> {
    return (source) => {
      this.beginRefresh(scope);
      return source.pipe(finalize(() => this.completeRefresh()));
    };
  }

  begin(taskId: string): void {
    this.pending.update(tasks => {
      const next = new Set(tasks);
      next.add(taskId);
      return next;
    });
    this.progressBar.start();
  }

  complete(taskId: string): void {
    this.pending.update(tasks => {
      const next = new Set(tasks);
      next.delete(taskId);
      return next;
    });

    if (this.pending().size === 0) {
      this.progressBar.complete();
    }
  }

  /** Precarga en segundo plano sin bloquear el overlay del shell. */
  warmImageCache(url: string | null | undefined): void {
    if (!url) {
      return;
    }
    const img = new Image();
    img.src = url;
  }
}
