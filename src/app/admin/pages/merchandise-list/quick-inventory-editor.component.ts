import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';

import { CategoriesService } from '../../../core/services/categories.service';
import { MerchandiseService } from '../../../core/services/merchandise.service';
import { Category } from '../../../core/models/category.model';
import {
  Merchandise,
  MerchandiseInventory,
} from '../../../core/models/merchandise.model';
import {
  InventoryEditorComponent,
  InventorySpecificationSource,
} from '../add-edit-merchandise/inventory-editor.component';

@Component({
  selector: 'app-quick-inventory-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    DialogModule,
    ButtonModule,
    SkeletonModule,
    InventoryEditorComponent,
  ],
  templateUrl: './quick-inventory-editor.component.html',
  styleUrls: ['./quick-inventory-editor.component.scss'],
})
export class QuickInventoryEditorComponent implements OnChanges {
  private categoriesService = inject(CategoriesService);
  private merchandiseService = inject(MerchandiseService);
  private cdr = inject(ChangeDetectorRef);

  @Input() visible = false;
  @Input() merchandise: Merchandise | null = null;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<Merchandise>();

  protected loading = signal(false);
  protected saving = signal(false);
  protected category = signal<Category | null>(null);
  protected inventory = signal<MerchandiseInventory>({
    total_quantity: 0,
    tracked_attribute: null,
    attribute_quantities: [],
  });

  protected specificationSources = computed<InventorySpecificationSource[]>(() => {
    const category = this.category();
    const merchandise = this.merchandise;
    if (!category || !merchandise) return [];

    const valueMap = new Map(
      (merchandise.specifications ?? []).map((spec) => [spec.referenceId, spec.value]),
    );

    return (category.specifications ?? []).map((spec) => ({
      referenceId: spec.referenceId,
      slug: spec.slug,
      name: spec.name || spec.slug,
      type: spec.type ?? 'string',
      value: valueMap.get(spec.referenceId) ?? null,
      options: spec.options ?? [],
      isActive: spec.isActive,
      isStockTrackable: spec.isStockTrackable,
    }));
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true && this.merchandise) {
      this.inventory.set(this.merchandise.inventory);
      this.loadCategory();
    }
  }

  protected onInventoryChange(value: MerchandiseInventory): void {
    this.inventory.set(value);
  }

  protected async save(): Promise<void> {
    if (!this.merchandise) return;

    this.saving.set(true);
    try {
      const updated = await this.merchandiseService.updateMerchandise(
        this.merchandise._id,
        { inventory: this.inventory() },
      );
      this.saved.emit(updated);
      this.close();
    } finally {
      this.saving.set(false);
      this.cdr.markForCheck();
    }
  }

  protected close(): void {
    this.visibleChange.emit(false);
  }

  private async loadCategory(): Promise<void> {
    if (!this.merchandise) return;

    this.loading.set(true);
    try {
      const category = await this.categoriesService.getCategoryById(this.merchandise.categoryId);
      this.category.set(category);
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }
}
