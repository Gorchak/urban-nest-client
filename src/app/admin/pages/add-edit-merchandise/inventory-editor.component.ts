import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  computed,
  effect,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CheckboxModule } from 'primeng/checkbox';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { SkeletonModule } from 'primeng/skeleton';

import { CategorySpecification } from '../../../core/models/category.model';
import {
  MerchandiseInventory,
  InventoryAttributeQuantity,
} from '../../../core/models/merchandise.model';

export interface InventorySpecificationSource {
  referenceId: string;
  slug: string;
  name: string;
  type: string;
  value: unknown;
  options: CategorySpecification['options'];
  isActive?: boolean;
  isStockTrackable?: boolean;
}

const emptyInventory = (): MerchandiseInventory => ({
  total_quantity: 0,
  tracked_attribute: null,
  attribute_quantities: [],
});

@Component({
  selector: 'app-inventory-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    CheckboxModule,
    DropdownModule,
    InputNumberModule,
    SkeletonModule,
  ],
  templateUrl: './inventory-editor.component.html',
  styleUrls: ['./inventory-editor.component.scss'],
})
export class InventoryEditorComponent implements OnChanges {
  @Input() categorySpecifications: CategorySpecification[] = [];
  @Input() specificationSources: InventorySpecificationSource[] = [];
  @Input() inventory: MerchandiseInventory | null = null;
  @Input() loading = false;
  @Input() submitted = false;

  @Output() inventoryChange = new EventEmitter<MerchandiseInventory>();

  protected trackByAttribute = signal(false);
  protected selectedAttributeKey = signal<string | null>(null);
  protected standaloneQuantity = signal(0);
  protected quantitiesByValue = signal<Record<string, number>>({});
  private sourcesVersion = signal(0);

  protected attributeOptions = computed(() => {
    this.sourcesVersion();
    const sources = this.buildAttributeSources();
    const currentKey = this.selectedAttributeKey();

    const options = sources
      .filter(
        (spec) =>
          spec.isActive !== false &&
          (this.isTrackable(spec.isStockTrackable) || spec.slug === currentKey),
      )
      .map((spec) => ({
        label: spec.name || spec.slug,
        value: spec.slug,
        spec,
      }));

    const tracked = this.inventory?.tracked_attribute;
    if (
      tracked &&
      !options.some((option) => option.value === tracked.attribute_key)
    ) {
      options.push({
        label: tracked.attribute_label || tracked.attribute_key,
        value: tracked.attribute_key,
        spec: {
          referenceId: tracked.attribute_key,
          slug: tracked.attribute_key,
          name: tracked.attribute_label || tracked.attribute_key,
          type: 'select',
          value: (this.inventory?.attribute_quantities ?? []).map((row) => row.value_key),
          options: (this.inventory?.attribute_quantities ?? []).map((row) => ({
            id: row.value_key,
            label: row.value_label,
            value: row.value_key,
            colorHex: null,
            sortOrder: 0,
            isActive: true,
          })),
          isActive: true,
          isStockTrackable: true,
        },
      });
    }

    return options;
  });

  protected selectedAttribute = computed(() => {
    const key = this.selectedAttributeKey();
    return (
      this.attributeOptions().find((option) => option.value === key)?.spec ??
      null
    );
  });

  protected valueRows = computed<InventoryAttributeQuantity[]>(() => {
    const spec = this.selectedAttribute();
    const quantities = this.quantitiesByValue();

    if (!spec) return this.inventory?.attribute_quantities ?? [];

    return this.getRowsForSpec(spec, quantities);
  });

  protected totalQuantity = computed(() => {
    if (!this.trackByAttribute())
      return this.cleanQuantity(this.standaloneQuantity());
    return this.valueRows().reduce((sum, row) => sum + row.quantity, 0);
  });

  protected currentInventory = computed<MerchandiseInventory>(() => {
    if (!this.trackByAttribute()) {
      return {
        total_quantity: this.totalQuantity(),
        tracked_attribute: null,
        attribute_quantities: [],
      };
    }

    const spec = this.selectedAttribute();
    return {
      total_quantity: this.totalQuantity(),
      tracked_attribute: spec
        ? {
            attribute_key: spec.slug,
            attribute_label: spec.name || spec.slug,
          }
        : {
            attribute_key: '',
            attribute_label: '',
          },
      attribute_quantities: spec ? this.valueRows() : [],
    };
  });

  protected attributeInvalid = computed(
    () =>
      this.submitted && this.trackByAttribute() && !this.selectedAttribute(),
  );

  private emitTimer: ReturnType<typeof setTimeout> | null = null;
  private hydrating = false;
  private lastEmittedSnapshot = '';
  private ready = false;
  private skipNextEmit = false;

