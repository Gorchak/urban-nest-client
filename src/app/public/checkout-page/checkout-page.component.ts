import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { firstValueFrom } from 'rxjs';
import { AdminAccessService } from '../../core/services/admin-access.service';
import { CartService } from '../../core/services/cart.service';
import { SalesService } from '../../core/services/sales.service';
import { Auth0User } from '../../core/models/user.model';
import { CreateSaleDto, SalePaymentMethod } from '../../core/models/sale.model';
import { NovaPoshtaArea, NovaPoshtaCity, NovaPoshtaService, NovaPoshtaWarehouse } from '../../core/services/nova-poshta.service';
import { PublicHeaderComponent } from '../shared/public-header.component';

interface CheckoutForm {
  firstName: string; lastName: string; email: string; phone: string;
  deliveryService: string; areaRef: string; region: string; cityRef: string; city: string;
  warehouseRef: string; warehouse: string; street: string; building: string; apartment: string; postalCode: string;
  paymentMethod: SalePaymentMethod; notes: string; doNotCall: boolean;
}

const emptyForm = (): CheckoutForm => ({
  firstName: '', lastName: '', email: '', phone: '',
  deliveryService: 'nova_poshta', areaRef: '', region: '', cityRef: '', city: '',
  warehouseRef: '', warehouse: '', street: '', building: '', apartment: '', postalCode: '',
  paymentMethod: 'cash_on_delivery', notes: '', doNotCall: false,
});

@Component({
  selector: 'app-checkout-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PublicHeaderComponent],
  templateUrl: './checkout-page.component.html',
  styleUrl: './checkout-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutPageComponent implements OnInit {
  private auth = inject(AuthService);
  private adminAccess = inject(AdminAccessService);
  protected cartService = inject(CartService);
  private salesService = inject(SalesService);
  private novaPoshta = inject(NovaPoshtaService);

  protected isAuthenticated = signal(false);
  protected user = signal<Auth0User | null>(null);
  protected submitting = signal(false);
  protected successOrder = signal<string | null>(null);
  protected error = signal<string | null>(null);
  protected novaPoshtaLoading = signal(false);
  protected areas = signal<NovaPoshtaArea[]>([]);
  protected cities = signal<NovaPoshtaCity[]>([]);
  protected warehouses = signal<NovaPoshtaWarehouse[]>([]);
  protected form = signal<CheckoutForm>(emptyForm());

  async ngOnInit(): Promise<void> {
    const access = await firstValueFrom(this.adminAccess.check());
    this.isAuthenticated.set(access.isAuthenticated);
    this.user.set(access.user);
    await this.cartService.load();
    if (access.user) this.prefill(access.user);
    await this.loadAreas();
    if (this.form().areaRef) await this.onAreaChange(this.form().areaRef, true);
    if (this.form().cityRef) await this.onCityChange(this.form().cityRef, true);
  }

  protected patch(patch: Partial<CheckoutForm>): void { this.form.update((form) => ({ ...form, ...patch })); }
  protected login(): void { this.auth.loginWithRedirect({ appState: { target: '/checkout' } }); }
  protected requiresStreet(): boolean { return this.form().deliveryService === 'courier'; }
  protected formatPrice(value: number): string {
    return new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH', maximumFractionDigits: 0 }).format(value);
  }

  protected async onDeliveryChange(service: string): Promise<void> {
    this.patch({ deliveryService: service, ...(service === 'nova_poshta' ? { street: '', building: '', apartment: '' } : {}) });
    if (service === 'nova_poshta') await this.loadAreas();
  }
  protected async onAreaChange(areaRef: string, preserve = false): Promise<void> {
    const area = this.areas().find((item) => item.Ref === areaRef);
    this.patch({ areaRef, region: area?.Description || '', ...(preserve ? {} : { cityRef: '', city: '', warehouseRef: '', warehouse: '' }) });
    this.novaPoshtaLoading.set(true);
    try { this.cities.set(await this.novaPoshta.getCities(areaRef)); } finally { this.novaPoshtaLoading.set(false); }
  }
  protected async onCityChange(cityRef: string, preserve = false): Promise<void> {
    const city = this.cities().find((item) => item.Ref === cityRef);
    this.patch({ cityRef, city: city?.Description || this.form().city, ...(preserve ? {} : { warehouseRef: '', warehouse: '' }) });
    this.novaPoshtaLoading.set(true);
    try { this.warehouses.set(await this.novaPoshta.getWarehouses(cityRef)); } finally { this.novaPoshtaLoading.set(false); }
  }
  protected onWarehouseChange(warehouseRef: string): void {
    const warehouse = this.warehouses().find((item) => item.Ref === warehouseRef);
    this.patch({ warehouseRef, warehouse: warehouse?.Description || '' });
  }

  protected async submit(): Promise<void> {
    const cart = this.cartService.cart();
    const form = this.form();
    if (!cart?.items.length) return;
    this.submitting.set(true);
    this.error.set(null);
    try {
      const payload: CreateSaleDto & { guestId?: string } = {
        guestId: this.cartService.getGuestIdValue(),
        orderNumber: `UN-${Date.now().toString(36).toUpperCase()}`,
        userId: this.user()?.userId ?? null, status: 'processing',
        customer: { firstName: form.firstName, lastName: form.lastName, email: form.email, phone: form.phone },
        shippingAddress: {
          country: 'Ukraine', city: form.city, cityRef: form.cityRef, region: form.region, areaRef: form.areaRef,
          street: form.street, building: form.building, apartment: form.apartment, postalCode: form.postalCode,
          deliveryService: form.deliveryService, warehouse: form.warehouse, warehouseRef: form.warehouseRef, trackingNumber: '',
        },
        payment: { method: form.paymentMethod, status: 'unpaid', transactionId: '', paidAt: null },
        items: [], subtotal: 0, discountTotal: 0, shippingCost: 0, grandTotal: 0, currency: 'UAH',
        notes: form.notes || null, doNotCall: form.doNotCall, inventoryAdjustment: { state: 'none', updatedAt: null },
      };
      const sale = await this.salesService.checkout(payload);
      this.successOrder.set(sale.orderNumber);
      await this.cartService.load();
    } catch (error: any) {
      this.error.set(error?.error?.message || 'Не вдалося оформити замовлення');
    } finally { this.submitting.set(false); }
  }

  private async loadAreas(): Promise<void> {
    if (this.areas().length) return;
    this.novaPoshtaLoading.set(true);
    try { this.areas.set(await this.novaPoshta.getAreas()); } finally { this.novaPoshtaLoading.set(false); }
  }
  private prefill(user: Auth0User): void {
    const meta = user.userMetadata || {};
    const delivery = meta.delivery || {};
    this.form.set({
      ...emptyForm(), firstName: String(meta.firstName || ''), lastName: String(meta.lastName || ''),
      email: user.email || '', phone: String(meta.phone || ''), deliveryService: delivery.service || 'nova_poshta',
      areaRef: delivery.areaRef || '', region: delivery.region || '', cityRef: delivery.cityRef || '', city: delivery.city || '',
      warehouseRef: delivery.warehouseRef || '', warehouse: delivery.warehouse || '',
    });
  }
}
