import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MenubarModule } from 'primeng/menubar';
import { MenuModule } from 'primeng/menu';
import { ButtonModule } from 'primeng/button';
import { ImageModule } from 'primeng/image';
import { AvatarModule } from 'primeng/avatar';
import { RippleModule } from 'primeng/ripple';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AuthService } from '@auth0/auth0-angular';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, filter, firstValueFrom, map, of, take, timeout } from 'rxjs';
import { UsersService } from '../../core/services/users.service';
import { Auth0User } from '../../core/models/user.model';
import { UserProfileDialogComponent } from '../pages/users-page/user-profile-dialog.component';

interface MenuItem {
  label: string;
  routerLink: string;
  icon: string;
  styleClass?: string;
}

@Component({
  selector: 'app-admin-navbar',
  standalone: true,
  providers: [MessageService],
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    MenubarModule,
    MenuModule,
    ButtonModule,
    ImageModule,
    AvatarModule,
    RippleModule,
    ToastModule,
    UserProfileDialogComponent,
  ],
  templateUrl: './admin-navbar.component.html',
  styleUrl: './admin-navbar.component.scss'
})
export class AdminNavbarComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private usersService = inject(UsersService);
  private messageService = inject(MessageService);

  private isAuthenticated$ = this.auth.isAuthenticated$.pipe(catchError(() => of(false)));
  private user$ = this.auth.user$;
  private isLoading$ = this.auth.isLoading$.pipe(
    timeout({ first: 5000, with: () => of(false) }),
    catchError(() => of(false)),
  );
  private currentUrl$ = this.router.events.pipe(
    filter((event): event is NavigationEnd => event instanceof NavigationEnd),
    map((event) => event.urlAfterRedirects),
  );

  protected isAuthenticated = toSignal(this.isAuthenticated$, { initialValue: false });
  protected user = toSignal(this.user$, { initialValue: null });
  protected isLoading = toSignal(this.isLoading$, { initialValue: false });
  protected currentUrl = toSignal(this.currentUrl$, { initialValue: this.router.url });

  protected isMobileMenuOpen = signal(false);
  protected showProfileDialog = signal(false);
  protected profileUser = signal<Auth0User | null>(null);

  protected navItems = computed<MenuItem[]>(() => [
      this.navItem('Категорії', '/admin/categories', 'pi pi-list'),
      this.navItem('Товар', '/admin/products', 'pi pi-box'),
      this.navItem('Бренди', '/admin/brands', 'pi pi-tags'),
      this.navItem('Продажі', '/admin/sales', 'pi pi-shopping-cart'),
      this.navItem('Користувачі', '/admin/users', 'pi pi-users'),
      this.navItem('Фінанси', '/admin/finance', 'pi pi-wallet'),
      this.navItem('Email-розсилка', '/admin/newsletter', 'pi pi-envelope'),
  ]);

  protected dropdownItems = [
    { label: 'Налаштування', icon: 'pi pi-cog', command: () => void this.openProfileSettings() },
    { label: 'Вихід', icon: 'pi pi-sign-out', command: () => this.logout() }
  ];

  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update(val => !val);
  }

  @HostListener('document:keydown.escape')
  protected closeMobileMenuOnEscape(): void {
    this.isMobileMenuOpen.set(false);
  }

  @HostListener('window:resize')
  protected closeMobileMenuOnDesktop(): void {
    if (window.innerWidth > 768) this.isMobileMenuOpen.set(false);
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

  protected async openProfileSettings(): Promise<void> {
    try {
      const authUser = await firstValueFrom(this.auth.user$.pipe(
        filter((user): user is NonNullable<typeof user> => Boolean(user)),
        take(1),
        timeout({ first: 5000 }),
      ));

      const profile = authUser.sub
        ? await this.usersService.getUserById(authUser.sub)
        : this.createFallbackProfile(authUser);

      this.profileUser.set(profile);
      this.showProfileDialog.set(true);
    } catch (err: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Профіль',
        detail: err?.error?.message || 'Не вдалося відкрити профіль користувача',
      });
    }
  }

  protected onProfileSaved(user: Auth0User): void {
    this.profileUser.set(user);
  }

  protected isActive(path: string): boolean {
    return this.currentUrl().startsWith(path);
  }

  private navItem(label: string, routerLink: string, icon: string): MenuItem {
    return {
      label,
      routerLink,
      icon,
      styleClass: this.isActive(routerLink) ? 'admin-nav-item--active' : '',
    };
  }

  private createFallbackProfile(user: any): Auth0User {
    const now = new Date().toISOString();
    return {
      userId: user.sub || '',
      email: user.email || '',
      emailVerified: Boolean(user.email_verified),
      name: user.name || '',
      nickname: user.nickname || '',
      picture: user.picture || '',
      createdAt: now,
      updatedAt: now,
      lastLogin: null,
      loginsCount: 0,
      identities: [],
      userMetadata: {},
      appMetadata: {},
    };
  }
}