  constructor() {
    effect(() => {
      const selected = this.selectedAttributeKey();
      const available = this.attributeOptions();

      if (selected && !available.some((option) => option.value === selected)) {
        this.selectedAttributeKey.set(null);
      }
    });

    effect(() => {
      const value = this.currentInventory();
      if (this.hydrating || !this.ready) return;
      if (this.skipNextEmit) {
        this.skipNextEmit = false;
        return;
      }

      if (this.emitTimer) clearTimeout(this.emitTimer);
      this.emitTimer = setTimeout(() => {
        this.lastEmittedSnapshot = this.snapshot(value);
        this.inventoryChange.emit(value);
      }, 250);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['inventory']) {
      const incoming = this.inventory ?? emptyInventory();
      const incomingSnapshot = this.snapshot(incoming);

      if (
        incomingSnapshot !== this.lastEmittedSnapshot &&
        incomingSnapshot !== this.snapshot(this.currentInventory())
      ) {
        this.hydrate(incoming);
      }
    }

    if (changes['categorySpecifications'] || changes['specificationSources']) {
      this.sourcesVersion.update((value) => value + 1);
    }

    if (
      (changes['categorySpecifications'] || changes['specificationSources']) &&
      this.trackByAttribute()
    ) {
      const selected = this.selectedAttributeKey();
      const firstAvailable = this.attributeOptions()[0]?.value ?? null;

      if (
        selected &&
        !this.attributeOptions().some((option) => option.value === selected)
      ) {
        this.selectedAttributeKey.set(firstAvailable);
        this.syncQuantitiesForSelectedAttribute();
      }
    }
  }

  protected onTrackToggle(value: boolean): void {
    this.trackByAttribute.set(value);
    if (value) {
      const firstAttribute = this.attributeOptions()[0]?.value ?? null;
      this.selectedAttributeKey.set(
        this.selectedAttributeKey() ?? firstAttribute,
      );
      this.syncQuantitiesForSelectedAttribute();
    } else {
      this.selectedAttributeKey.set(null);
      this.quantitiesByValue.set({});
      this.standaloneQuantity.set(this.totalQuantity());
    }
  }

  protected onAttributeChange(value: string | null): void {
    this.selectedAttributeKey.set(value || null);
    this.syncQuantitiesForSelectedAttribute();
  }

  protected onStandaloneQuantityChange(value: number | null): void {
    this.standaloneQuantity.set(this.cleanQuantity(value));
  }

  protected onQuantityChange(valueKey: string, value: number | null): void {
    this.quantitiesByValue.update((current) => ({
      ...current,
      [valueKey]: this.cleanQuantity(value),
    }));
  }

  protected isQuantityInvalid(row: InventoryAttributeQuantity): boolean {
    return row.quantity < 0 || !Number.isInteger(row.quantity);
  }

  private hydrate(inventory: MerchandiseInventory): void {
    this.hydrating = true;
    this.ready = true;
    this.skipNextEmit = true;

    const normalized = {
      total_quantity: this.cleanQuantity(inventory.total_quantity),
      tracked_attribute: inventory.tracked_attribute ?? null,
      attribute_quantities: Array.isArray(inventory.attribute_quantities)
        ? inventory.attribute_quantities
        : [],
    };

    this.trackByAttribute.set(!!normalized.tracked_attribute);
    this.selectedAttributeKey.set(
      normalized.tracked_attribute?.attribute_key ?? null,
    );
    this.standaloneQuantity.set(normalized.total_quantity);
    this.quantitiesByValue.set(
      normalized.attribute_quantities.reduce<Record<string, number>>(
        (acc, row) => {
          acc[row.value_key] = this.cleanQuantity(row.quantity);
          return acc;
        },
        {},
      ),
    );

    this.hydrating = false;
  }

  private syncQuantitiesForSelectedAttribute(): void {
    const rows = this.valueRows();
    this.quantitiesByValue.set(
      rows.reduce<Record<string, number>>((acc, row) => {
        acc[row.value_key] = row.quantity;
        return acc;
      }, {}),
    );
  }

  private cleanQuantity(value: number | null | undefined): number {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.floor(numeric));
  }

  private buildAttributeSources(): InventorySpecificationSource[] {
    const categorySources = (this.categorySpecifications ?? []).map((spec) => ({
      referenceId: spec.referenceId,
      slug: spec.slug,
      name: spec.name || spec.slug,
      type: spec.type ?? 'string',
      value: null,
      options: spec.options ?? [],
      isActive: spec.isActive,
      isStockTrackable: spec.isStockTrackable,
    }));

    const sourceBySlug = new Map<string, InventorySpecificationSource>();
    for (const source of categorySources) {
      sourceBySlug.set(source.slug, source);
    }

    for (const source of this.specificationSources ?? []) {
      const categorySource = sourceBySlug.get(source.slug);
      sourceBySlug.set(source.slug, {
        ...categorySource,
        ...source,
        options: source.options?.length ? source.options : categorySource?.options ?? [],
        isStockTrackable:
          source.isStockTrackable ?? categorySource?.isStockTrackable ?? false,
      });
    }

    return [...sourceBySlug.values()];
  }

  private isTrackable(value: unknown): boolean {
    return value === true || value === 'true' || value === 1 || value === '1';
  }

  private getRowsForSpec(
    spec: InventorySpecificationSource,
    quantities: Record<string, number>,
  ): InventoryAttributeQuantity[] {
    const optionMap = new Map(
      (spec.options ?? [])
        .filter((option) => option.isActive !== false)
        .map((option) => [option.value, option.label]),
    );
    const selectedValues = this.extractSelectedValues(spec.value);
    const values = selectedValues.length ? selectedValues : [...optionMap.keys()];

    return values.map((value) => ({
      value_key: value,
      value_label: optionMap.get(value) ?? value,
      quantity: this.cleanQuantity(quantities[value]),
    }));
  }

  private extractSelectedValues(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value
        .filter((item) => item !== null && item !== undefined && item !== '')
        .map((item) => String(item));
    }

    if (value === null || value === undefined || value === '') {
      return [];
    }

    return [String(value)];
  }

  private snapshot(value: MerchandiseInventory): string {
    return JSON.stringify({
      total_quantity: this.cleanQuantity(value.total_quantity),
      tracked_attribute: value.tracked_attribute ?? null,
      attribute_quantities: (value.attribute_quantities ?? []).map((row) => ({
        value_key: row.value_key,
        value_label: row.value_label,
        quantity: this.cleanQuantity(row.quantity),
      })),
    });
  }
}
