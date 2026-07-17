import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { CheckboxModule } from 'primeng/checkbox';
import { DropdownModule } from 'primeng/dropdown';
import { MessageModule } from 'primeng/message';
import { CheckboxGoodDetails, CheckboxGoodEditDto, CheckboxService } from '../../../core/services/checkbox.service';
import { Merchandise } from '../../../core/models/merchandise.model';

interface RawField { path: string; value: string; }

@Component({
  selector: 'app-checkbox-product-details',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, DialogModule, ButtonModule, InputTextModule, InputNumberModule, CheckboxModule, DropdownModule, MessageModule],
  templateUrl: './checkbox-product-details.component.html',
  styleUrls: ['./checkbox-product-details.component.scss'],
})
export class CheckboxProductDetailsComponent implements OnChanges {
  private checkboxService = inject(CheckboxService);

  @Input() visible = false;
  @Input() productId: string | null = null;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<Merchandise>();

  protected details = signal<CheckboxGoodDetails | null>(null);
  protected rawFields = signal<RawField[]>([]);
  protected loading = signal(false);
  protected saving = signal(false);
  protected error = signal<string | null>(null);
  protected editMode = signal(false);
  protected draft = signal<CheckboxGoodEditDto>({});
  protected readonly typeOptions = [
    { label: 'Товар', value: 'good' },
    { label: 'Послуга', value: 'service' },
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['visible'] || changes['productId']) && this.visible && this.productId) {
      void this.load();
    }
  }

  protected close(): void {
    this.editMode.set(false);
    this.visibleChange.emit(false);
  }

  protected patchDraft(patch: Partial<CheckboxGoodEditDto>): void {
    this.draft.update((current) => ({ ...current, ...patch }));
  }

  protected startEdit(): void {
    this.editMode.set(true);
  }

  protected cancelEdit(): void {
    this.editMode.set(false);
    this.setDraft(this.details());
  }

  protected async save(): Promise<void> {
    if (!this.productId) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      const draft = { ...this.draft() };
      if (!draft.group) delete draft.group;
      const updated = await this.checkboxService.updateGood(this.productId, draft);
      const nextDetails = {
        ...updated,
        leftovers: updated.leftovers?.length ? updated.leftovers : (this.details()?.leftovers ?? []),
      };
      this.details.set(nextDetails);
      this.rawFields.set(this.flatten(updated.raw));
      this.setDraft(nextDetails);
      this.editMode.set(false);
      this.saved.emit(updated.product);
    } catch (err: any) {
      this.error.set(err?.error?.message || 'Не вдалося оновити товар у Checkbox');
    } finally {
      this.saving.set(false);
    }
  }

  protected formatLeftovers(): string {
    const rows = this.details()?.leftovers || [];
    if (!rows.length) return 'Дані про залишки відсутні';
    return rows.map((row) => Object.entries(row).map(([branch, value]) => `${branch}: ${value ?? 'не задано'}`).join(', ')).join('; ');
  }

  private async load(): Promise<void> {
    if (!this.productId) return;
    this.loading.set(true);
    this.error.set(null);
    this.details.set(null);
    try {
      const details = await this.checkboxService.getGood(this.productId);
      this.details.set(details);
      this.rawFields.set(this.flatten(details.raw));
      this.setDraft(details);
    } catch (err: any) {
      this.error.set(err?.error?.message || 'Не вдалося отримати товар із Checkbox');
    } finally {
      this.loading.set(false);
    }
  }

  private setDraft(details: CheckboxGoodDetails | null): void {
    const raw = details?.raw || {};
    this.draft.set({
      name: String(raw['name'] ?? ''),
      short_name: String(raw['short_name'] ?? ''),
      type: raw['type'] === 'service' ? 'service' : 'good',
      code: String(raw['code'] ?? ''),
      is_weight: Boolean(raw['is_weight']),
      barcode: String(raw['barcode'] ?? ''),
      uktzed: String(raw['uktzed'] ?? ''),
      price: details?.product.salePrice ?? 0,
      group: String(raw['group_id'] ?? ''),
      position: raw['position'] === null || raw['position'] === undefined ? undefined : Number(raw['position']),
    });
  }

  private flatten(value: unknown, prefix = ''): RawField[] {
    if (Array.isArray(value)) {
      if (!value.length) return [{ path: prefix, value: '[]' }];
      return value.flatMap((item, index) => this.flatten(item, `${prefix}[${index}]`));
    }
    if (value && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>);
      if (!entries.length) return [{ path: prefix, value: '{}' }];
      return entries.flatMap(([key, item]) => this.flatten(item, prefix ? `${prefix}.${key}` : key));
    }
    return [{ path: prefix || 'value', value: value === null ? 'null' : String(value) }];
  }
}
