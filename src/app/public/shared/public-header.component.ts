import { ChangeDetectionStrategy, Component, ElementRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
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

    <div class="navigation-shell" (mouseleave)="closeCategoryMenu()">
    <header class="site-header">
      <a class="brand" routerLink="/" aria-label="Ulia">
        <img src="/assets/ulia_title.svg.svg" alt="Ulia" />
      </a>

      <nav class="main-nav">
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" (mouseenter)="closeCategoryMenu()" (focus)="closeCategoryMenu()">Головна</a>
        <a routerLink="/new-arrivals" routerLinkActive="active" (mouseenter)="closeCategoryMenu()" (focus)="closeCategoryMenu()">Новинки</a>
        @for (category of rootCategories(); track category._id) {
          <a
            [routerLink]="['/category', category.slug]"
            routerLinkActive="active"
            [class.menu-open]="activeCategory()?._id === category._id"
            (mouseenter)="openCategoryMenu(category, $event)"
            (focus)="openCategoryMenu(category, $event)"
            (click)="closeCategoryMenu()"
          >
            {{ category.name }}
            @if (childrenFor(category).length) { <i class="ri-arrow-down-s-line"></i> }
          </a>
        }
      </nav>

      <div class="actions">
        <button
          type="button"
          class="menu-button"
          [attr.aria-expanded]="mobileMenuOpen()"
          aria-controls="mobile-navigation"
          [attr.aria-label]="mobileMenuOpen() ? 'Закрити меню' : 'Відкрити меню'"
          (click)="toggleMobileMenu()"
        >
          <i [class]="mobileMenuOpen() ? 'ri-close-line' : 'ri-menu-2-line'"></i>
        </button>
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
          <button type="button" class="user-button" [attr.aria-label]="'Відкрити профіль ' + displayName(user)" (click)="toggleProfileMenu()">
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
              @if (canAccessAdmin()) {
                <a class="profile-admin-link" routerLink="/admin" (click)="profileMenuOpen.set(false)"><i class="ri-dashboard-line"></i> Адмін-панель</a>
              }
              <a class="profile-admin-link" routerLink="/purchase-history" (click)="profileMenuOpen.set(false)"><i class="ri-file-list-3-line"></i> Історія замовлень</a>
              <button type="button" (click)="openProfileSettings()"><i class="ri-settings-3-line"></i> Налаштування</button>
              <button type="button" class="logout" (click)="logout()"><i class="ri-logout-box-r-line"></i> Вийти</button>
            </div>
          }
         } @else {
          <button type="button" class="login-button" aria-label="Увійти або зареєструватися" (click)="login()"><i class="ri-login-box-line"></i> Увійти</button>
         }
        }
      </div>
    </header>

    @if (mobileMenuOpen()) {
      <div class="mobile-menu-backdrop" (click)="closeMobileMenu()"></div>
      <nav id="mobile-navigation" class="mobile-nav" aria-label="Мобільна навігація">
        <div class="mobile-nav__primary">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" (click)="closeMobileMenu()">
            <span>Головна</span><i class="ri-arrow-right-line"></i>
          </a>
          <a routerLink="/new-arrivals" routerLinkActive="active" (click)="closeMobileMenu()">
            <span>Новинки</span><i class="ri-arrow-right-line"></i>
          </a>
          @for (category of rootCategories(); track category._id) {
            <div class="mobile-category">
              <div class="mobile-category__row">
                <a [routerLink]="['/category', category.slug]" routerLinkActive="active" (click)="closeMobileMenu()">{{ category.name }}</a>
                @if (childrenFor(category).length) {
                  <button type="button" [attr.aria-expanded]="mobileExpandedCategory() === category._id" [attr.aria-label]="'Підкатегорії ' + category.name" (click)="toggleMobileCategory(category)">
                    <i [class]="mobileExpandedCategory() === category._id ? 'ri-subtract-line' : 'ri-add-line'"></i>
                  </button>
                }
              </div>
              @if (mobileExpandedCategory() === category._id) {
                <div class="mobile-subnav">
                  @for (child of childrenFor(category); track child._id) {
                    <a [routerLink]="['/category', child.slug]" (click)="closeMobileMenu()">{{ child.name }}</a>
                  }
                </div>
              }
            </div>
          }
        </div>
        @if (canAccessAdmin()) {
          <a class="mobile-admin-link" routerLink="/admin" (click)="closeMobileMenu()">Адмін-панель <i class="ri-arrow-right-up-line"></i></a>
        }
      </nav>
    }

    @if (activeCategory(); as parent) {
      @if (activeChildren().length) {
        <div class="category-menu" [style.left.px]="categoryMenuLeft()" (mouseenter)="openCategoryMenu(parent)">
          <nav class="category-menu__items" [attr.aria-label]="'Підкатегорії ' + parent.name">
            @for (column of childColumns(); track $index) {
              <div class="category-menu__column">
                @for (child of column; track child._id) {
                  <a [routerLink]="['/category', child.slug]" (click)="closeCategoryMenu()">
                    <span>{{ child.name }}</span>
                    <i class="ri-arrow-right-line"></i>
                  </a>
                }
              </div>
            }
          </nav>
        </div>
      }
    }
    </div>

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
    :host { position: sticky; top: 0; z-index: 900; display: block; color: var(--un-ink, #181713); background: var(--un-paper, #fff); font-family: var(--un-sans, Arial, Helvetica, sans-serif); }
    button { font: inherit; cursor: pointer; }
    .announcement { min-height: 32px; padding: 8px 3vw; display: flex; justify-content: center; gap: 3rem; background: var(--un-ink, #181713); color: var(--un-paper, #fff); font-size: 9px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; }
    .navigation-shell { position: relative; }
    .site-header { min-height: 82px; padding: 0 3vw; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 2rem; border-bottom: 1px solid var(--un-line, rgba(24,23,19,.18)); background: rgba(255,255,255,.94); backdrop-filter: blur(14px); }
    .brand { display: flex; align-items: center; text-decoration: none; }
    .brand img:first-child { width: 42px; height: 42px; object-fit: contain; }
    .brand img:last-child { width: 82px; }
    .main-nav { display: flex; justify-content: center; gap: 1.5rem; overflow-x: auto; scrollbar-width: none; }
    .main-nav a, .admin-link { padding: .6rem 0; display: flex; align-items: center; gap: .2rem; color: inherit; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-decoration: none; text-transform: uppercase; white-space: nowrap; }
    .main-nav a.active, .main-nav a:hover, .main-nav a.menu-open, .admin-link:hover { color: var(--un-accent, #9f3526); }
    .main-nav a i { font-size: 15px; }
    .category-menu { position: absolute; top: 100%; z-index: 5; width: max-content; max-width: calc(100vw - 2rem); padding: 1.65rem 1.8rem; overflow-x: auto; border: 1px solid var(--un-line, rgba(24,23,19,.18)); border-top: 0; background: var(--un-paper, #fff); box-shadow: 0 22px 42px rgba(24,23,19,.12); }
    .category-menu__items { display: flex; gap: 2.5rem; }
    .category-menu__column { width: 210px; display: flex; flex-direction: column; }
    .category-menu__column + .category-menu__column { padding-left: 2rem; border-left: 1px solid var(--un-line, rgba(24,23,19,.18)); }
    .category-menu__items a { min-height: 38px; padding: .6rem 0; display: flex; align-items: center; justify-content: space-between; gap: 1rem; border-bottom: 1px solid rgba(24,23,19,.1); color: var(--un-ink, #181713); font-size: 13px; text-decoration: none; }
    .category-menu__items a:hover { color: var(--un-accent, #9f3526); }
    .category-menu__items a i { flex: 0 0 auto; font-size: 14px; opacity: 0; transform: translateX(-4px); transition: opacity .2s,transform .2s; }
    .category-menu__items a:hover i { opacity: 1; transform: translateX(0); }
    .actions { position: relative; display: flex; align-items: center; gap: 1rem; }
    .menu-button { display:none; width:42px; height:42px; place-items:center; border:0; background:transparent; color:inherit; font-size:24px; }
    .cart-button { position:relative; width:38px; height:38px; display:grid; place-items:center; border:0; background:transparent; font-size:20px; }
    .cart-button span { position:absolute; top:0; right:0; min-width:16px; height:16px; padding:0 3px; display:grid; place-items:center; border-radius:99px; background:var(--un-accent, #9f3526); color:#fff; font-size:9px; font-weight:700; }
    .user-button, .login-button { display: flex; align-items: center; gap: .5rem; border: 0; background: transparent; color: inherit; font-size: 11px; font-weight: 700; }
    .user-button img { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; }
    .user-button > i:first-child { width: 34px; height: 34px; display: grid; place-items: center; border: 1px solid rgba(24,23,19,.25); border-radius: 50%; }
    .profile-menu { position: absolute; top: calc(100% + 14px); right: 0; z-index: 2; min-width: 190px; padding: .4rem; background: #fff; border: 1px solid rgba(23,23,20,.16); box-shadow: 0 12px 35px rgba(23,23,20,.14); }
    .profile-menu button,.profile-admin-link { width: 100%; padding: .8rem; display: flex; align-items:center; gap: .65rem; border: 0; background: transparent; color: inherit; font-size:inherit; text-align: left; text-decoration:none; }
    .profile-menu button:hover,.profile-admin-link:hover { background: var(--un-soft, #f5f5f2); }.profile-menu .logout { color: #b33b2e; }
    .user-loading { width: 80px; height: 34px; background: rgba(24,23,19,.08); animation: pulse 1s infinite alternate; }
    .mobile-nav,.mobile-menu-backdrop { display:none; }
    @keyframes pulse { to { opacity: .45; } }
    @media (max-width: 1050px) { .site-header { grid-template-columns: auto 1fr; }.main-nav { grid-column: 1 / -1; grid-row: 2; justify-content: flex-start; padding-bottom: .6rem; }.actions { justify-self: end; }.announcement { display:none; }.category-menu__column { width:180px; } }
    @media (hover: none) { .category-menu { display:none; }.main-nav a i { display:none; } }
    @media (max-width: 650px) { .site-header { gap: .75rem; }.admin-link { font-size:0; }.admin-link i { font-size:16px; }.user-button span { display:none; }.main-nav { gap:1rem; } }
    @media (max-width: 760px) {
      :host { position:sticky; }
      .site-header { min-height:64px; padding:0 16px; display:grid; grid-template-columns:1fr auto 1fr; gap:.5rem; }
      .brand { grid-column:2; justify-self:center; z-index:2; }
      .brand img:first-child { width:38px; height:38px; }
      .brand img:last-child { width:70px; }
      .main-nav { display:none; }
      .actions { grid-column:1 / -1; grid-row:1; display:grid; grid-template-columns:auto 1fr auto auto; gap:.15rem; pointer-events:none; }
      .actions > * { pointer-events:auto; }
      .menu-button { display:grid; order:1; justify-self:start; }
      .cart-button { width:42px; height:42px; order:3; }
      .admin-link,.user-loading { display:none; }
      .login-button,.user-button { width:42px; height:42px; padding:0; display:grid; place-items:center; order:4; border-radius:50%; }
      .login-button { font-size:0; }
      .login-button i { font-size:21px; }
      .user-button { gap:0; }
      .user-button span,.user-button > i:last-child { display:none; }
      .user-button img { width:32px; height:32px; }
      .user-button > i:first-child { width:34px; height:34px; font-size:18px; }
      .mobile-menu-backdrop { position:fixed; inset:64px 0 0; z-index:3; display:block; background:rgba(24,23,19,.42); backdrop-filter:blur(2px); }
      .mobile-nav { position:fixed; top:64px; left:0; z-index:4; width:min(430px,88vw); max-height:calc(100dvh - 64px); padding:18px 20px calc(28px + env(safe-area-inset-bottom)); display:flex; flex-direction:column; overflow-y:auto; border-right:1px solid var(--un-line, rgba(24,23,19,.18)); background:var(--un-paper, #fff); box-shadow:18px 0 42px rgba(24,23,19,.18); animation:drawer-in .22s ease-out; }
      .mobile-nav__primary>a,.mobile-category__row { min-height:58px; display:flex; align-items:center; border-bottom:1px solid rgba(24,23,19,.14); }
      .mobile-nav__primary>a { justify-content:space-between; color:inherit; font-family:var(--un-serif, Georgia, serif); font-size:25px; line-height:1; text-decoration:none; }
      .mobile-nav__primary>a.active,.mobile-category__row>a.active { color:var(--un-accent, #9f3526); }
      .mobile-category__row>a { min-width:0; flex:1; color:inherit; font-family:var(--un-serif, Georgia, serif); font-size:25px; line-height:1; text-decoration:none; }
      .mobile-category__row button { width:48px; height:48px; flex:0 0 auto; border:0; background:transparent; color:inherit; font-size:20px; }
      .mobile-subnav { padding:8px 0 12px 16px; display:grid; border-bottom:1px solid rgba(24,23,19,.14); }
      .mobile-subnav a { min-height:42px; display:flex; align-items:center; color:var(--un-muted, rgba(24,23,19,.62)); font-size:13px; text-decoration:none; }
      .mobile-admin-link { margin-top:18px; padding:14px 0; display:flex; justify-content:space-between; color:inherit; font-size:11px; font-weight:700; letter-spacing:.1em; text-decoration:none; text-transform:uppercase; }
      .profile-menu { position:fixed; top:64px; right:16px; }
      @keyframes drawer-in { from { transform:translateX(-100%); } to { transform:translateX(0); } }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicHeaderComponent implements OnInit {
  private auth = inject(AuthService);
  private adminAccess = inject(AdminAccessService);
  private categoriesService = inject(CategoriesService);
  private messageService = inject(MessageService);
  private elementRef = inject(ElementRef) as ElementRef<HTMLElement>;
  protected cartService = inject(CartService);

  protected categories = signal<Category[]>([]);
  protected currentUser = signal<Auth0User | null>(null);
  protected loadingUser = signal(true);
  protected profileMenuOpen = signal(false);
  protected showProfileDialog = signal(false);
  protected profileUser = signal<Auth0User | null>(null);
  protected activeCategory = signal<Category | null>(null);
  protected categoryMenuLeft = signal(0);
  protected mobileMenuOpen = signal(false);
  protected mobileExpandedCategory = signal<string | null>(null);

  protected rootCategories = computed(() =>
    this.categories()
      .filter((category) => !category.parentId && category.isActive && category.isVisible)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  );
  protected activeChildren = computed(() => {
    const parent = this.activeCategory();
    return parent ? this.childrenFor(parent) : [];
  });
  protected childColumns = computed(() => {
    const children = this.activeChildren();
    return Array.from({ length: Math.ceil(children.length / 6) }, (_, index) => children.slice(index * 6, index * 6 + 6));
  });
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
  protected childrenFor(parent: Category): Category[] {
    return this.categories()
      .filter((category) => category.parentId === parent._id && category.isActive && category.isVisible)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }
  protected openCategoryMenu(category: Category, event?: Event): void {
    this.activeCategory.set(this.childrenFor(category).length ? category : null);
    const anchor = event?.currentTarget as HTMLElement | null;
    if (!anchor || !this.activeCategory()) return;
    const shell = this.elementRef.nativeElement.querySelector('.navigation-shell') as HTMLElement | null;
    if (!shell) return;
    this.categoryMenuLeft.set(Math.max(16, anchor.getBoundingClientRect().left - shell.getBoundingClientRect().left));
    requestAnimationFrame(() => this.keepCategoryMenuInViewport(shell));
  }
  protected closeCategoryMenu(): void { this.activeCategory.set(null); }
  protected toggleMobileMenu(): void {
    this.mobileMenuOpen.update((value) => !value);
    if (!this.mobileMenuOpen()) this.mobileExpandedCategory.set(null);
    this.closeCategoryMenu();
  }
  protected closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
    this.mobileExpandedCategory.set(null);
  }
  protected toggleMobileCategory(category: Category): void {
    this.mobileExpandedCategory.update((value) => value === category._id ? null : category._id);
  }
  protected toggleProfileMenu(): void { this.profileMenuOpen.update((value) => !value); }

  @HostListener('document:keydown.escape')
  protected closeOverlaysOnEscape(): void {
    this.closeMobileMenu();
    this.closeCategoryMenu();
    this.profileMenuOpen.set(false);
  }

  @HostListener('window:resize')
  protected closeMobileMenuOnDesktop(): void {
    if (window.innerWidth > 760 && this.mobileMenuOpen()) this.closeMobileMenu();
  }

  private keepCategoryMenuInViewport(shell: HTMLElement): void {
    const menu = shell.querySelector('.category-menu') as HTMLElement | null;
    if (!menu) return;
    const maxLeft = Math.max(16, shell.clientWidth - menu.offsetWidth - 16);
    this.categoryMenuLeft.set(Math.min(this.categoryMenuLeft(), maxLeft));
  }
  @HostListener('document:click', ['$event'])
  protected closeProfileMenuOnOutsideClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (this.profileMenuOpen() && !target?.closest('.user-button, .profile-menu')) {
      this.profileMenuOpen.set(false);
    }
    if (this.activeCategory() && !target?.closest('.main-nav, .category-menu')) {
      this.closeCategoryMenu();
    }
  }
  @HostListener('document:focusin', ['$event'])
  protected closeCategoryMenuOnOutsideFocus(event: FocusEvent): void {
    const target = event.target as HTMLElement | null;
    if (this.activeCategory() && !target?.closest('.main-nav, .category-menu')) {
      this.closeCategoryMenu();
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
