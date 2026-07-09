import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateSaleDto,
  QuickOrderDto,
  Sale,
  SaleListFilter,
  SaleListResponse,
  UpdateSaleDto,
} from '../models/sale.model';

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

@Injectable({ providedIn: 'root' })
export class SalesService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/sales`;

  sales = signal<Sale[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  async getSales(filter: SaleListFilter = {}): Promise<SaleListResponse> {
    this.loading.set(true);
    this.error.set(null);
    try {
      let params = new HttpParams();
      if (filter.search) params = params.set('search', filter.search);
      if (filter.status) params = params.set('status', filter.status);
      if (filter.paymentStatus) params = params.set('paymentStatus', filter.paymentStatus);
      if (filter.categoryId) params = params.set('categoryId', filter.categoryId);
      if (filter.page) params = params.set('page', String(filter.page));
      if (filter.limit) params = params.set('limit', String(filter.limit));

      const response = await firstValueFrom(
        this.http.get<ApiResponse<Sale[]>>(this.apiUrl, { params }),
      );
      this.sales.set(response.data);
      return {
        data: response.data,
        pagination: response.pagination ?? { total: 0, page: 1, limit: 20, pages: 0 },
      };
    } catch (err: any) {
      this.error.set(err.message || 'Failed to fetch sales');
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async getMySales(filter: SaleListFilter = {}): Promise<SaleListResponse> {
    this.loading.set(true);
    this.error.set(null);
    try {
      let params = new HttpParams();
      if (filter.status) params = params.set('status', filter.status);
      if (filter.paymentStatus) params = params.set('paymentStatus', filter.paymentStatus);
      if (filter.categoryId) params = params.set('categoryId', filter.categoryId);
      if (filter.page) params = params.set('page', String(filter.page));
      if (filter.limit) params = params.set('limit', String(filter.limit));

      const response = await firstValueFrom(
        this.http.get<ApiResponse<Sale[]>>(`${this.apiUrl}/my`, { params }),
      );
      return {
        data: response.data,
        pagination: response.pagination ?? { total: 0, page: 1, limit: 10, pages: 0, grandTotal: 0 },
      };
    } catch (err: any) {
      this.error.set(err.message || 'Failed to fetch purchase history');
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async createSale(data: CreateSaleDto): Promise<Sale> {
    const response = await firstValueFrom(
      this.http.post<ApiResponse<Sale>>(this.apiUrl, data),
    );
    return response.data;
  }

  async checkout(data: CreateSaleDto): Promise<Sale> {
    const response = await firstValueFrom(
      this.http.post<ApiResponse<Sale>>(`${this.apiUrl}/checkout`, data),
    );
    return response.data;
  }

  async quickOrder(data: QuickOrderDto): Promise<Sale> {
    const response = await firstValueFrom(
      this.http.post<ApiResponse<Sale>>(`${this.apiUrl}/quick-order`, data),
    );
    return response.data;
  }

  async updateSale(id: string, data: UpdateSaleDto): Promise<Sale> {
    const response = await firstValueFrom(
      this.http.put<ApiResponse<Sale>>(`${this.apiUrl}/${id}`, data),
    );
    return response.data;
  }

  async deleteSale(id: string): Promise<void> {
    await firstValueFrom(this.http.delete<ApiResponse<null>>(`${this.apiUrl}/${id}`));
  }
}
