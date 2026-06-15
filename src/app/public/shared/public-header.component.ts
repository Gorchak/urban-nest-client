import { ChangeDetectionStrategy, Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { firstValueFrom } from 'rxjs';
import { Category } from '../../core/models/category.model';
import { Auth0User } from '../../core/models/user.model';
import { AdminAccessService } from '../../core/services/admin-access.service';
import { CategoriesService } from '../../core/services/categories.service';
import { UserProfileDialogComponent } from '../../admin/pages/users-page/user-profile-dialog.component';
import { CartService } from '../../core/services/cart.service';
import { CartComponent } from '../cart/cart.component';

@Component({
  selector: 'app-public-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, ToastModule, UserProfileDialogComponent, CartComponent],
  providers: [MessageService],
  template: `
    <p-toast position="top-right" />
    <div class="announcement">
      Безкоштовна доставка від 3 000 грн
      <span>Нові речі для твоєї історії</span>
    </div>

    <header class="site-header">
      <a class="brand" routerLink="/" aria-label="Ulia">
        <img src="/assets/logo.png" alt="" />
        <img src="/assets/ulia_title.svg.svg" alt="Ulia" />
      </a>

      <nav class="main-nav">
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Головна</a>
        @for (category of rootCategories(); track category._id) {
          <a [routerLink]="['/category', category.slug]" routerLinkActive="active">{{ category.name }}</a>
        }
      </nav>

      <div class="actions">
        <button type="button" class="cart-button" aria-label="Відкрити кошик" (click)="cartService.isOpen.set(true)">
          <i class="ri-shopping-bag-line"></i>
          @if (cartService.itemCount()) { <span>{{ cartService.itemCount() }}</span> }
        </button>
        @if (canAccessAdmin()) {
          <a class="admin-link" routerLink="/admin">Адмін-панель <i class="ri-arrow-right-up-line"></i></a>
        }

        @if (loadingUser()) {
          <span class="user-loading"></span>
        } @else {
         @if (currentUser(); as user) {
          <button type="button" class="user-button" (click)="toggleProfileMenu()">
            @if (avatar(user)) {
              <img [src]="avatar(user)" [alt]="displayName(user)" />
            } @else {
              <i class="ri-user-line"></i>
            }
            <span>{{ displayName(user) }}</span>
            <i class="ri-arrow-down-s-line"></i>
          </button>
          @if (profileMenuOpen()) {
            <div class="profile-menu">
              <button type="button" (click)="openProfileSettings()"><i class="ri-settings-3-line"></i> Налаштування</button>
              <button type="button" class="logout" (click)="logout()"><i class="ri-logout-box-r-line"></i> Вийти</button>
            </div>
          }
         } @else {
          <button type="button" class="login-button" (click)="login()"><i class="ri-login-box-line"></i> Увійти</button>
         }
        }
      </div>
    </header>

    <app-user-profile-dialog
      [visible]="showProfileDialog()"
      (visibleChange)="showProfileDialog.set($event)"
      [user]="profileUser()"
      [showAdminFields]="false"
      (saved)="onProfileSaved($event)"
    />
    <app-cart />
  `,
  styles: [`
    :host { position: sticky; top: 0; z-index: 900; display: block; color: #171714; background: #f5f2eb; font-family: Arial, Helvetica, sans-serif; }
    button { font: inherit; cursor: pointer; }
    .announcement { min-height: 30px; padding: 7px 3vw; display: flex; justify-content: center; gap: 3rem; background: #171714; color: #fff; font-size: 10px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
    .site-header { min-height: 78px; padding: 0 3vw; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 2rem; border-bottom: 1px solid rgba(23,23,20,.18); background: rgba(245,242,235,.96); backdrop-filter: blur(12px); }
    .brand { display: flex; align-items: center; text-decoration: none; }
    .brand img:first-child { width: 44px; height: 44px; object-fit: contain; }
    .brand img:last-child { width: 76px; }
    .main-nav { display: flex; justify-content: center; gap: 1.5rem; overflow-x: auto; scrollbar-width: none; }
    .main-nav a, .admin-link { padding: .6rem 0; color: inherit; font-size: 13px; font-weight: 700; letter-spacing: .06em; text-decoration: none; text-transform: uppercase; white-space: nowrap; }
    .main-nav a.active, .main-nav a:hover, .admin-link:hover { color: #c85436; }
    .actions { position: relative; display: flex; align-items: center; gap: 1rem; }
    .cart-button { position:relative; width:38px; height:38px; display:grid; place-items:center; border:0; background:transparent; font-size:20px; }
    .cart-button span { position:absolute; top:0; right:0; min-width:16px; height:16px; padding:0 3px; display:grid; place-items:center; border-radius:99px; background:#c85436; color:#fff; font-size:9px; font-weight:700; }
    .user-button, .login-button { display: flex; align-items: center; gap: .5rem; border: 0; background: transparent; color: inherit; font-size: 11px; font-weight: 700; }
    .user-button img { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; }
    .user-button > i:first-child { width: 34px; height: 34px; display: grid; place-items: center; border: 1px solid rgba(23,23,20,.25); border-radius: 50%; }
    .profile-menu { position: absolute; top: calc(100% + 14px); right: 0; z-index: 2; min-width: 190px; padding: .4rem; background: #fff; border: 1px solid rgba(23,23,20,.16); box-shadow: 0 12px 35px rgba(23,23,20,.14); }
    .profile-menu button { width: 100%; padding: .8rem; display: flex; gap: .65rem; border: 0; background: transparent; color: inherit; text-align: left; }
    .profile-menu button:hover { background: #f5f2eb; }.profile-menu .logout { color: #b33b2e; }
    .user-loading { width: 80px; height: 34px; background: rgba(23,23,20,.08); animation: pulse 1s infinite alternate; }
    @keyframes pulse { to { opacity: .45; } }
    @media (max-width: 1050px) { .site-header { grid-template-columns: auto 1fr; }.main-nav { grid-column: 1 / -1; grid-row: 2; justify-content: flex-start; padding-bottom: .6rem; }.actions { justify-self: end; }.announcement { display:none; } }
    @media (max-width: 650px) { .site-header { gap: .75rem; }.admin-link { font-size:0; }.admin-link i { font-size:16px; }.user-button span { display:none; }.main-nav { gap:1rem; } }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicHeaderComponent implements OnInit {
  private auth = inject(AuthService);
  private adminAccess = inject(AdminAccessService);
  private categoriesService = inject(CategoriesService);
  private messageService = inject(MessageService);
  protected cartService = inject(CartService);

  protected categories = signal<Category[]>([]);
  protected currentUser = signal<Auth0User | null>(null);
  protected loadingUser = signal(true);
  protected profileMenuOpen = signal(false);
  protected showProfileDialog = signal(false);
  protected profileUser = signal<Auth0User | null>(null);

  protected rootCategories = computed(() =>
    this.categories()
      .filter((category) => !category.parentId && category.isActive && category.isVisible)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  );
  protected canAccessAdmin = computed(() => {
    const metadata = this.currentUser()?.appMetadata;
    return metadata?.isAdmin === true || metadata?.isModerator === true;
  });

  async ngOnInit(): Promise<void> {
    void this.loadCategories();
    try {
      const access = await firstValueFrom(this.adminAccess.check());
      this.currentUser.set(access.user);
      await this.cartService.load();
    } finally {
      this.loadingUser.set(false);
    }
  }

  protected login(): void { this.auth.loginWithRedirect(); }
  protected toggleProfileMenu(): void { this.profileMenuOpen.update((value) => !value); }
  @HostListener('document:click', ['$event'])
  protected closeProfileMenuOnOutsideClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (this.profileMenuOpen() && !target?.closest('.user-button, .profile-menu')) {
      this.profileMenuOpen.set(false);
    }
  }
  protected logout(): void {
    this.auth.logout({ logoutParams: { returnTo: window.location.origin } });
  }
  protected openProfileSettings(): void {
    const user = this.currentUser();
    if (!user) return;
    this.profileMenuOpen.set(false);
    this.profileUser.set(user);
    this.showProfileDialog.set(true);
  }
  protected onProfileSaved(user: Auth0User): void {
    this.profileUser.set(user);
    this.currentUser.set(user);
  }
  protected displayName(user: Auth0User): string {
    return [user.userMetadata?.firstName, user.userMetadata?.lastName].filter(Boolean).join(' ') || user.name || user.nickname || user.email;
  }
  protected avatar(user: Auth0User): string {
    return String(user.userMetadata?.avatarUrl || user.picture || '');
  }

  private async loadCategories(): Promise<void> {
    try {
      this.categories.set(await this.categoriesService.getCategories(1, 200));
    } catch {
      this.messageService.add({ severity: 'warn', summary: 'Категорії', detail: 'Не вдалося завантажити навігацію категорій' });
    }
  }
}
