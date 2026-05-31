import { Component, OnInit, Inject, PLATFORM_ID, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';

import { UserSessionService, TimeSeriesPoint } from '../../dashboard/services/user-session.service';
import { UserService } from '../../users/services/user.service';
import { User } from '../../users/models/user.model';
import { UserSession, Platform } from '../../dashboard/models/user-session.model';

export interface CalendarDay {
  date: Date;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  sessionCount: number;
  platforms: Set<Platform>;
  level: 0 | 1 | 2 | 3 | 4; // activity level for heatmap
}

export interface MonthlyStats {
  totalSessions: number;
  activeDays: number;
  webSessions: number;
  mobileSessions: number;
  avgSessionsPerDay: number;
  longestStreak: number;
  currentStreak: number;
}

@Component({
  selector: 'app-user-access-patterns',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatChipsModule,
    MatDividerModule
  ],
  templateUrl: './user-access-patterns.component.html',
  styleUrls: ['./user-access-patterns.component.scss']
})
export class UserAccessPatternsComponent implements OnInit {
  // Search
  userSearch = '';
  matchingUsers: User[] = [];
  selectedUser: User | null = null;

  // Calendar
  calendarWeeks: CalendarDay[][] = [];
  currentMonth = new Date();
  monthLabel = '';
  weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  // Monthly stats
  monthlyStats: MonthlyStats = {
    totalSessions: 0,
    activeDays: 0,
    webSessions: 0,
    mobileSessions: 0,
    avgSessionsPerDay: 0,
    longestStreak: 0,
    currentStreak: 0
  };

  // All-time stats
  allTimeSessions = 0;
  allTimeActiveDays = 0;
  firstAccessDate = '';
  allTimeWebSessions = 0;
  allTimeMobileSessions = 0;
  allTimeWebPercent = 0;
  allTimeMobilePercent = 0;

  // Session list for selected day
  selectedDay: CalendarDay | null = null;
  daySessions: UserSession[] = [];

  // Recent sessions
  recentSessions: UserSession[] = [];

  isLoading = false;
  private allUserSessions: UserSession[] = [];
  private readonly isBrowser: boolean;

  constructor(
    private userSessionService: UserSessionService,
    private userService: UserService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.currentMonth = new Date();
    this.updateMonthLabel();
  }

  searchUsers(): void {
    const term = this.userSearch.trim().toLowerCase();
    if (!term) return;
    this.userService.getAllUsers().subscribe(users => {
      this.matchingUsers = users.filter(u =>
        (u.name || '').toLowerCase().includes(term) || u.email.toLowerCase().includes(term)
      );
      this.cdr.markForCheck();
    });
  }

  selectUser(user: User): void {
    this.selectedUser = user;
    this.matchingUsers = [];
    this.loadUserSessions();
  }

  clearUser(): void {
    this.selectedUser = null;
    this.allUserSessions = [];
    this.calendarWeeks = [];
    this.recentSessions = [];
    this.selectedDay = null;
    this.resetStats();
  }

  private loadUserSessions(): void {
    if (!this.selectedUser) return;
    this.isLoading = true;

    this.userSessionService.getSessionsByUser(this.selectedUser.id).pipe(
      map((sessions: any) => {
        // Handle if response is wrapped
        const data = Array.isArray(sessions) ? sessions : (sessions?.data || []);
        return data.map((s: any) => new UserSession(s));
      }),
      catchError(() => of([]))
    ).subscribe((sessions: UserSession[]) => {
      this.allUserSessions = sessions;
      this.buildCalendar();
      this.computeAllTimeStats();
      this.computeMonthlyStats();
      this.loadRecentSessions();
      this.isLoading = false;
      this.cdr.markForCheck();
    });
  }

  // Calendar navigation
  navigateMonth(direction: number): void {
    this.currentMonth = new Date(
      this.currentMonth.getFullYear(),
      this.currentMonth.getMonth() + direction,
      1
    );
    this.updateMonthLabel();
    this.buildCalendar();
    this.computeMonthlyStats();
    this.selectedDay = null;
  }

