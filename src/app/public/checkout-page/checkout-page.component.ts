import { ChangeDetectionStrategy, Component, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { firstValueFrom } from 'rxjs';
import { AdminAccessService } from '../../core/services/admin-access.service';
import { CartService } from '../../core/services/cart.service';
import { SalesService } from '../../core/services/sales.service';
import { Auth0User } from '../../core/models/user.model';
import { CreateSaleDto, SalePaymentMethod } from '../../core/models/sale.model';
import { NovaPoshtaArea, NovaPoshtaCity, NovaPoshtaService, NovaPoshtaWarehouse } from '../../core/services/nova-poshta.service';
import { formatCurrency } from '../../core/utils/price-format';
import { OptimizedImageComponent } from '../../shared/components/optimized-image/optimized-image.component';

interface CheckoutForm {
  firstName: string; lastName: string; email: string; phone: string;
  deliveryService: string; areaRef: string; region: string; cityRef: string; city: string;
  warehouseRef: string; warehouse: string; street: string; building: string; apartment: string; postalCode: string;
  paymentMethod: SalePaymentMethod; notes: string; doNotCall: boolean;
}

type CheckoutFormErrors = Partial<Record<keyof CheckoutForm, string>>;

const emptyForm = (): CheckoutForm => ({
  firstName: '', lastName: '', email: '', phone: '',
  deliveryService: 'nova_poshta', areaRef: '', region: '', cityRef: '', city: '',
  warehouseRef: '', warehouse: '', street: '', building: '', apartment: '', postalCode: '',
  paymentMethod: 'cash_on_delivery', notes: '', doNotCall: false,
});

@Component({
  selector: 'app-checkout-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AutoCompleteModule, OptimizedImageComponent],
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
  private route = inject(ActivatedRoute);

  protected isAuthenticated = signal(false);
  protected user = signal<Auth0User | null>(null);
  protected submitting = signal(false);
  protected successOrder = signal<string | null>(null);
  protected error = signal<string | null>(null);
  protected novaPoshtaLoading = signal(false);
  protected areas = signal<NovaPoshtaArea[]>([]);
  protected areaSuggestions = signal<NovaPoshtaArea[]>([]);
  protected cities = signal<NovaPoshtaCity[]>([]);
  protected warehouses = signal<NovaPoshtaWarehouse[]>([]);
  protected selectedArea = signal<NovaPoshtaArea | string | null>(null);
  protected selectedCity = signal<NovaPoshtaCity | string | null>(null);
  protected selectedWarehouse = signal<NovaPoshtaWarehouse | string | null>(null);
  protected form = signal<CheckoutForm>(emptyForm());
  protected formErrors = signal<CheckoutFormErrors>({});
  private cityRequestId = 0;
  private warehouseRequestId = 0;

  @ViewChild('checkoutForm') private checkoutForm?: ElementRef<HTMLElement>;

  async ngOnInit(): Promise<void> {
    const access = await firstValueFrom(this.adminAccess.check());
    this.isAuthenticated.set(access.isAuthenticated);
    this.user.set(access.user);
    await this.cartService.load();
    await this.handlePaymentReturn();
    if (access.user) this.prefill(access.user);
    await this.loadAreas();
    if (this.form().areaRef) await this.onAreaChange(this.form().areaRef, true);
    if (this.form().cityRef) await this.onCityChange(this.form().cityRef, true);
    if (this.form().warehouseRef) this.onWarehouseChange(this.form().warehouseRef);
  }

  protected patch(patch: Partial<CheckoutForm>): void {
    this.form.update((form) => ({ ...form, ...patch }));
    this.formErrors.update((errors) => {
      const next = { ...errors };
      Object.keys(patch).forEach((key) => delete next[key as keyof CheckoutForm]);
      return next;
    });
  }
  protected fieldError(field: keyof CheckoutForm): string { return this.formErrors()[field] || ''; }
  protected hasFieldError(field: keyof CheckoutForm): boolean { return Boolean(this.formErrors()[field]); }
  protected login(): void { this.auth.loginWithRedirect({ appState: { target: '/checkout' } }); }
  protected requiresStreet(): boolean { return this.form().deliveryService === 'courier'; }
  protected formatPrice(value: number): string {
    return formatCurrency(value);
  }

  protected async onDeliveryChange(service: string): Promise<void> {
    this.patch({ deliveryService: service, ...(service === 'nova_poshta' ? { street: '', building: '', apartment: '' } : {}) });
    if (service === 'nova_poshta') await this.loadAreas();
  }
  protected async onAreaChange(areaRef: string, preserve = false): Promise<void> {
    const area = this.areas().find((item) => item.Ref === areaRef);
    this.selectedArea.set(area || this.form().region || null);
    this.patch({ areaRef, region: area?.Description || '', ...(preserve ? {} : { cityRef: '', city: '', warehouseRef: '', warehouse: '' }) });
    if (!preserve) {
      this.selectedCity.set(null);
      this.selectedWarehouse.set(null);
    }
    this.novaPoshtaLoading.set(true);
    try { this.cities.set(await this.novaPoshta.getCities(areaRef)); } finally { this.novaPoshtaLoading.set(false); }
  }
  protected async onCityChange(cityRef: string, preserve = false): Promise<void> {
    const city = this.cities().find((item) => item.Ref === cityRef);
    this.selectedCity.set(city || this.form().city || null);
    this.patch({ cityRef, city: city?.Description || this.form().city, ...(preserve ? {} : { warehouseRef: '', warehouse: '' }) });
    if (!preserve) this.selectedWarehouse.set(null);
    this.novaPoshtaLoading.set(true);
    try { this.warehouses.set(await this.novaPoshta.getWarehouses(cityRef)); } finally { this.novaPoshtaLoading.set(false); }
  }
  protected onWarehouseChange(warehouseRef: string): void {
    const warehouse = this.warehouses().find((item) => item.Ref === warehouseRef);
    this.selectedWarehouse.set(warehouse || this.form().warehouse || null);
    this.patch({ warehouseRef, warehouse: warehouse?.Description || '' });
  }

  protected searchAreas(query = ''): void {
    const normalized = query.trim().toLocaleLowerCase('uk-UA');
    this.areaSuggestions.set(this.areas().filter((area) =>
      area.Description.toLocaleLowerCase('uk-UA').includes(normalized)
    ));
  }

  protected onAreaModelChange(value: NovaPoshtaArea | string | null): void {
    this.selectedArea.set(value);
    if (typeof value !== 'string') return;
    this.patch({ region: value, areaRef: '', city: '', cityRef: '', warehouse: '', warehouseRef: '' });
    this.selectedCity.set(null);
    this.selectedWarehouse.set(null);
  }

  protected async searchCities(query = ''): Promise<void> {
    const requestId = ++this.cityRequestId;
    this.novaPoshtaLoading.set(true);
    try {
      const cities = await this.novaPoshta.getCities(this.form().areaRef || undefined, query, 50);
      if (requestId === this.cityRequestId) this.cities.set(cities);
    } finally {
      if (requestId === this.cityRequestId) this.novaPoshtaLoading.set(false);
    }
  }

  protected onCityModelChange(value: NovaPoshtaCity | string | null): void {
    this.selectedCity.set(value);
    if (typeof value !== 'string') return;
    this.patch({ city: value, cityRef: '', warehouse: '', warehouseRef: '' });
    this.selectedWarehouse.set(null);
  }

  protected async searchWarehouses(query = ''): Promise<void> {
    if (!this.form().cityRef) return;
    const requestId = ++this.warehouseRequestId;
    this.novaPoshtaLoading.set(true);
    try {
      const warehouses = await this.novaPoshta.getWarehouses(this.form().cityRef, query, 50);
      if (requestId === this.warehouseRequestId) this.warehouses.set(warehouses);
    } finally {
      if (requestId === this.warehouseRequestId) this.novaPoshtaLoading.set(false);
    }
  }

  protected onWarehouseModelChange(value: NovaPoshtaWarehouse | string | null): void {
    this.selectedWarehouse.set(value);
    if (typeof value === 'string') this.patch({ warehouse: value, warehouseRef: '' });
  }

  protected async submit(): Promise<void> {
    const cart = this.cartService.cart();
    const form = this.form();
    if (!cart?.items.length) return;
    if (!this.validateForm(form)) {
      this.scrollToFormTop();
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    try {
      const isOnlinePayment = form.paymentMethod === 'wayforpay';
      await this.cartService.prepareForCheckout();
      const payload: CreateSaleDto & { guestId?: string } = {
        guestId: this.cartService.getGuestIdValue(),
        orderNumber: `UN-${Date.now().toString(36).toUpperCase()}`,
        userId: this.user()?.userId ?? null, status: isOnlinePayment ? 'pending_payment' : 'processing',
        customer: { firstName: form.firstName, lastName: form.lastName, email: form.email, phone: form.phone },
        shippingAddress: {
          country: 'Ukraine', city: form.city, cityRef: form.cityRef, region: form.region, areaRef: form.areaRef,
          street: form.street, building: form.building, apartment: form.apartment, postalCode: form.postalCode,
          deliveryService: form.deliveryService, warehouse: form.warehouse, warehouseRef: form.warehouseRef, trackingNumber: '',
        },
        payment: {
          method: form.paymentMethod,
          status: 'unpaid',
          transactionId: '',
          paidAt: null,
        },
        items: [], subtotal: 0, discountTotal: 0, shippingCost: 0, grandTotal: 0, currency: 'UAH',
        notes: form.notes || null, doNotCall: form.doNotCall, inventoryAdjustment: { state: 'none', updatedAt: null },
      };
      const sale = await this.salesService.checkout(payload);
      if (sale.paymentRedirect) {
        this.submitPaymentRedirect(sale.paymentRedirect);
        return;
      }
      await this.cartService.handleCheckoutComplete();
      this.successOrder.set(sale.orderNumber);
    } catch (error: any) {
      this.error.set(error?.error?.message || error?.message || 'Не вдалося оформити замовлення');
    } finally { this.submitting.set(false); }
  }

  private validateForm(form: CheckoutForm): boolean {
    const errors: CheckoutFormErrors = {};
    if (!form.firstName.trim()) errors.firstName = 'Вкажіть імʼя';
    if (!form.phone.trim()) errors.phone = 'Вкажіть номер телефону';
    if (form.deliveryService === 'nova_poshta') {
      if (!form.region.trim()) errors.areaRef = 'Вкажіть область';
      if (!form.city.trim()) errors.cityRef = 'Вкажіть місто';
      if (!form.warehouse.trim()) errors.warehouseRef = 'Вкажіть відділення';
    }
    if (form.deliveryService === 'courier') {
      if (!form.city.trim()) errors.city = 'Вкажіть місто';
      if (!form.street.trim()) errors.street = 'Вкажіть вулицю';
      if (!form.building.trim()) errors.building = 'Вкажіть будинок / квартиру';
    }

    this.formErrors.set(errors);
    return Object.keys(errors).length === 0;
  }

  private scrollToFormTop(): void {
    const firstInvalid = this.checkoutForm?.nativeElement.querySelector('.field-error') as HTMLElement | null;
    (firstInvalid || this.checkoutForm?.nativeElement)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private submitPaymentRedirect(paymentRedirect: NonNullable<import('../../core/models/sale.model').Sale['paymentRedirect']>): void {
    const target = new URL(paymentRedirect.url);
    if (target.protocol !== 'https:' || target.hostname !== 'secure.wayforpay.com') {
      throw new Error('Некоректна адреса платіжної сторінки');
    }
    window.location.assign(target.toString());
  }

  private async handlePaymentReturn(): Promise<void> {
    if (this.route.snapshot.queryParamMap.get('payment') !== 'return') return;
    const paymentError = this.route.snapshot.queryParamMap.get('paymentError');
    if (paymentError) {
      this.error.set(paymentError);
      return;
    }
    const orderReference = this.route.snapshot.queryParamMap.get('orderReference');
    if (!orderReference) {
      this.error.set('Не вдалося перевірити результат оплати. Спробуйте оформити замовлення ще раз.');
      return;
    }

    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const result = await this.salesService.getWayForPayStatus(orderReference);
        if (result.status === 'approved') {
          await this.cartService.handleCheckoutComplete();
          this.successOrder.set(orderReference);
          return;
        }
        if (result.status === 'declined' || result.status === 'not_found') {
          this.error.set(result.reason || 'Оплата не пройшла. Спробуйте ще раз або виберіть інший спосіб оплати.');
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      this.error.set('Підтвердження оплати ще не отримано. Спробуйте оновити сторінку через кілька секунд.');
    } catch {
      this.error.set('Не вдалося перевірити результат оплати. Спробуйте ще раз або виберіть інший спосіб оплати.');
    }
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
