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
import { AuthService } from '@auth0/auth0-angular';
import { filter, firstValueFrom, take, timeout } from 'rxjs';

import { SalesService } from '../../../core/services/sales.service';
import { MerchandiseService } from '../../../core/services/merchandise.service';
import { UsersService } from '../../../core/services/users.service';
import {
  NovaPoshtaArea,
  NovaPoshtaCity,
  NovaPoshtaService,
  NovaPoshtaWarehouse,
} from '../../../core/services/nova-poshta.service';
import { Merchandise } from '../../../core/models/merchandise.model';
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
import { Auth0User, UserDeliveryProfile } from '../../../core/models/user.model';
import { formatCurrency } from '../../../core/utils/price-format';

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

interface SaleVariantOption {
  label: string;
  value: string;
  quantity: number;
  attributeKey: string;
  attributeLabel: string;
  valueLabel: string;
}

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
  private auth = inject(AuthService);
  private salesService = inject(SalesService);
  private merchandiseService = inject(MerchandiseService);
  private novaPoshtaService = inject(NovaPoshtaService);
  private usersService = inject(UsersService);
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
  protected merchandiseById = signal<Record<string, Merchandise>>({});
  protected loadingMerchandise = signal(false);

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
    { label: 'Google Pay', value: 'google_pay' },
    { label: 'Банківський переказ', value: 'bank_transfer' },
    { label: 'Онлайн', value: 'online' },
    { label: 'WayForPay', value: 'wayforpay' },
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
      void this.prepareMerchandiseData();
      if (this.mode === 'new' && !this.sale) {
        void this.prefillFromActiveUser();
      }
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

  protected addVariantItem(sourceIndex: number): void {
    const source = this.editableSale().items[sourceIndex];
    if (!source?.merchandiseId) return;

    const option = this.findNextVariantOption(source);
    if (!option) return;

    const nextItem = this.applyVariantToItem(
      {
        ...source,
        quantity: 1,
        totalPrice: source.unitPrice || 0,
      },
      option,
    );

    this.editableSale.update((sale) => ({
      ...sale,
      items: [
        ...sale.items.slice(0, sourceIndex + 1),
        nextItem,
        ...sale.items.slice(sourceIndex + 1),
      ],
    }));
    this.recalculateTotals();
  }

  protected removeItem(index: number): void {
    if (this.lockItems && this.editableSale().items.length <= 1) return;
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

  protected onQuantityChange(index: number, value: number | null): void {
    const item = this.editableSale().items[index];
    const max = item ? this.maxQuantityForItem(item) : null;
    const quantity = Math.max(1, Math.floor(Number(value || 1)));
    this.updateItem(index, { quantity: max ? Math.min(quantity, max) : quantity });
  }

  protected variantOptionsForItem(item: SaleItem): SaleVariantOption[] {
    if (!item.merchandiseId) return [];
    const merchandise = this.merchandiseById()[item.merchandiseId];
    const tracked = merchandise?.inventory?.tracked_attribute;
    if (!tracked) return [];

    return (merchandise.inventory.attribute_quantities ?? []).map((row) => ({
      label: `${row.value_label} (${row.quantity} шт.)`,
      value: row.value_key,
      valueLabel: row.value_label,
      quantity: row.quantity,
      attributeKey: tracked.attribute_key,
      attributeLabel: tracked.attribute_label,
    }));
  }

  protected hasVariants(item: SaleItem): boolean {
    return this.variantOptionsForItem(item).length > 0;
  }

  protected maxQuantityForItem(item: SaleItem): number | null {
    if (!item.merchandiseId) return null;
    const merchandise = this.merchandiseById()[item.merchandiseId];
    if (!merchandise?.inventory) return null;

    if (merchandise.inventory.tracked_attribute) {
      const row = merchandise.inventory.attribute_quantities.find(
        (variant) => variant.value_key === item.inventoryValueKey,
      );
      return row ? Math.max(1, row.quantity) : 1;
    }

    return Math.max(1, merchandise.inventory.total_quantity || 1);
  }

  protected onVariantChange(index: number, valueKey: string): void {
    const item = this.editableSale().items[index];
    const option = this.variantOptionsForItem(item).find((variant) => variant.value === valueKey);
    if (!option) return;

    const nextItem = this.applyVariantToItem(item, option);
    this.updateItem(index, {
      inventoryAttributeKey: nextItem.inventoryAttributeKey,
      inventoryAttributeLabel: nextItem.inventoryAttributeLabel,
      inventoryValueKey: nextItem.inventoryValueKey,
      inventoryValueLabel: nextItem.inventoryValueLabel,
      selectedAttributes: nextItem.selectedAttributes,
      quantity: Math.min(item.quantity || 1, Math.max(1, option.quantity)),
    });
  }

  protected canAddVariantItem(item: SaleItem): boolean {
    return this.variantOptionsForItem(item).length > 1;
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
    return formatCurrency(value, currency);
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

  private async prefillFromActiveUser(): Promise<void> {
    try {
      await firstValueFrom(this.auth.isLoading$.pipe(
        filter((isLoading) => !isLoading),
        take(1),
        timeout({ first: 5000 }),
      ));

      const isAuthenticated = await firstValueFrom(this.auth.isAuthenticated$.pipe(
        take(1),
        timeout({ first: 3000 }),
      ));
      if (!isAuthenticated) return;

      const authUser = await firstValueFrom(this.auth.user$.pipe(
        filter((user): user is NonNullable<typeof user> => Boolean(user)),
        take(1),
        timeout({ first: 5000 }),
      ));

      const authUserId = authUser.sub;
      let profile: Auth0User | null = null;

      if (authUserId) {
        try {
          profile = await this.usersService.getUserById(authUserId);
        } catch {
          profile = null;
        }
      }

      if (!this.visible || this.mode !== 'new' || this.sale) return;

      this.applyActiveUserProfile(profile, authUser);
      await this.prepareNovaPoshtaData();
    } catch {
      // Profile prefill is optional; opening a sale form should not fail because of it.
    } finally {
      this.cdr.markForCheck();
    }
  }

  private applyActiveUserProfile(profile: Auth0User | null, authUser: any): void {
    const metadata = profile?.userMetadata || {};
    const delivery = metadata.delivery || {};
    const fallbackNames = this.splitDisplayName(profile?.name || authUser?.name || '');

    const firstName = String(metadata.firstName || authUser?.given_name || fallbackNames.firstName || '');
    const lastName = String(metadata.lastName || authUser?.family_name || fallbackNames.lastName || '');
    const middleName = String(metadata.middleName || '');
    const email = String(profile?.email || authUser?.email || '');
    const phone = String(metadata.phone || '');
    const residentialAddress = String(metadata.residentialAddress || '');

    this.editableSale.update((sale) => ({
      ...sale,
      customer: {
        ...sale.customer,
        firstName: this.keepOrFill(sale.customer.firstName, firstName),
        lastName: this.keepOrFill(sale.customer.lastName, [lastName, middleName].filter(Boolean).join(' ')),
        phone: this.keepOrFill(sale.customer.phone, phone),
        email: this.keepOrFill(sale.customer.email, email),
      },
      shippingAddress: {
        ...sale.shippingAddress,
        deliveryService: this.keepOrFill(sale.shippingAddress.deliveryService, delivery.service || ''),
        areaRef: this.keepOrFill(sale.shippingAddress.areaRef || '', delivery.areaRef || ''),
        region: this.keepOrFill(sale.shippingAddress.region, delivery.region || ''),
        cityRef: this.keepOrFill(sale.shippingAddress.cityRef || '', delivery.cityRef || ''),
        city: this.keepOrFill(sale.shippingAddress.city, delivery.city || ''),
        warehouseRef: this.keepOrFill(sale.shippingAddress.warehouseRef || '', delivery.warehouseRef || ''),
        warehouse: this.keepOrFill(sale.shippingAddress.warehouse, delivery.warehouse || ''),
        street: this.keepOrFill(sale.shippingAddress.street, residentialAddress),
      },
    }));

    this.setSelectedNovaPoshtaPlaceholders(delivery);
  }

  private setSelectedNovaPoshtaPlaceholders(delivery: UserDeliveryProfile): void {
    if (delivery.service !== 'nova_poshta') return;

    this.selectedNovaPoshtaCity.set(
      delivery.cityRef
        ? { Ref: delivery.cityRef, Description: delivery.city || '', Area: delivery.areaRef || '' }
        : null,
    );
    this.selectedNovaPoshtaWarehouse.set(
      delivery.warehouseRef
        ? { Ref: delivery.warehouseRef, Description: delivery.warehouse || '', CityRef: delivery.cityRef || '' }
        : null,
    );
  }

  private keepOrFill(current: string | undefined, next: string): string {
    return current?.trim() ? current : next;
  }

  private splitDisplayName(name: string): { firstName: string; lastName: string } {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return { firstName: '', lastName: '' };
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
  }

  private async prepareMerchandiseData(): Promise<void> {
    const ids = [...new Set(
      this.editableSale().items
        .map((item) => item.merchandiseId)
        .filter((id): id is string => Boolean(id)),
    )];
    if (!ids.length) return;

    this.loadingMerchandise.set(true);
    try {
      const loaded = await Promise.all(
        ids.map((id) => this.merchandiseService.getMerchandiseById(id)),
      );
      this.merchandiseById.update((current) => {
        const next = { ...current };
        for (const item of loaded) next[item._id] = item;
        return next;
      });
      this.ensureSelectedVariants();
    } finally {
      this.loadingMerchandise.set(false);
      this.cdr.markForCheck();
    }
  }

  private ensureSelectedVariants(): void {
    this.editableSale.update((sale) => ({
      ...sale,
      items: sale.items.map((item) => {
        if (item.inventoryValueKey || !this.hasVariants(item)) return item;
        const option = this.variantOptionsForItem(item).find((variant) => variant.quantity > 0)
          ?? this.variantOptionsForItem(item)[0];
        return option ? this.applyVariantToItem(item, option) : item;
      }),
    }));
  }

  private applyVariantToItem(item: SaleItem, option: SaleVariantOption): SaleItem {
    const quantity = Math.min(item.quantity || 1, Math.max(1, option.quantity));
    return {
      ...item,
      inventoryAttributeKey: option.attributeKey,
      inventoryAttributeLabel: option.attributeLabel,
      inventoryValueKey: option.value,
      inventoryValueLabel: option.valueLabel,
      selectedAttributes: [{ label: option.attributeLabel, value: option.valueLabel }],
      quantity,
      totalPrice: quantity * (item.unitPrice || 0),
    };
  }

  private findNextVariantOption(item: SaleItem): SaleVariantOption | null {
    const options = this.variantOptionsForItem(item);
    if (!options.length) return null;

    const used = new Set(
      this.editableSale().items
        .filter((saleItem) => saleItem.merchandiseId === item.merchandiseId)
        .map((saleItem) => saleItem.inventoryValueKey)
        .filter(Boolean),
    );

    return options.find((option) => option.quantity > 0 && !used.has(option.value))
      ?? options.find((option) => !used.has(option.value))
      ?? options.find((option) => option.quantity > 0)
      ?? options[0]
      ?? null;
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
