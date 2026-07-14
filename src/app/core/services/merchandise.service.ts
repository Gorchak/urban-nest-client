import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  Merchandise,
  CreateMerchandiseDto,
  UpdateMerchandiseDto,
  MerchandiseListFilter,
  MerchandiseListResponse,
} from '../models/merchandise.model';
import { environment } from '../../../environments/environment';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

@Injectable({
  providedIn: 'root',
})
export class MerchandiseService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/merchandise`;

  merchandise = signal<Merchandise[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  async getMerchandiseList(filter: MerchandiseListFilter = {}): Promise<MerchandiseListResponse> {
    this.loading.set(true);
    this.error.set(null);
    try {
      let params = new HttpParams();
      if (filter.categoryId) params = params.set('categoryId', filter.categoryId);
      if (filter.categorySlug) params = params.set('categorySlug', filter.categorySlug);
      if (filter.brandId) params = params.set('brandId', filter.brandId);
      if (filter.brandSlug) params = params.set('brandSlug', filter.brandSlug);
      if (filter.includeChildren !== undefined) params = params.set('includeChildren', String(filter.includeChildren));
      if (filter.search) params = params.set('search', filter.search);
      if (filter.isActive !== undefined) params = params.set('isActive', String(filter.isActive));
      if (filter.isVisible !== undefined) params = params.set('isVisible', String(filter.isVisible));
      if (filter.isNewArrival !== undefined) params = params.set('isNewArrival', String(filter.isNewArrival));
      if (filter.inStock !== undefined) params = params.set('inStock', String(filter.inStock));
      if (filter.outOfStock !== undefined) params = params.set('outOfStock', String(filter.outOfStock));
      if (filter.inventoryAttributeKey) params = params.set('inventoryAttributeKey', filter.inventoryAttributeKey);
      if (filter.inventoryValueKey) params = params.set('inventoryValueKey', filter.inventoryValueKey);
      if (filter.inventoryInStock !== undefined) params = params.set('inventoryInStock', String(filter.inventoryInStock));
      if (filter.minPrice !== undefined) params = params.set('minPrice', String(filter.minPrice));
      if (filter.maxPrice !== undefined) params = params.set('maxPrice', String(filter.maxPrice));
      if (filter.sortBy) params = params.set('sortBy', filter.sortBy);
      if (filter.sortOrder) params = params.set('sortOrder', filter.sortOrder);
      if (filter.page) params = params.set('page', String(filter.page));
      if (filter.limit) params = params.set('limit', String(filter.limit));

      const response = await firstValueFrom(
        this.http.get<ApiResponse<Merchandise[]>>(this.apiUrl, { params })
      );
      this.merchandise.set(response.data);
      return {
        data: response.data,
        pagination: response.pagination ?? { total: 0, page: 1, limit: 20, pages: 0 },
      };
    } catch (err: any) {
      this.error.set(err.message || 'Failed to fetch merchandise');
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async getMerchandiseById(id: string): Promise<Merchandise> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(
        this.http.get<ApiResponse<Merchandise>>(`${this.apiUrl}/${id}`)
      );
      return response.data;
    } catch (err: any) {
      this.error.set(err.message || 'Failed to fetch merchandise item');
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async getMerchandiseBySlug(slug: string): Promise<Merchandise> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(
        this.http.get<ApiResponse<Merchandise>>(`${this.apiUrl}/slug/${encodeURIComponent(slug)}`)
      );
      return response.data;
    } catch (err: any) {
      this.error.set(err.message || 'Failed to fetch merchandise item');
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async createMerchandise(data: CreateMerchandiseDto): Promise<Merchandise> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(
        this.http.post<ApiResponse<Merchandise>>(this.apiUrl, data)
      );
      const created = response.data;
      this.merchandise.update((current) => [...current, created]);
      return created;
    } catch (err: any) {
      this.error.set(err.message || 'Failed to create merchandise');
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async updateMerchandise(id: string, data: UpdateMerchandiseDto): Promise<Merchandise> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(
        this.http.put<ApiResponse<Merchandise>>(`${this.apiUrl}/${id}`, data)
      );
      const updated = response.data;
      this.merchandise.update((current) => {
        const idx = current.findIndex((m) => m._id === id);
        if (idx === -1) return current;
        const copy = [...current];
        copy[idx] = updated;
        return copy;
      });
      return updated;
    } catch (err: any) {
      this.error.set(err.message || 'Failed to update merchandise');
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async deleteMerchandise(id: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.http.delete<ApiResponse<null>>(`${this.apiUrl}/${id}`));
      this.merchandise.update((current) => current.filter((m) => m._id !== id));
    } catch (err: any) {
      this.error.set(err.message || 'Failed to delete merchandise');
      throw err;
    } finally {
      this.loading.set(false);
    }
  }
}