  goToCurrentMonth(): void {
    this.currentMonth = new Date();
    this.updateMonthLabel();
    this.buildCalendar();
    this.computeMonthlyStats();
    this.selectedDay = null;
  }

  private updateMonthLabel(): void {
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    this.monthLabel = `${monthNames[this.currentMonth.getMonth()]} ${this.currentMonth.getFullYear()}`;
  }

  private buildCalendar(): void {
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    const today = new Date();

    // Get first day of month and last day
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Determine start of calendar (Monday of the week containing first day)
    let startDate = new Date(firstDay);
    const dayOfWeek = startDate.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday = 0
    startDate.setDate(startDate.getDate() - diff);

    // Build session map for the month
    const sessionMap = new Map<string, { count: number; platforms: Set<Platform> }>();
    for (const session of this.allUserSessions) {
      const loginDate = new Date(session.login_at);
      const key = this.dateKey(loginDate);
      const existing = sessionMap.get(key) || { count: 0, platforms: new Set<Platform>() };
      existing.count++;
      existing.platforms.add(session.platform);
      sessionMap.set(key, existing);
    }

    // Find max sessions in a day for scaling
    const maxSessions = Math.max(...Array.from(sessionMap.values()).map(v => v.count), 1);

    // Build weeks
    const weeks: CalendarDay[][] = [];
    let currentDate = new Date(startDate);

    for (let week = 0; week < 6; week++) {
      const days: CalendarDay[] = [];
      for (let day = 0; day < 7; day++) {
        const key = this.dateKey(currentDate);
        const data = sessionMap.get(key);
        const count = data?.count || 0;

        let level: 0 | 1 | 2 | 3 | 4 = 0;
        if (count > 0) {
          const ratio = count / maxSessions;
          if (ratio <= 0.25) level = 1;
          else if (ratio <= 0.5) level = 2;
          else if (ratio <= 0.75) level = 3;
          else level = 4;
        }

        days.push({
          date: new Date(currentDate),
          dayOfMonth: currentDate.getDate(),
          isCurrentMonth: currentDate.getMonth() === month,
          isToday: this.isSameDay(currentDate, today),
          sessionCount: count,
          platforms: data?.platforms || new Set(),
          level
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }
      weeks.push(days);

      // Stop if we've passed the last day and completed the week
      if (currentDate.getMonth() !== month && days[0].isCurrentMonth === false && week > 3) break;
    }

    this.calendarWeeks = weeks;
  }

  onDayClicked(day: CalendarDay): void {
    if (!day.isCurrentMonth || day.sessionCount === 0) return;
    this.selectedDay = day;
    this.daySessions = this.allUserSessions.filter(s => {
      const loginDate = new Date(s.login_at);
      return this.isSameDay(loginDate, day.date);
    });
  }

  clearSelectedDay(): void {
    this.selectedDay = null;
    this.daySessions = [];
  }

  private computeMonthlyStats(): void {
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();

    const monthSessions = this.allUserSessions.filter(s => {
      const d = new Date(s.login_at);
      return d.getFullYear() === year && d.getMonth() === month;
    });

    const activeDaysSet = new Set<string>();
    let web = 0;
    let mobile = 0;

    for (const s of monthSessions) {
      activeDaysSet.add(this.dateKey(new Date(s.login_at)));
      if (s.platform === 'web') web++;
      else mobile++;
    }

    const daysInMonth = new Date(year, month + 1, 0).getDate();

    this.monthlyStats = {
      totalSessions: monthSessions.length,
      activeDays: activeDaysSet.size,
      webSessions: web,
      mobileSessions: mobile,
      avgSessionsPerDay: activeDaysSet.size > 0
        ? Math.round((monthSessions.length / activeDaysSet.size) * 10) / 10
        : 0,
      longestStreak: this.computeLongestStreak(activeDaysSet, year, month, daysInMonth),
      currentStreak: this.computeCurrentStreak()
    };
  }

  private computeAllTimeStats(): void {
    const sessions = this.allUserSessions;
    if (sessions.length === 0) {
      this.resetStats();
      return;
    }

    const activeDaysSet = new Set<string>();
    let web = 0;
    let mobile = 0;

    for (const s of sessions) {
      activeDaysSet.add(this.dateKey(new Date(s.login_at)));
      if (s.platform === 'web') web++;
      else mobile++;
    }

    this.allTimeSessions = sessions.length;
    this.allTimeActiveDays = activeDaysSet.size;
    this.allTimeWebSessions = web;
    this.allTimeMobileSessions = mobile;
    this.allTimeWebPercent = sessions.length > 0 ? Math.round((web / sessions.length) * 100) : 0;
    this.allTimeMobilePercent = sessions.length > 0 ? Math.round((mobile / sessions.length) * 100) : 0;

    // First access
    const sorted = [...sessions].sort((a, b) =>
      new Date(a.login_at).getTime() - new Date(b.login_at).getTime()
    );
    if (sorted.length > 0) {
      this.firstAccessDate = new Date(sorted[0].login_at).toLocaleDateString('es-BO', {
        day: '2-digit', month: 'long', year: 'numeric'
      });
    }
  }

  private loadRecentSessions(): void {
    const sorted = [...this.allUserSessions].sort((a, b) =>
      new Date(b.login_at).getTime() - new Date(a.login_at).getTime()
    );
    this.recentSessions = sorted.slice(0, 10);
  }

  private resetStats(): void {
    this.allTimeSessions = 0;
    this.allTimeActiveDays = 0;
    this.firstAccessDate = '';
    this.allTimeWebSessions = 0;
    this.allTimeMobileSessions = 0;
    this.allTimeWebPercent = 0;
    this.allTimeMobilePercent = 0;
    this.monthlyStats = {
      totalSessions: 0, activeDays: 0, webSessions: 0, mobileSessions: 0,
      avgSessionsPerDay: 0, longestStreak: 0, currentStreak: 0
    };
  }

  private computeLongestStreak(activeDays: Set<string>, year: number, month: number, daysInMonth: number): number {
    let longest = 0;
    let current = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (activeDays.has(key)) {
        current++;
        longest = Math.max(longest, current);
      } else {
        current = 0;
      }
    }
    return longest;
  }

  private computeCurrentStreak(): number {
    if (this.allUserSessions.length === 0) return 0;

    const activeDays = new Set<string>();
    for (const s of this.allUserSessions) {
      activeDays.add(this.dateKey(new Date(s.login_at)));
    }

    let streak = 0;
    const today = new Date();
    let checkDate = new Date(today);

    // Check if today has activity, if not start from yesterday
    if (!activeDays.has(this.dateKey(checkDate))) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (activeDays.has(this.dateKey(checkDate))) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    return streak;
  }

  // Helpers
  private dateKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth() === b.getMonth() &&
           a.getDate() === b.getDate();
  }

