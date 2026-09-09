import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { catchError, filter, firstValueFrom, of, take, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AddCartItemDto, Cart, CartItem } from '../models/cart.model';
import { Merchandise, getDiscountedPrice } from '../models/merchandise.model';

interface ApiResponse<T> { success: boolean; message: string; data: T; }

@Injectable({ providedIn: 'root' })
export class CartService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private readonly apiUrl = `${environment.apiUrl}/carts`;
  private readonly guestId = this.getGuestId();
  private readonly localCartKey = 'ulia-guest-cart';

  cart = signal<Cart | null>(null);
  loading = signal(false);
  isOpen = signal(false);
  itemCount = computed(() => this.cart()?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0);
  subtotal = computed(() => this.cart()?.items.reduce((sum, item) => sum + this.unitPrice(item.product) * item.quantity, 0) ?? 0);

  unitPrice(product: Merchandise | null | undefined): number {
    return product ? getDiscountedPrice(product) : 0;
  }

  async load(): Promise<Cart> {
    this.loading.set(true);
    try {
      if (!(await this.isAuthenticated())) {
        const cart = this.getLocalCart();
        this.cart.set(cart);
        return cart;
      }

      let serverCart = await this.loadServerCart();
      const localCart = this.getLocalCart();

      if (!serverCart.items.length && localCart.items.length) {
        serverCart = await this.migrateLocalCartToServer(localCart.items);
        this.clearLocalCart();
      }

      this.cart.set(serverCart);
      return serverCart;
    } finally {
      this.loading.set(false);
    }
  }

  async addItem(item: AddCartItemDto, product?: Merchandise): Promise<Cart> {
    if (!(await this.isAuthenticated())) {
      const cart = this.addLocalItem(item, product);
      this.cart.set(cart);
      this.isOpen.set(true);
      return cart;
    }

    const cart = await this.addServerItem(item);
    this.cart.set(cart);
    this.isOpen.set(true);
    return cart;
  }

  async updateItem(key: string, quantity: number): Promise<Cart> {
    if (!(await this.isAuthenticated())) {
      const cart = this.updateLocalItem(key, quantity);
      this.cart.set(cart);
      return cart;
    }

    const response = await firstValueFrom(this.http.put<ApiResponse<Cart>>(
      `${this.apiUrl}/items/${encodeURIComponent(key)}?guestId=${encodeURIComponent(this.guestId)}`,
      { quantity, guestId: this.guestId },
    ));
    this.cart.set(response.data);
    return response.data;
  }

  async removeItem(key: string): Promise<Cart> {
    if (!(await this.isAuthenticated())) {
      const cart = this.removeLocalItem(key);
      this.cart.set(cart);
      return cart;
    }

    const response = await firstValueFrom(this.http.delete<ApiResponse<Cart>>(
      `${this.apiUrl}/items/${encodeURIComponent(key)}?guestId=${encodeURIComponent(this.guestId)}`,
    ));
    this.cart.set(response.data);
    return response.data;
  }

  async clear(): Promise<Cart> {
    if (!(await this.isAuthenticated())) {
      const cart = this.replaceLocalItems([]);
      this.cart.set(cart);
      return cart;
    }

    const response = await firstValueFrom(this.http.delete<ApiResponse<Cart>>(
      `${this.apiUrl}/items?guestId=${encodeURIComponent(this.guestId)}`,
    ));
    this.cart.set(response.data);
    return response.data;
  }

  async prepareForCheckout(): Promise<void> {
    if (await this.isAuthenticated()) return;

    const localItems = this.getLocalCart().items;
    await this.clearServerGuestCart();
    for (const item of localItems) {
      await this.addServerItem({
        merchandiseId: item.merchandiseId,
        inventoryValueKey: item.inventoryValueKey,
        inventoryValueLabel: item.inventoryValueLabel,
        quantity: item.quantity,
      });
    }
  }

  async handleCheckoutComplete(): Promise<Cart> {
    if (!(await this.isAuthenticated())) {
      await this.clearServerGuestCart();
      const cart = this.replaceLocalItems([]);
      this.cart.set(cart);
      return cart;
    }

    return this.load();
  }

  key(merchandiseId: string, inventoryValueKey: string | null): string {
    return `${merchandiseId}:${inventoryValueKey || ''}`;
  }

  getGuestIdValue(): string { return this.guestId; }

  private async isAuthenticated(): Promise<boolean> {
    const isLoading$ = this.auth.isLoading$;
    const isAuthenticated$ = this.auth.isAuthenticated$;
    if (!isLoading$?.pipe || !isAuthenticated$?.pipe) return false;

    await firstValueFrom(isLoading$.pipe(
      filter((loading) => !loading),
      take(1),
      timeout({ first: 5000, with: () => of(false) }),
      catchError(() => of(false)),
    ));

    const authenticated = await firstValueFrom(isAuthenticated$.pipe(
      take(1),
      timeout({ first: 5000, with: () => of(false) }),
      catchError(() => of(false)),
    ));
    if (!authenticated) return false;

    return Boolean(this.auth.token);
  }

  private async loadServerCart(): Promise<Cart> {
    const response = await firstValueFrom(this.http.get<ApiResponse<Cart>>(
      this.apiUrl,
      { params: { guestId: this.guestId } },
    ));
    return response.data;
  }

  private async addServerItem(item: AddCartItemDto): Promise<Cart> {
    const response = await firstValueFrom(this.http.post<ApiResponse<Cart>>(
      `${this.apiUrl}/items`,
      { ...item, guestId: this.guestId },
    ));
    return response.data;
  }

  private async clearServerGuestCart(): Promise<void> {
    await firstValueFrom(this.http.delete<ApiResponse<Cart>>(
      `${this.apiUrl}/items?guestId=${encodeURIComponent(this.guestId)}`,
    ));
  }

  private async migrateLocalCartToServer(items: CartItem[]): Promise<Cart> {
    let cart = await this.loadServerCart();
    for (const item of items) {
      try {
        cart = await this.addServerItem({
          merchandiseId: item.merchandiseId,
          inventoryValueKey: item.inventoryValueKey,
          inventoryValueLabel: item.inventoryValueLabel,
          quantity: item.quantity,
        });
      } catch {
        // Stale guest-cart items should not block login or page rendering.
      }
    }
    return cart;
  }

  private getLocalCart(): Cart {
    return this.createCart(this.readLocalItems());
  }

  private readLocalItems(): CartItem[] {
    try {
      const parsed = JSON.parse(localStorage.getItem(this.localCartKey) || '[]');
      return Array.isArray(parsed)
        ? parsed.filter((item) => item?.merchandiseId && Number(item.quantity) > 0)
        : [];
    } catch {
      return [];
    }
  }

  private writeLocalItems(items: CartItem[]): void {
    localStorage.setItem(this.localCartKey, JSON.stringify(items));
  }

  private clearLocalCart(): void {
    localStorage.removeItem(this.localCartKey);
  }

  private replaceLocalItems(items: CartItem[]): Cart {
    this.writeLocalItems(items);
    return this.createCart(items);
  }

  private addLocalItem(input: AddCartItemDto, product?: Merchandise): Cart {
    const items = this.readLocalItems();
    const key = this.key(input.merchandiseId, input.inventoryValueKey ?? null);
    const maxQuantity = product ? this.availableQuantity(product, input.inventoryValueKey ?? null) : Number.MAX_SAFE_INTEGER;
    const quantity = Math.max(1, Math.floor(Number(input.quantity) || 1));
    const index = items.findIndex((item) => this.key(item.merchandiseId, item.inventoryValueKey) === key);

    if (index >= 0) {
      items[index] = {
        ...items[index],
        quantity: Math.min(maxQuantity, items[index].quantity + quantity),
        product: product ?? items[index].product,
      };
    } else {
      items.push({
        merchandiseId: input.merchandiseId,
        inventoryValueKey: input.inventoryValueKey ?? null,
        inventoryValueLabel: input.inventoryValueLabel ?? null,
        quantity: Math.min(maxQuantity, quantity),
        product: product ?? null,
      });
    }

    return this.replaceLocalItems(items);
  }

  private updateLocalItem(key: string, quantity: number): Cart {
    const items = this.readLocalItems().map((item) => {
      if (this.key(item.merchandiseId, item.inventoryValueKey) !== key) return item;
      const maxQuantity = item.product ? this.availableQuantity(item.product, item.inventoryValueKey) : Number.MAX_SAFE_INTEGER;
      return { ...item, quantity: Math.min(maxQuantity, Math.max(1, Math.floor(quantity))) };
    });
    return this.replaceLocalItems(items);
  }

  private removeLocalItem(key: string): Cart {
    const items = this.readLocalItems().filter((item) => this.key(item.merchandiseId, item.inventoryValueKey) !== key);
    return this.replaceLocalItems(items);
  }

  private createCart(items: CartItem[]): Cart {
    const now = new Date().toISOString();
    return {
      _id: 'local-cart',
      userId: null,
      guestId: this.guestId,
      user: { userId: '', email: '' },
      items,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
  }

  private availableQuantity(product: Merchandise, inventoryValueKey: string | null): number {
    const inventory = product.inventory;
    if (inventory.tracked_attribute) {
      return inventory.attribute_quantities.find((row) => row.value_key === inventoryValueKey)?.quantity ?? 0;
    }
    return inventory.total_quantity;
  }

  private getGuestId(): string {
    const stored = localStorage.getItem('ulia-guest-id');
    if (stored) return stored;
    const created = globalThis.crypto?.randomUUID?.() || `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem('ulia-guest-id', created);
    return created;
  }
}
