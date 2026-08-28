import {
  Component,
  forwardRef,
  inject,
  signal,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Input,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
  FormsModule,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { UploadService } from '../../../core/services/upload.service';

/**
 * Reusable single-image picker that implements ControlValueAccessor.
 *
 * Supports:
 *  - Typed URL input (bound directly as the form value)
 *  - File upload via modal → uploads to Cloudinary → writes resulting URL
 *  - Preview thumbnail when a URL is present
 *  - Clear / replace
 *  - Lazy + async image decoding
 *
 * Usage with Reactive Forms:
 *   <app-single-image-picker formControlName="image" label="Основне зображення" />
 *
 * Usage standalone:
 *   <app-single-image-picker [(value)]="myUrl" label="Іконка" />
 */
@Component({
  selector: 'app-single-image-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SingleImagePickerComponent),
      multi: true,
    },
  ],
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    DialogModule,
    ProgressSpinnerModule,
  ],
  templateUrl: './single-image-picker.component.html',
  styleUrls: ['./single-image-picker.component.scss'],
})
export class SingleImagePickerComponent implements ControlValueAccessor {
  private uploadService = inject(UploadService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  @Input() label = 'Зображення';
  @Input() placeholder = 'https://...';

  // ── ControlValueAccessor wiring ───────────────────────────────────────────

  protected url = signal('');
  protected disabled = signal(false);

  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string | null): void {
    this.url.set(value ?? '');
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
    this.cdr.markForCheck();
  }

  // ── Modal state ───────────────────────────────────────────────────────────

  protected dialogVisible = signal(false);
  protected dialogUrl = signal('');
  protected uploading = signal(false);
  /** publicId of the image uploaded in the current modal session (for rollback on cancel) */
  private dialogPublicId: string | null = null;

  protected openDialog(): void {
    this.dialogUrl.set(this.url());
    this.dialogPublicId = null;
    this.dialogVisible.set(true);
    this.cdr.markForCheck();
  }

  protected closeDialog(): void {
    this.dialogVisible.set(false);
    this.cdr.markForCheck();
  }

  protected confirmDialog(): void {
    const chosen = this.dialogUrl().trim();
    this.emit(chosen);
    this.dialogVisible.set(false);
    this.cdr.markForCheck();
  }

  // ── File upload (inside modal) ─────────────────────────────────────────────

  protected onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploading.set(true);
    this.cdr.markForCheck();

    this.uploadService
      .upload(file)
      .pipe(
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.uploading.set(false);
        if (result) {
          this.dialogUrl.set(result.url);
          this.dialogPublicId = result.publicId;
        }
        input.value = '';
        this.cdr.markForCheck();
      });
  }

  // ── Clear ─────────────────────────────────────────────────────────────────

  protected clear(): void {
    this.emit('');
    this.onTouched();
  }

  // ── Optimised thumbnail ───────────────────────────────────────────────────

  protected optimizedUrl(raw: string, width = 120): string {
    if (!raw || !raw.includes('res.cloudinary.com')) return raw;
    return raw.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`);
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private emit(value: string): void {
    this.url.set(value);
    this.onChange(value);
  }

  protected onUrlInput(value: string): void {
    this.emit(value);
  }

  protected onBlur(): void {
    this.onTouched();
  }
}
