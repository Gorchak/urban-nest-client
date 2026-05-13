import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  ReferenceDefinition,
  CreateReferenceDto,
  UpdateReferenceDto,
} from '../models/reference.model';
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
export class ReferencesService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/references`;

  references = signal<ReferenceDefinition[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  async getReferences(page = 1, limit = 50): Promise<ReferenceDefinition[]> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const url = `${this.apiUrl}?page=${page}&limit=${limit}`;
      const response = await firstValueFrom(
        this.http.get<ApiResponse<ReferenceDefinition[]>>(url)
      );
      this.references.set(response.data);
      return response.data;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch references';
      this.error.set(message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async getReferenceById(id: string): Promise<ReferenceDefinition> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(
        this.http.get<ApiResponse<ReferenceDefinition>>(`${this.apiUrl}/${id}`)
      );
      return response.data;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch reference';
      this.error.set(message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async createReference(data: CreateReferenceDto): Promise<ReferenceDefinition> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(
        this.http.post<ApiResponse<ReferenceDefinition>>(this.apiUrl, data)
      );
      const created = response.data;
      this.references.set([...this.references(), created]);
      return created;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to create reference';
      this.error.set(message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async updateReference(
    id: string,
    data: UpdateReferenceDto
  ): Promise<ReferenceDefinition> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(
        this.http.put<ApiResponse<ReferenceDefinition>>(
          `${this.apiUrl}/${id}`,
          data
        )
      );
      const updated = response.data;
      const current = this.references();
      const index = current.findIndex((r) => r._id === id);
      if (index !== -1) {
        const updatedList = [...current];
        updatedList[index] = updated;
        this.references.set(updatedList);
      }
      return updated;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to update reference';
      this.error.set(message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async deleteReference(id: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        this.http.delete<ApiResponse<null>>(`${this.apiUrl}/${id}`)
      );
      this.references.set(this.references().filter((r) => r._id !== id));
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete reference';
      this.error.set(message);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }
}
