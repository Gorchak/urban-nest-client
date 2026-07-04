import { Injectable } from '@angular/core';
import { Merchandise } from '../../core/models/merchandise.model';

const STORAGE_KEY = 'ulia-recently-viewed';
const MAX_ITEMS = 12;

@Injectable({ providedIn: 'root' })
export class RecentlyViewedService {
  add(product: Merchandise): void {
    const storage = this.storage();
    if (!storage) return;

    const ids = this.getIds().filter((id) => id !== product._id);
    storage.setItem(STORAGE_KEY, JSON.stringify([product._id, ...ids].slice(0, MAX_ITEMS)));
  }

  resolve(products: Merchandise[], excludeId?: string): Merchandise[] {
    const productMap = new Map(products.map((product) => [product._id, product]));
    return this.getIds()
      .filter((id) => id !== excludeId)
      .map((id) => productMap.get(id))
      .filter((product): product is Merchandise => Boolean(product?.isActive && product?.isVisible));
  }

  private getIds(): string[] {
    const storage = this.storage();
    if (!storage) return [];

    try {
      const value = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]');
      return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  }

  private storage(): Storage | null {
    return typeof window === 'undefined' ? null : window.localStorage;
  }
}
