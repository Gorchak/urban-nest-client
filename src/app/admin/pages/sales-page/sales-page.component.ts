import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { MessageService } from 'primeng/api';

import { SalesService } from '../../../core/services/sales.service';
import { SaleFormDialogComponent } from './sale-form-dialog.component';
import { MerchandiseDetailsComponent } from '../merchandise-details/merchandise-details.component';
import { AdminActionMenuComponent } from '../../components/admin-action-menu/admin-action-menu.component';
import {
  CreateSaleDto,
  Sale,
  SaleCustomer,
  SaleItem,
  SalePagination,
  SalePayment,
  SalePaymentMethod,
  SalePaymentStatus,
  SaleShippingAddress,
  SaleStatus,
} from '../../../core/models/sale.model';
import { formatCurrency } from '../../../core/utils/price-format';
import { CheckboxService, CheckboxIntegrationStatus } from '../../../core/services/checkbox.service';

const emptySale = (): CreateSaleDto => ({
  orderNumber: `UN-${Date.now().toString().slice(-6)}`,
  status: 'pending_payment',
  customer: { firstName: '', lastName: '', middleName: '', phone: '', email: '' },
  shippingAddress: {
    country: 'Ukraine',
    city: '',
    cityRef: '',
    region: '',
    areaRef: '',
    street: '',
    building: '',
    apartment: '',
    postalCode: '',
    deliveryService: '',
    warehouse: '',
    warehouseRef: '',
    trackingNumber: '',
  },
  payment: { method: 'card', status: 'unpaid', transactionId: '', paidAt: null },
  items: [
    {
      merchandiseId: null,
      sku: '',
      name: '',
      image: null,
      selectedAttributes: [],
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
    },
  ],
  subtotal: 0,
  discountTotal: 0,
  shippingCost: 0,
  grandTotal: 0,
  currency: 'UAH',
  notes: null,
});

