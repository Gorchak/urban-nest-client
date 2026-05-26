import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  forwardRef,
  inject,
  signal,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
  FormsModule,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';

import { UploadService } from '../../../core/services/upload.service';

/** Internal representation — tracks publicId for Cloudinary deletes */
interface UploadedImage {
  url: string;
  /** null for images loaded from DB (only the URL is stored there) */
  publicId: string | null;
}

/**
 * Reusable multi-image upload component.
 *
 * Implements ControlValueAccessor so it works with Reactive Forms:
 *   <app-image-upload formControlName="images" />
 *
 * Also works with @Input/@Output pair:
 *   <app-image-upload [images]="myUrls" (imagesChange)="myUrls = $event" />
 *
 * Features:
 *  - Select multiple files → upload to Cloudinary via POST /api/upload
 *  - Add images by URL (manual input)
 *  - Remove individual images (calls DELETE /api/upload/:publicId for cloud ones)
 *  - Copy URL to clipboard
 *  - Cloudinary-optimised thumbnails (f_auto, q_auto, w_300)
 *  - loading="lazy" decoding="async" on all <img> elements
 *  - Angular Signals + OnPush
 */
@Component({
  selector: 'app-image-upload',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ImageUploadComponent),
      multi: true,
    },
  ],
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    ProgressSpinnerModule,
    TooltipModule,
  ],
  templateUrl: './image-upload.component.html',
  styleUrls: ['./image-upload.component.scss'],
})
export class ImageUploadComponent implements OnChanges, ControlValueAccessor {
  private uploadService = inject(UploadService);
  private cdr = inject(ChangeDetectorRef);

  // ── @Input/@Output API (usable without reactive forms) ────────────────────

  /** Pre-existing image URLs (e.g. from the database). */
  @Input() images: string[] = [];
  /** Emitted whenever the image list changes (URLs only). */
  @Output() imagesChange = new EventEmitter<string[]>();

  // ── ControlValueAccessor wiring ───────────────────────────────────────────

  private onChange: (v: string[]) => void = () => {};
  private onTouched: () => void = () => {};
  protected cvaDriven = false; // true when used inside a reactive form

  writeValue(value: string[] | null): void {
    this.cvaDriven = true;
    const urls = value ?? [];
    const currentUrls = this.items().map((i) => i.url);
    const isSame =
      urls.length === currentUrls.length &&
      urls.every((u, idx) => u === currentUrls[idx]);
    if (!isSame) {
      this.items.set(urls.map((url) => ({ url, publicId: null })));
    }
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (v: string[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
    this.cdr.markForCheck();
  }

  // ── State ─────────────────────────────────────────────────────────────────

  protected items = signal<UploadedImage[]>([]);
  protected uploading = signal(false);
  protected uploadProgress = signal('');
  protected newImageUrl = signal('');
  protected disabled = signal(false);
  protected copiedIndex = signal<number | null>(null);

  // ── Input sync (@Input path) ───────────────────────────────────────────────

  ngOnChanges(changes: SimpleChanges): void {
    if (this.cvaDriven) return; // managed by CVA, ignore @Input
    if (changes['images']) {
      const incoming = (changes['images'].currentValue as string[]) ?? [];
      const currentUrls = this.items().map((i) => i.url);
      const isSame =
        incoming.length === currentUrls.length &&
        incoming.every((u, idx) => u === currentUrls[idx]);
      if (!isSame) {
        this.items.set(incoming.map((url) => ({ url, publicId: null })));
      }
    }
  }

  // ── File upload ────────────────────────────────────────────────────────────

  protected onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const files = Array.from(input.files);
    this.uploading.set(true);
    this.uploadProgress.set(`Завантаження 0 із ${files.length}...`);
    this.cdr.markForCheck();

    let done = 0;
    const uploads = files.map((f) =>
      this.uploadService.upload(f).pipe(
        catchError(() => of(null))
      )
    );

    forkJoin(uploads).subscribe((results) => {
      const successful = results.filter(
        (r): r is NonNullable<typeof r> => r !== null
      );
      done = successful.length;
      this.items.update((list) => [
        ...list,
        ...successful.map((r) => ({ url: r.url, publicId: r.publicId })),
      ]);
      this.uploading.set(false);
      this.uploadProgress.set('');
      this.emitChange();
      input.value = '';
      this.cdr.markForCheck();
    });
  }

  // ── Manual URL ─────────────────────────────────────────────────────────────

  protected addManualUrl(): void {
    const url = this.newImageUrl().trim();
    if (!url || this.items().some((i) => i.url === url)) return;
    this.items.update((list) => [...list, { url, publicId: null }]);
    this.newImageUrl.set('');
    this.emitChange();
    this.cdr.markForCheck();
  }

  // ── Remove ─────────────────────────────────────────────────────────────────

  protected removeImage(index: number): void {
    const item = this.items()[index];

    if (item.publicId) {
      this.uploadService
        .delete(item.publicId)
        .pipe(catchError(() => of(null)))
        .subscribe(() => {
          this.items.update((list) => list.filter((_, i) => i !== index));
          this.emitChange();
          this.onTouched();
          this.cdr.markForCheck();
        });
    } else {
      this.items.update((list) => list.filter((_, i) => i !== index));
      this.emitChange();
      this.onTouched();
      this.cdr.markForCheck();
    }
  }

  // ── Copy URL ───────────────────────────────────────────────────────────────

  protected copyUrl(url: string, index: number): void {
    navigator.clipboard.writeText(url).then(() => {
      this.copiedIndex.set(index);
      setTimeout(() => {
        this.copiedIndex.set(null);
        this.cdr.markForCheck();
      }, 1500);
      this.cdr.markForCheck();
    });
  }

  // ── Optimised URL ──────────────────────────────────────────────────────────

  protected getOptimizedUrl(url: string, width = 300): string {
    if (!url.includes('res.cloudinary.com')) return url;
    return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`);
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private emitChange(): void {
    const urls = this.items().map((i) => i.url);
    this.onChange(urls);
    this.imagesChange.emit(urls);
  }
}
