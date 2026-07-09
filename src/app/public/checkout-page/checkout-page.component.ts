import { ChangeDetectionStrategy, Component, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { firstValueFrom } from 'rxjs';
import { AdminAccessService } from '../../core/services/admin-access.service';
import { CartService } from '../../core/services/cart.service';
import { GooglePayPaymentResult, GooglePayService } from '../../core/services/google-pay.service';
import { SalesService } from '../../core/services/sales.service';
import { Auth0User } from '../../core/models/user.model';
import { CreateSaleDto, SalePaymentMethod } from '../../core/models/sale.model';
import { NovaPoshtaArea, NovaPoshtaCity, NovaPoshtaService, NovaPoshtaWarehouse } from '../../core/services/nova-poshta.service';
import { formatCurrency } from '../../core/utils/price-format';

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
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './checkout-page.component.html',
  styleUrl: './checkout-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutPageComponent implements OnInit {
  private auth = inject(AuthService);
  private adminAccess = inject(AdminAccessService);
  protected cartService = inject(CartService);
  private googlePay = inject(GooglePayService);
  private salesService = inject(SalesService);
  private novaPoshta = inject(NovaPoshtaService);
  private googlePayButtonContainer: ElementRef<HTMLElement> | null = null;

  protected isAuthenticated = signal(false);
  protected user = signal<Auth0User | null>(null);
  protected submitting = signal(false);
  protected successOrder = signal<string | null>(null);
  protected error = signal<string | null>(null);
  protected novaPoshtaLoading = signal(false);
  protected googlePayAvailable = signal(false);
  protected googlePayLoading = signal(false);
  protected googlePayError = signal<string | null>(null);
  protected areas = signal<NovaPoshtaArea[]>([]);
  protected cities = signal<NovaPoshtaCity[]>([]);
  protected warehouses = signal<NovaPoshtaWarehouse[]>([]);
  protected form = signal<CheckoutForm>(emptyForm());
  protected formErrors = signal<CheckoutFormErrors>({});

  @ViewChild('checkoutForm') private checkoutForm?: ElementRef<HTMLElement>;
  @ViewChild('googlePayButton')
  set googlePayButton(element: ElementRef<HTMLElement> | undefined) {
    this.googlePayButtonContainer = element ?? null;
    void this.renderGooglePayButton();
  }

  async ngOnInit(): Promise<void> {
    const access = await firstValueFrom(this.adminAccess.check());
    this.isAuthenticated.set(access.isAuthenticated);
    this.user.set(access.user);
    await this.cartService.load();
    void this.initGooglePay();
    if (access.user) this.prefill(access.user);
    await this.loadAreas();
    if (this.form().areaRef) await this.onAreaChange(this.form().areaRef, true);
    if (this.form().cityRef) await this.onCityChange(this.form().cityRef, true);
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

  protected async payWithGooglePay(): Promise<void> {
    this.patch({ paymentMethod: 'google_pay' });
    await this.submit();
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
      let googlePayPayment: GooglePayPaymentResult | null = null;
      if (form.paymentMethod === 'google_pay') {
        googlePayPayment = await this.googlePay.loadPaymentData(this.cartService.subtotal());
        if (!googlePayPayment.token) throw new Error('Google Pay не повернув платіжний токен');
      }
      await this.cartService.prepareForCheckout();
      const payload: CreateSaleDto & { guestId?: string } = {
        guestId: this.cartService.getGuestIdValue(),
        orderNumber: `UN-${Date.now().toString(36).toUpperCase()}`,
        userId: this.user()?.userId ?? null, status: form.paymentMethod === 'google_pay' ? 'pending_payment' : 'processing',
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
          cardNetwork: googlePayPayment?.cardNetwork ?? null,
          cardDetails: googlePayPayment?.cardDetails ?? null,
          tokenizationType: googlePayPayment?.tokenizationType ?? null,
        },
        items: [], subtotal: 0, discountTotal: 0, shippingCost: 0, grandTotal: 0, currency: 'UAH',
        notes: form.notes || null, doNotCall: form.doNotCall, inventoryAdjustment: { state: 'none', updatedAt: null },
      };
      const sale = await this.salesService.checkout(payload);
      this.successOrder.set(sale.orderNumber);
      await this.cartService.handleCheckoutComplete();
    } catch (error: any) {
      this.error.set(error?.error?.message || error?.message || 'Не вдалося оформити замовлення');
    } finally { this.submitting.set(false); }
  }

  private validateForm(form: CheckoutForm): boolean {
    const errors: CheckoutFormErrors = {};
    if (!form.firstName.trim()) errors.firstName = 'Вкажіть імʼя';
    if (!form.phone.trim()) errors.phone = 'Вкажіть номер телефону';
    if (form.deliveryService === 'nova_poshta') {
      if (!form.areaRef) errors.areaRef = 'Оберіть область';
      if (!form.cityRef) errors.cityRef = 'Оберіть місто';
      if (!form.warehouseRef) errors.warehouseRef = 'Оберіть відділення';
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

  private async initGooglePay(): Promise<void> {
    this.googlePayLoading.set(true);
    this.googlePayError.set(null);
    try {
      this.googlePayAvailable.set(await this.googlePay.isReadyToPay());
      await this.renderGooglePayButton();
    } catch (error: any) {
      this.googlePayAvailable.set(false);
      this.googlePayError.set(error?.message || 'Google Pay тимчасово недоступний');
    } finally {
      this.googlePayLoading.set(false);
    }
  }

  private async renderGooglePayButton(): Promise<void> {
    const container = this.googlePayButtonContainer?.nativeElement;
    if (!container || !this.googlePayAvailable()) return;
    container.replaceChildren();
    const button = await this.googlePay.createButton(() => void this.payWithGooglePay());
    container.appendChild(button);
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