@Component({
  selector: 'app-sales-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MessageService],
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    DropdownModule,
    InputTextModule,
    InputNumberModule,
    InputTextareaModule,
    DialogModule,
    TagModule,
    SkeletonModule,
    ToastModule,
    IconFieldModule,
    InputIconModule,
    SaleFormDialogComponent,
    MerchandiseDetailsComponent,
    AdminActionMenuComponent,
  ],
  templateUrl: './sales-page.component.html',
  styleUrls: ['./sales-page.component.scss'],
})
export class SalesPageComponent implements OnInit {
  private salesService = inject(SalesService);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);
  private checkboxService = inject(CheckboxService);

  protected sales = signal<Sale[]>([]);
  protected pagination = signal<SalePagination>({ total: 0, page: 1, limit: 20, pages: 0 });
  protected loading = signal(false);
  protected saving = signal(false);
  protected deletingSaleId = signal<string | null>(null);
  protected editingQuickSaleId = signal<string | null>(null);
  protected quickEditDrafts = signal<Record<string, { status: SaleStatus; paymentStatus: SalePaymentStatus }>>({});
  protected search = signal('');
  protected statusFilter = signal<SaleStatus | null>(null);
  protected showDeleted = signal(false);
  protected dataSource = signal<'website' | 'checkbox'>('website');
  protected checkboxStatus = signal<CheckboxIntegrationStatus | null>(null);
  protected fiscalizingSaleId = signal<string | null>(null);
  readonly dataSourceOptions = [
    { label: 'Продажі сайту', value: 'website' },
    { label: 'Продажі Checkbox', value: 'checkbox' },
  ];

  protected showEditDialog = signal(false);
  protected showDetailsDialog = signal(false);
  protected showMerchandiseDetailsDialog = signal(false);
  protected detailsMerchandiseId = signal<string | null>(null);
  protected selectedSale = signal<Sale | null>(null);
  protected editableSale = signal<CreateSaleDto>(emptySale());

  protected statusOptions: Array<{ label: string; value: SaleStatus; severity: 'warning' | 'info' | 'success' | 'danger' | 'secondary' }> = [
    { label: 'Очікує оплату', value: 'pending_payment', severity: 'warning' },
    { label: 'В обробці', value: 'processing', severity: 'info' },
    { label: 'Відправлено', value: 'shipped', severity: 'info' },
    { label: 'Отримано', value: 'delivered', severity: 'success' },
    { label: 'Скасовано', value: 'cancelled', severity: 'danger' },
    { label: 'Повернення', value: 'refunded', severity: 'secondary' },
  ];

  protected paymentMethodOptions: Array<{ label: string; value: SalePaymentMethod }> = [
    { label: 'Картка', value: 'card' },
    { label: 'Післяплата', value: 'cash_on_delivery' },
    { label: 'Банківський переказ', value: 'bank_transfer' },
    { label: 'WayForPay', value: 'wayforpay' },
  ];

  protected paymentStatusOptions: Array<{ label: string; value: SalePaymentStatus }> = [
    { label: 'Не оплачено', value: 'unpaid' },
    { label: 'Оплачено', value: 'paid' },
    { label: 'Частково оплачено', value: 'partially_paid' },
    { label: 'Повернено', value: 'refunded' },
  ];

  protected get statusFilterOptions(): Array<{ label: string; value: SaleStatus | null }> {
    return [{ label: 'Всі статуси', value: null }, ...this.statusOptions];
  }

  async ngOnInit(): Promise<void> {
    try {
      this.checkboxStatus.set(await this.checkboxService.getStatus());
    } catch {
      // Status is informational; local sales must remain available.
    }
    await this.loadSales();
  }

  protected async loadSales(): Promise<void> {
    this.loading.set(true);
    try {
      const result = this.dataSource() === 'checkbox'
        ? await this.checkboxService.getReceipts({
            page: this.pagination().page,
            limit: this.pagination().limit,
            search: this.search() || undefined,
          })
        : await this.salesService.getSales({
            page: this.pagination().page,
            limit: this.pagination().limit,
            search: this.search() || undefined,
            status: this.statusFilter() || undefined,
            includeDeleted: this.showDeleted(),
          });
      this.sales.set(result.data);
      this.pagination.set(result.pagination);
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  protected async onDataSourceChange(value: 'website' | 'checkbox'): Promise<void> {
    this.dataSource.set(value);
    this.pagination.update((p) => ({ ...p, page: 1 }));
    await this.loadSales();
  }

  protected canFiscalize(sale: Sale): boolean {
    return sale.source !== 'checkbox'
      && !sale.deletedAt
      && sale.payment.status === 'paid'
      && !sale.checkboxFiscalization?.receiptId;
  }

  protected async fiscalizeSale(sale: Sale): Promise<void> {
    this.fiscalizingSaleId.set(sale._id);
    try {
      await this.checkboxService.fiscalizeSale(sale._id);
      this.messageService.add({ severity: 'success', summary: 'Checkbox', detail: 'Продаж передано на фіскалізацію' });
      await this.loadSales();
    } catch (err: any) {
      this.messageService.add({ severity: 'error', summary: 'Checkbox', detail: err?.error?.message || 'Не вдалося фіскалізувати продаж' });
    } finally {
      this.fiscalizingSaleId.set(null);
      this.cdr.markForCheck();
    }
  }

  protected async onPageChange(event: { first: number; rows: number }): Promise<void> {
    this.pagination.update((p) => ({ ...p, page: Math.floor(event.first / event.rows) + 1, limit: event.rows }));
    await this.loadSales();
  }

  protected async onSearchChange(value: string): Promise<void> {
    this.search.set(value);
    this.pagination.update((p) => ({ ...p, page: 1 }));
    await this.loadSales();
  }

  protected async onStatusFilterChange(value: SaleStatus | null): Promise<void> {
    this.statusFilter.set(value);
    this.pagination.update((p) => ({ ...p, page: 1 }));
    await this.loadSales();
  }

  protected async onShowDeletedChange(value: boolean): Promise<void> {
    this.showDeleted.set(value);
    this.pagination.update((p) => ({ ...p, page: 1 }));
    await this.loadSales();
  }

  protected openNew(): void {
    this.selectedSale.set(null);
    this.editableSale.set(emptySale());
    this.showEditDialog.set(true);
  }

  protected openEdit(sale: Sale): void {
    this.selectedSale.set(sale);
    this.editableSale.set(this.cloneSale(sale));
    this.showEditDialog.set(true);
  }

  protected openDetails(sale: Sale): void {
    this.selectedSale.set(sale);
    this.showDetailsDialog.set(true);
  }

  protected async onSaleSaved(): Promise<void> {
    await this.loadSales();
  }

  protected startQuickEdit(sale: Sale): void {
    this.editingQuickSaleId.set(sale._id);
    this.quickEditDrafts.update((drafts) => ({
      ...drafts,
      [sale._id]: { status: sale.status, paymentStatus: sale.payment.status },
    }));
  }

  protected cancelQuickEdit(sale: Sale): void {
    this.editingQuickSaleId.set(null);
    this.quickEditDrafts.update((drafts) => {
      const next = { ...drafts };
      delete next[sale._id];
      return next;
    });
  }

  protected isQuickEditing(sale: Sale): boolean {
    return this.editingQuickSaleId() === sale._id;
  }

  protected quickStatus(sale: Sale): SaleStatus {
    return this.quickEditDrafts()[sale._id]?.status ?? sale.status;
  }

  protected quickPaymentStatus(sale: Sale): SalePaymentStatus {
    return this.quickEditDrafts()[sale._id]?.paymentStatus ?? sale.payment.status;
  }

  protected setQuickStatus(sale: Sale, status: SaleStatus): void {
    this.quickEditDrafts.update((drafts) => ({
      ...drafts,
      [sale._id]: {
        status,
        paymentStatus: drafts[sale._id]?.paymentStatus ?? sale.payment.status,
      },
    }));
  }

  protected setQuickPaymentStatus(sale: Sale, paymentStatus: SalePaymentStatus): void {
    this.quickEditDrafts.update((drafts) => ({
      ...drafts,
      [sale._id]: {
        status: drafts[sale._id]?.status ?? sale.status,
        paymentStatus,
      },
    }));
  }

  protected async saveQuickEdit(sale: Sale): Promise<void> {
    const draft = this.quickEditDrafts()[sale._id];
    if (!draft) return;

    let status = draft.status;
    let paymentStatus = draft.paymentStatus;

    if (status === 'pending_payment') paymentStatus = 'unpaid';
    if (status === 'refunded') paymentStatus = 'refunded';
    if (paymentStatus === 'unpaid') status = 'pending_payment';
    if (paymentStatus === 'refunded') status = 'refunded';
    if ((paymentStatus === 'paid' || paymentStatus === 'partially_paid') && status === 'pending_payment') {
      status = 'processing';
    }

    await this.patchSaleInList(sale, {
      status,
      payment: { ...sale.payment, status: paymentStatus },
    });
    this.cancelQuickEdit(sale);
  }

  protected async deleteSale(sale: Sale): Promise<void> {
    if (!confirm(`Видалити продаж ${sale.orderNumber}?`)) return;

    this.deletingSaleId.set(sale._id);
    try {
      await this.salesService.deleteSale(sale._id);
      this.messageService.add({ severity: 'success', summary: 'Видалено', detail: 'Продаж видалено' });
      await this.loadSales();
    } catch (err: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Помилка',
        detail: err?.error?.message || 'Не вдалося видалити продаж',
      });
    } finally {
      this.deletingSaleId.set(null);
      this.cdr.markForCheck();
    }
  }

  protected openMerchandiseDetails(merchandiseId: string | null | undefined): void {
    if (!merchandiseId) return;
    this.detailsMerchandiseId.set(merchandiseId);
    this.showMerchandiseDetailsDialog.set(true);
  }

  protected addItem(): void {
    this.editableSale.update((sale) => ({
      ...sale,
      items: [
        ...sale.items,
        { merchandiseId: null, sku: '', name: '', image: null, selectedAttributes: [], quantity: 1, unitPrice: 0, totalPrice: 0 },
      ],
    }));
  }

  protected removeItem(index: number): void {
    this.editableSale.update((sale) => ({ ...sale, items: sale.items.filter((_, i) => i !== index) }));
    this.recalculateTotals();
  }

  protected patchSale(patch: Partial<CreateSaleDto>): void {
    this.editableSale.update((sale) => ({ ...sale, ...patch }));
  }

  protected patchCustomer(patch: Partial<SaleCustomer>): void {
    this.editableSale.update((sale) => ({
      ...sale,
      customer: { ...sale.customer, ...patch },
    }));
  }

  protected patchShippingAddress(patch: Partial<SaleShippingAddress>): void {
    this.editableSale.update((sale) => ({
      ...sale,
      shippingAddress: { ...sale.shippingAddress, ...patch },
    }));
  }

  protected patchPayment(patch: Partial<SalePayment>): void {
    this.editableSale.update((sale) => ({
      ...sale,
      payment: { ...sale.payment, ...patch },
    }));
  }

  protected setDiscountTotal(value: number | null): void {
    this.editableSale.update((sale) => ({ ...sale, discountTotal: value || 0 }));
    this.recalculateTotals();
  }

  protected setShippingCost(value: number | null): void {
    this.editableSale.update((sale) => ({ ...sale, shippingCost: value || 0 }));
    this.recalculateTotals();
  }

  protected updateItem(index: number, patch: Partial<SaleItem>): void {
    this.editableSale.update((sale) => {
      const items = sale.items.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, ...patch };
        return { ...next, totalPrice: (next.quantity || 0) * (next.unitPrice || 0) };
      });
      return { ...sale, items };
    });
    this.recalculateTotals();
  }

  protected recalculateTotals(): void {
    this.editableSale.update((sale) => {
      const subtotal = sale.items.reduce((sum, item) => sum + item.totalPrice, 0);
      const grandTotal = Math.max(0, subtotal - (sale.discountTotal || 0) + (sale.shippingCost || 0));
      return { ...sale, subtotal, grandTotal };
    });
  }

  protected async saveSale(): Promise<void> {
    this.saving.set(true);
    try {
      const sale = this.editableSale();
      if (this.selectedSale()) {
        await this.salesService.updateSale(this.selectedSale()!._id, sale);
      } else {
        await this.salesService.createSale(sale);
      }
      this.messageService.add({ severity: 'success', summary: 'Збережено', detail: 'Продаж оновлено' });
      this.showEditDialog.set(false);
      await this.loadSales();
    } catch (err: any) {
      this.messageService.add({ severity: 'error', summary: 'Помилка', detail: err?.error?.message || 'Не вдалося зберегти продаж' });
    } finally {
      this.saving.set(false);
      this.cdr.markForCheck();
    }
  }

  protected async updateStatus(sale: Sale, status: SaleStatus): Promise<void> {
    if (sale.status === status) return;
    this.setQuickStatus(sale, status);
  }

  protected async updatePaymentStatus(sale: Sale, paymentStatus: SalePaymentStatus): Promise<void> {
    if (sale.payment.status === paymentStatus) return;
    this.setQuickPaymentStatus(sale, paymentStatus);
  }

  protected paymentStatusLabel(status: SalePaymentStatus): string {
    return this.paymentStatusOptions.find((option) => option.value === status)?.label ?? status;
  }

  protected statusLabel(status: SaleStatus): string {
    return this.getStatusOption(status).label;
  }

  private async patchSaleInList(sale: Sale, patch: Partial<CreateSaleDto>): Promise<void> {
    try {
      const updated = await this.salesService.updateSale(sale._id, patch);
      this.sales.update((items) => items.map((item) => (item._id === sale._id ? updated : item)));
      if (this.selectedSale()?._id === sale._id) this.selectedSale.set(updated);
      this.cdr.markForCheck();
    } catch (err: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Помилка',
        detail: err?.error?.message || 'Не вдалося оновити продаж',
      });
    }
  }

  protected getStatusOption(status: SaleStatus) {
    return this.statusOptions.find((option) => option.value === status) ?? this.statusOptions[0];
  }

  protected formatPrice(value: number, currency = 'UAH'): string {
    return formatCurrency(value, currency);
  }

  protected customerName(sale: Sale): string {
    return [sale.customer.lastName, sale.customer.firstName, sale.customer.middleName].filter(Boolean).join(' ').trim();
  }

  private cloneSale(sale: Sale): CreateSaleDto {
    return JSON.parse(JSON.stringify({
      orderNumber: sale.orderNumber,
      status: sale.status,
      customer: sale.customer,
      shippingAddress: sale.shippingAddress,
      payment: sale.payment,
      items: sale.items,
      subtotal: sale.subtotal,
      discountTotal: sale.discountTotal,
      shippingCost: sale.shippingCost,
      grandTotal: sale.grandTotal,
      currency: sale.currency,
      notes: sale.notes,
    }));
  }
}
