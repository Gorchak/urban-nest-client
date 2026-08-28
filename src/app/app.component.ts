import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { AdminNavbarComponent } from './admin/admin-navbar/admin-navbar.component';
import { PublicHeaderComponent } from './public/shared/public-header.component';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, AdminNavbarComponent, PublicHeaderComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  protected isAdminRoute = signal(globalThis.location?.pathname.startsWith('/admin') ?? this.router.url.startsWith('/admin'));

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => this.isAdminRoute.set(event.urlAfterRedirects.startsWith('/admin')));
  }
}
