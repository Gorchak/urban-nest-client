import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface UploadResult {
  url: string;
  publicId: string;
  width: number;
  height: number;
}

@Injectable({ providedIn: 'root' })
export class UploadService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  /**
   * Uploads a single image file to the server, which streams it to Cloudinary.
   * Returns the Cloudinary secure URL, public_id and image dimensions.
   */
  upload(file: File, folder = 'urban-nest'): Observable<UploadResult> {
    const fd = new FormData();
    fd.append('image', file);
    // folder is handled server-side; kept as param for future multi-folder support
    return this.http.post<UploadResult>(`${this.apiUrl}/upload`, fd);
  }

  /**
   * Deletes an image from Cloudinary by its publicId.
   * The publicId is URL-encoded because it may contain slashes (e.g. "urban-nest/abc123").
   */
  delete(publicId: string): Observable<{ result: string }> {
    return this.http.delete<{ result: string }>(
      `${this.apiUrl}/upload/${encodeURIComponent(publicId)}`
    );
  }
}
