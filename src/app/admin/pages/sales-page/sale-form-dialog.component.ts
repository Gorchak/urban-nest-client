import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { MessageService } from 'primeng/api';

import { SalesService } from '../../../core/services/sales.service';
import {
  NovaPoshtaArea,
  NovaPoshtaCity,
  NovaPoshtaService,
  NovaPoshtaWarehouse,
} from '../../../core/services/nova-poshta.service';
import {
  CreateSaleDto,
  Sale,
  SaleCustomer,
  SaleItem,
  SalePayment,
  SalePaymentMethod,
  SalePaymentStatus,
  SaleShippingAddress,
  SaleStatus,
} from '../../../core/models/sale.model';

export const createEmptySale = (): CreateSaleDto => ({
  orderNumber: `UN-${Date.now().toString().slice(-6)}`,
  status: 'pending_payment',
  customer: { firstName: '', lastName: '', phone: '', email: '' },
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
      inventoryAttributeKey: null,
      inventoryAttributeLabel: null,
      inventoryValueKey: null,
      inventoryValueLabel: null,
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
  selector: 'app-sale-form-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    DropdownModule,
    InputTextModule,
    InputNumberModule,
    InputTextareaModule,
    AutoCompleteModule,
  ],
  templateUrl: './sale-form-dialog.component.html',
  styleUrls: ['./sale-form-dialog.component.scss'],
})
export class SaleFormDialogComponent implements OnChanges {
  private salesService = inject(SalesService);
  private novaPoshtaService = inject(NovaPoshtaService);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);

  @Input() visible = false;
  @Input() sale: Sale | CreateSaleDto | null = null;
  @Input() mode: 'new' | 'edit' = 'new';
  @Input() lockItems = false;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<Sale>();

  protected saving = signal(false);
  protected novaPoshtaLoading = signal(false);
  protected editableSale = signal<CreateSaleDto>(createEmptySale());
  protected novaPoshtaAreas = signal<NovaPoshtaArea[]>([]);
  protected novaPoshtaCities = signal<NovaPoshtaCity[]>([]);
  protected novaPoshtaWarehouses = signal<NovaPoshtaWarehouse[]>([]);
  protected selectedNovaPoshtaCity = signal<NovaPoshtaCity | null>(null);
  protected selectedNovaPoshtaWarehouse = signal<NovaPoshtaWarehouse | null>(null);

  protected deliveryServiceOptions = [
    { label: 'Нова пошта', value: 'nova_poshta' },
    { label: 'Інша служба', value: 'custom' },
  ];

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
    { label: 'Онлайн', value: 'online' },
  ];

  protected paymentStatusOptions: Array<{ label: string; value: SalePaymentStatus }> = [
    { label: 'Не оплачено', value: 'unpaid' },
    { label: 'Оплачено', value: 'paid' },
    { label: 'Частково оплачено', value: 'partially_paid' },
    { label: 'Повернено', value: 'refunded' },
  ];

  protected get headerTitle(): string {
    return this.mode === 'edit' ? 'Редагувати продаж' : 'Новий продаж';
  }

  protected get isValid(): boolean {
    const sale = this.editableSale();
    return Boolean(
      sale.customer.firstName.trim() &&
      sale.customer.phone.trim() &&
      sale.items.length &&
      sale.items.every((item) => item.name.trim() && item.quantity > 0)
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue || (this.visible && changes['sale'])) {
      this.editableSale.set(this.sale ? this.cloneSale(this.sale) : createEmptySale());
      this.selectedNovaPoshtaCity.set(null);
      this.selectedNovaPoshtaWarehouse.set(null);
      this.recalculateTotals();
      void this.prepareNovaPoshtaData();
    }
  }

  protected close(): void {
    this.visibleChange.emit(false);
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

  protected async onDeliveryServiceChange(value: string): Promise<void> {
    this.patchShippingAddress({
      deliveryService: value,
      ...(value === 'nova_poshta'
        ? {}
        : { areaRef: '', cityRef: '', warehouseRef: '', region: '', city: '', warehouse: '' }),
    });

    if (value === 'nova_poshta') {
      await this.prepareNovaPoshtaData();
    } else {
      this.selectedNovaPoshtaCity.set(null);
      this.selectedNovaPoshtaWarehouse.set(null);
      this.novaPoshtaCities.set([]);
      this.novaPoshtaWarehouses.set([]);
    }
  }

  protected async onNovaPoshtaAreaChange(areaRef: string): Promise<void> {
    const area = this.novaPoshtaAreas().find((item) => item.Ref === areaRef);
    this.patchShippingAddress({
      areaRef,
      region: area?.Description || '',
      city: '',
      cityRef: '',
      warehouse: '',
      warehouseRef: '',
    });
    this.novaPoshtaCities.set([]);
    this.novaPoshtaWarehouses.set([]);
    this.selectedNovaPoshtaCity.set(null);
    this.selectedNovaPoshtaWarehouse.set(null);
    await this.loadNovaPoshtaCities(areaRef, '');
  }

  protected async searchNovaPoshtaCities(query = ''): Promise<void> {
    await this.loadNovaPoshtaCities(this.editableSale().shippingAddress.areaRef, query);
  }

  protected async onNovaPoshtaCitySelect(city: NovaPoshtaCity): Promise<void> {
    this.selectedNovaPoshtaCity.set(city);
    this.patchShippingAddress({
      cityRef: city.Ref,
      city: city.Description || '',
      warehouse: '',
      warehouseRef: '',
    });
    this.novaPoshtaWarehouses.set([]);
    this.selectedNovaPoshtaWarehouse.set(null);
    await this.loadNovaPoshtaWarehouses(city.Ref, '');
  }

  protected async searchNovaPoshtaWarehouses(query = ''): Promise<void> {
    const cityRef = this.editableSale().shippingAddress.cityRef;
    if (!cityRef) return;
    await this.loadNovaPoshtaWarehouses(cityRef, query);
  }

  protected onNovaPoshtaWarehouseSelect(warehouse: NovaPoshtaWarehouse): void {
    this.selectedNovaPoshtaWarehouse.set(warehouse);
    this.patchShippingAddress({
      warehouseRef: warehouse.Ref,
      warehouse: warehouse.Description || '',
    });
  }

  protected patchPayment(patch: Partial<SalePayment>): void {
    this.editableSale.update((sale) => ({
      ...sale,
      payment: { ...sale.payment, ...patch },
    }));
  }

  protected addItem(): void {
    this.editableSale.update((sale) => ({
      ...sale,
      items: [
        ...sale.items,
        {
          merchandiseId: null,
          sku: '',
          name: '',
          image: null,
          selectedAttributes: [],
          inventoryAttributeKey: null,
          inventoryAttributeLabel: null,
          inventoryValueKey: null,
          inventoryValueLabel: null,
          quantity: 1,
          unitPrice: 0,
          totalPrice: 0,
        },
      ],
    }));
  }

  protected removeItem(index: number): void {
    if (this.lockItems) return;
    this.editableSale.update((sale) => ({ ...sale, items: sale.items.filter((_, i) => i !== index) }));
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

  protected setDiscountTotal(value: number | null): void {
    this.editableSale.update((sale) => ({ ...sale, discountTotal: value || 0 }));
    this.recalculateTotals();
  }

  protected setShippingCost(value: number | null): void {
    this.editableSale.update((sale) => ({ ...sale, shippingCost: value || 0 }));
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
    if (!this.isValid) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Перевірте форму',
        detail: 'Вкажіть ім’я покупця, телефон і товар.',
      });
      return;
    }

    this.saving.set(true);
    try {
      const current = this.editableSale();
      const id = this.mode === 'edit' && this.sale && '_id' in this.sale ? this.sale._id : null;
      const saved = id
        ? await this.salesService.updateSale(id, current)
        : await this.salesService.createSale(current);

      this.messageService.add({
        severity: 'success',
        summary: 'Збережено',
        detail: 'Продаж збережено',
      });
      this.saved.emit(saved);
      this.visibleChange.emit(false);
    } catch (err: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Помилка',
        detail: err?.error?.message || 'Не вдалося зберегти продаж',
      });
    } finally {
      this.saving.set(false);
      this.cdr.markForCheck();
    }
  }

  protected formatPrice(value: number, currency = 'UAH'): string {
    return new Intl.NumberFormat('uk-UA', { style: 'currency', currency }).format(value || 0);
  }

  private async prepareNovaPoshtaData(): Promise<void> {
    const address = this.editableSale().shippingAddress;
    if (address.deliveryService !== 'nova_poshta') return;

    await this.loadNovaPoshtaAreas();
    if (address.areaRef) {
      await this.loadNovaPoshtaCities(address.areaRef, address.city);
      this.selectedNovaPoshtaCity.set(
        this.novaPoshtaCities().find((city) => city.Ref === address.cityRef) ||
        (address.cityRef ? { Ref: address.cityRef, Description: address.city, Area: address.areaRef } : null)
      );
    }
    if (address.cityRef) {
      await this.loadNovaPoshtaWarehouses(address.cityRef, address.warehouse);
      this.selectedNovaPoshtaWarehouse.set(
        this.novaPoshtaWarehouses().find((warehouse) => warehouse.Ref === address.warehouseRef) ||
        (address.warehouseRef ? { Ref: address.warehouseRef, Description: address.warehouse, CityRef: address.cityRef } : null)
      );
    }
  }

  private async loadNovaPoshtaAreas(): Promise<void> {
    if (this.novaPoshtaAreas().length) return;

    this.novaPoshtaLoading.set(true);
    try {
      this.novaPoshtaAreas.set(await this.novaPoshtaService.getAreas());
    } catch (err: any) {
      this.showNovaPoshtaError(err);
    } finally {
      this.novaPoshtaLoading.set(false);
      this.cdr.markForCheck();
    }
  }

  private async loadNovaPoshtaCities(areaRef?: string, search = ''): Promise<void> {
    this.novaPoshtaLoading.set(true);
    try {
      this.novaPoshtaCities.set(await this.novaPoshtaService.getCities(areaRef, search, search ? 100 : 500));
    } catch (err: any) {
      this.showNovaPoshtaError(err);
    } finally {
      this.novaPoshtaLoading.set(false);
      this.cdr.markForCheck();
    }
  }

  private async loadNovaPoshtaWarehouses(cityRef: string, search = ''): Promise<void> {
    this.novaPoshtaLoading.set(true);
    try {
      this.novaPoshtaWarehouses.set(await this.novaPoshtaService.getWarehouses(cityRef, search, search ? 100 : 500));
    } catch (err: any) {
      this.showNovaPoshtaError(err);
    } finally {
      this.novaPoshtaLoading.set(false);
      this.cdr.markForCheck();
    }
  }

  private showNovaPoshtaError(err: any): void {
    this.messageService.add({
      severity: 'error',
      summary: 'Нова пошта',
      detail: err?.error?.message || 'Не вдалося отримати дані Нової пошти',
    });
  }

  private cloneSale(sale: Sale | CreateSaleDto): CreateSaleDto {
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
