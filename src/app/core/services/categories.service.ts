import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Category } from '../models/category.model';
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
export class CategoriesService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/categories`;

  categories = signal<Category[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  async getCategories(page = 1, limit = 50): Promise<Category[]> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const url = `${this.apiUrl}?page=${page}&limit=${limit}`;
      const response = await firstValueFrom(
        this.http.get<ApiResponse<Category[]>>(url)
      );
      this.categories.set(response.data);
      return response.data;
    } catch (err: any) {
      this.error.set(err.message || 'Failed to fetch categories');
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async getCategoryById(id: string): Promise<Category> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const url = `${this.apiUrl}/${id}`;
      const response = await firstValueFrom(
        this.http.get<ApiResponse<Category>>(url)
      );
      return response.data;
    } catch (err: any) {
      this.error.set(err.message || 'Failed to fetch category');
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async createCategory(data: Partial<Category>): Promise<Category> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(
        this.http.post<ApiResponse<Category>>(this.apiUrl, data)
      );
      const created = response.data;
      const current = this.categories();
      this.categories.set([...current, created]);
      return created;
    } catch (err: any) {
      this.error.set(err.message || 'Failed to create category');
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async updateCategory(id: string, data: Partial<Category>): Promise<Category> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const url = `${this.apiUrl}/${id}`;
      const response = await firstValueFrom(
        this.http.put<ApiResponse<Category>>(url, data)
      );
      const updated = response.data;
      const current = this.categories();
      const index = current.findIndex((c) => c._id === id);
      if (index !== -1) {
        const updatedCategories = [...current];
        updatedCategories[index] = updated;
        this.categories.set(updatedCategories);
      }
      return updated;
    } catch (err: any) {
      this.error.set(err.message || 'Failed to update category');
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async deleteCategory(id: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const url = `${this.apiUrl}/${id}`;
      await firstValueFrom(this.http.delete<ApiResponse<null>>(url));
      const current = this.categories();
      this.categories.set(current.filter((c) => c._id !== id));
    } catch (err: any) {
      this.error.set(err.message || 'Failed to delete category');
      throw err;
    } finally {
      this.loading.set(false);
    }
  }
}
