import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { firstValueFrom } from 'rxjs';
import { AdminAccessService } from '../../core/services/admin-access.service';
import { CategoriesService } from '../../core/services/categories.service';
import { SalesService } from '../../core/services/sales.service';
import { Category } from '../../core/models/category.model';
import { Sale, SalePagination, SalePaymentStatus, SaleStatus } from '../../core/models/sale.model';
import { formatCurrency } from '../../core/utils/price-format';

@Component({
  selector: 'app-purchase-history-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './purchase-history-page.component.html',
  styleUrl: './purchase-history-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurchaseHistoryPageComponent implements OnInit {
  private auth = inject(AuthService);
  private adminAccess = inject(AdminAccessService);
  private categoriesService = inject(CategoriesService);
  private salesService = inject(SalesService);
  private cdr = inject(ChangeDetectorRef);

  protected isAuthenticated = signal(false);
  protected loading = signal(true);
  protected error = signal<string | null>(null);
  protected sales = signal<Sale[]>([]);
  protected categories = signal<Category[]>([]);
  protected selectedCategoryId = signal('');
  protected categoryMenuOpen = signal(false);
  protected pagination = signal<SalePagination>({ total: 0, page: 1, limit: 6, pages: 0, grandTotal: 0 });

  protected statusLabels: Record<SaleStatus, string> = {
    pending_payment: 'Очікує оплату',
    processing: 'В обробці',
    shipped: 'Відправлено',
    delivered: 'Отримано',
    cancelled: 'Скасовано',
    refunded: 'Повернення',
  };

  protected paymentLabels: Record<SalePaymentStatus, string> = {
    unpaid: 'Не оплачено',
    paid: 'Оплачено',
    partially_paid: 'Частково оплачено',
    refunded: 'Повернено',
  };

  async ngOnInit(): Promise<void> {
    const access = await firstValueFrom(this.adminAccess.check());
    this.isAuthenticated.set(access.isAuthenticated);
    if (!access.isAuthenticated) {
      this.loading.set(false);
      return;
    }

    await Promise.all([this.loadCategories(), this.loadSales()]);
  }

  protected login(): void {
    this.auth.loginWithRedirect({ appState: { target: '/purchase-history' } });
  }

  protected async onCategoryChange(categoryId: string): Promise<void> {
    this.selectedCategoryId.set(categoryId);
    this.categoryMenuOpen.set(false);
    this.pagination.update((pagination) => ({ ...pagination, page: 1 }));
    await this.loadSales();
  }

  protected toggleCategoryMenu(): void {
    this.categoryMenuOpen.update((value) => !value);
  }

  protected async goToPage(page: number): Promise<void> {
    const pages = this.pagination().pages || 1;
    const nextPage = Math.min(Math.max(1, page), pages);
    if (nextPage === this.pagination().page) return;
    this.pagination.update((pagination) => ({ ...pagination, page: nextPage }));
    await this.loadSales();
  }

  protected pageNumbers(): number[] {
    const pages = this.pagination().pages;
    const current = this.pagination().page;
    const start = Math.max(1, current - 2);
    const end = Math.min(pages, start + 4);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }

  protected needsPayment(sale: Sale): boolean {
    return sale.payment.status === 'unpaid' || sale.payment.status === 'partially_paid';
  }

  protected statusClass(status: SaleStatus): string {
    return `status-${status}`;
  }

  protected formatPrice(value: number, currency = 'UAH'): string {
    return formatCurrency(value, currency);
  }

  protected itemSummary(sale: Sale): string {
    const firstItem = sale.items[0]?.name || 'Товар';
    const extra = sale.items.length > 1 ? ` +${sale.items.length - 1}` : '';
    return `${firstItem}${extra}`;
  }

  protected selectedCategoryLabel(): string {
    if (!this.selectedCategoryId()) return 'Всі категорії';
    return this.categories().find((category) => category._id === this.selectedCategoryId())?.name || 'Всі категорії';
  }

  private async loadCategories(): Promise<void> {
    try {
      const categories = await this.categoriesService.getCategories(1, 200);
      this.categories.set(categories.filter((category) => category.isActive && category.isVisible));
    } catch {
      this.categories.set([]);
    }
  }

  private async loadSales(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const result = await this.salesService.getMySales({
        page: this.pagination().page,
        limit: this.pagination().limit,
        categoryId: this.selectedCategoryId() || undefined,
      });
      this.sales.set(result.data);
      this.pagination.set(result.pagination);
    } catch (error: any) {
      this.error.set(error?.error?.message || 'Не вдалося завантажити історію замовлень');
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }
}
