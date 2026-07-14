import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Brand, BrandListFilter, BrandPayload } from '../models/brand.model';

interface ApiResponse<T> { data: T; pagination?: { total: number; page: number; limit: number; pages: number }; }

@Injectable({ providedIn: 'root' })
export class BrandsService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/brands`;
  readonly brands = signal<Brand[]>([]);

  async getBrands(filter: BrandListFilter = {}): Promise<Brand[]> {
    let params = new HttpParams();
    Object.entries(filter).forEach(([key, value]) => { if (value !== undefined && value !== '') params = params.set(key, String(value)); });
    const response = await firstValueFrom(this.http.get<ApiResponse<Brand[]>>(this.apiUrl, { params }));
    this.brands.set(response.data);
    return response.data;
  }

  async getBrandBySlug(slug: string): Promise<Brand> {
    return (await firstValueFrom(this.http.get<ApiResponse<Brand>>(`${this.apiUrl}/slug/${encodeURIComponent(slug)}`))).data;
  }

  async createBrand(data: BrandPayload): Promise<Brand> {
    const item = (await firstValueFrom(this.http.post<ApiResponse<Brand>>(this.apiUrl, data))).data;
    this.brands.update((items) => [...items, item]);
    return item;
  }

  async updateBrand(id: string, data: Partial<BrandPayload>): Promise<Brand> {
    const item = (await firstValueFrom(this.http.put<ApiResponse<Brand>>(`${this.apiUrl}/${id}`, data))).data;
    this.brands.update((items) => items.map((brand) => brand._id === id ? item : brand));
    return item;
  }

  async deleteBrand(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.apiUrl}/${id}`));
    this.brands.update((items) => items.filter((brand) => brand._id !== id));
  }
}
