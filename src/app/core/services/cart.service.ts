import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AddCartItemDto, Cart } from '../models/cart.model';
import { Merchandise, getDiscountedPrice } from '../models/merchandise.model';

interface ApiResponse<T> { success: boolean; message: string; data: T; }

@Injectable({ providedIn: 'root' })
export class CartService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/carts`;
  private readonly guestId = this.getGuestId();

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
      const response = await firstValueFrom(this.http.get<ApiResponse<Cart>>(this.apiUrl, { params: { guestId: this.guestId } }));
      this.cart.set(response.data);
      return response.data;
    } finally { this.loading.set(false); }
  }
  async addItem(item: AddCartItemDto): Promise<Cart> {
    const response = await firstValueFrom(this.http.post<ApiResponse<Cart>>(`${this.apiUrl}/items`, { ...item, guestId: this.guestId }));
    this.cart.set(response.data);
    this.isOpen.set(true);
    return response.data;
  }
  async updateItem(key: string, quantity: number): Promise<Cart> {
    const response = await firstValueFrom(this.http.put<ApiResponse<Cart>>(`${this.apiUrl}/items/${encodeURIComponent(key)}?guestId=${encodeURIComponent(this.guestId)}`, { quantity, guestId: this.guestId }));
    this.cart.set(response.data);
    return response.data;
  }
  async removeItem(key: string): Promise<Cart> {
    const response = await firstValueFrom(this.http.delete<ApiResponse<Cart>>(`${this.apiUrl}/items/${encodeURIComponent(key)}?guestId=${encodeURIComponent(this.guestId)}`));
    this.cart.set(response.data);
    return response.data;
  }
  async clear(): Promise<Cart> {
    const response = await firstValueFrom(this.http.delete<ApiResponse<Cart>>(`${this.apiUrl}/items?guestId=${encodeURIComponent(this.guestId)}`));
    this.cart.set(response.data);
    return response.data;
  }
  key(merchandiseId: string, inventoryValueKey: string | null): string {
    return `${merchandiseId}:${inventoryValueKey || ''}`;
  }
  getGuestIdValue(): string { return this.guestId; }
  private getGuestId(): string {
    const stored = localStorage.getItem('ulia-guest-id');
    if (stored) return stored;
    const created = globalThis.crypto?.randomUUID?.() || `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem('ulia-guest-id', created);
    return created;
  }
}