  formatTime(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
  }

  formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  formatDuration(session: UserSession): string {
    if (!session.logout_at) return 'Activa';
    const mins = session.durationMinutes;
    if (mins === null) return '-';
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  }

  getPlatformIcon(platform: Platform): string {
    return platform === 'web' ? 'computer' : 'phone_android';
  }

  getPlatformLabel(platform: Platform): string {
    return platform === 'web' ? 'Web' : 'Móvil';
  }

  getDayTooltip(day: CalendarDay): string {
    if (day.sessionCount === 0) return 'Sin actividad';
    const platforms = Array.from(day.platforms).map(p => p === 'web' ? 'Web' : 'Móvil').join(', ');
    return `${day.sessionCount} sesión(es) — ${platforms}`;
  }

  downloadData(): void {
    if (!this.selectedUser || this.allUserSessions.length === 0) return;
    const bom = '\ufeff';
    const csv = bom + [
      'Fecha;Hora Inicio;Hora Fin;Duración;Plataforma;Rol',
      ...this.allUserSessions.map(s => {
        const start = new Date(s.login_at);
        const end = s.logout_at ? new Date(s.logout_at) : null;
        return [
          start.toLocaleDateString('es-BO'),
          this.formatTime(start),
          end ? this.formatTime(end) : 'Activa',
          this.formatDuration(s),
          s.platform === 'web' ? 'Web' : 'Móvil',
          s.role
        ].join(';');
      })
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accesos_${this.selectedUser?.name || 'usuario'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}
