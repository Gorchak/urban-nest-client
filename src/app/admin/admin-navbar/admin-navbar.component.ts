import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MenubarModule } from 'primeng/menubar';
import { MenuModule } from 'primeng/menu';
import { ButtonModule } from 'primeng/button';
import { ImageModule } from 'primeng/image';
import { AvatarModule } from 'primeng/avatar';
import { RippleModule } from 'primeng/ripple';
import { AuthService } from '@auth0/auth0-angular';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';

interface MenuItem {
  label: string;
  routerLink: string;
  icon: string;
}

@Component({
  selector: 'app-admin-navbar',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    MenubarModule,
    MenuModule,
    ButtonModule,
    ImageModule,
    AvatarModule,
    RippleModule
  ],
  templateUrl: './admin-navbar.component.html',
  styleUrl: './admin-navbar.component.scss'
})
export class AdminNavbarComponent {
  private auth = inject(AuthService);

  private isAuthenticated$ = this.auth.isAuthenticated$.pipe(catchError(() => of(false)));
  private user$ = this.auth.user$;
  private isLoading$ = this.auth.isLoading$.pipe(catchError(() => of(false)));

  protected isAuthenticated = toSignal(this.isAuthenticated$, { initialValue: false });
  protected user = toSignal(this.user$, { initialValue: null });
  protected isLoading = toSignal(this.isLoading$, { initialValue: false });

  protected isMobileMenuOpen = signal(false);

  protected navItems: MenuItem[] = [
    { label: 'Категорії', routerLink: '/admin/categories', icon: 'pi pi-list' },
    { label: 'Товар', routerLink: '/admin/products', icon: 'pi pi-box' },
    { label: 'Продажі', routerLink: '/admin/sales', icon: 'pi pi-shopping-cart' },
    { label: 'Користувачі', routerLink: '/admin/users', icon: 'pi pi-users' }
  ];

  protected dropdownItems = [
    { label: 'Налаштування', icon: 'pi pi-cog', routerLink: '/admin/settings' },
    { label: 'Вихід', icon: 'pi pi-sign-out', command: () => this.logout() }
  ];

  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update(val => !val);
  }

  login(): void {
    this.auth.loginWithRedirect();
  }

  logout(): void {
    this.auth.logout({
      logoutParams: {
        returnTo: window.location.origin
      }
    });
  }
}
