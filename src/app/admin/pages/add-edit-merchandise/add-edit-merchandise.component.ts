import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
  ReactiveFormsModule,
  AbstractControl,
} from '@angular/forms';
import { TabViewModule } from 'primeng/tabview';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { InputNumberModule } from 'primeng/inputnumber';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { MultiSelectModule } from 'primeng/multiselect';
import { CalendarModule } from 'primeng/calendar';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { ToastModule } from 'primeng/toast';
import { CardModule } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { SkeletonModule } from 'primeng/skeleton';

import { Category, CategorySpecification } from '../../../core/models/category.model';
import { Merchandise, MerchandiseSpecification, CreateMerchandiseDto, MerchandiseOwnershipType, MerchandiseInventory } from '../../../core/models/merchandise.model';
import { CategoriesService } from '../../../core/services/categories.service';
import { MerchandiseService } from '../../../core/services/merchandise.service';
import { ImageUploadComponent } from '../../../shared/components/image-upload/image-upload.component';
import { InventoryEditorComponent, InventorySpecificationSource } from './inventory-editor.component';

const TAB = { BASIC: 0, SPECS: 1, INVENTORY: 2, SEO: 3 } as const;
type TabIndex = typeof TAB[keyof typeof TAB];

interface SpecFormEntry {
  ctrl: FormGroup;
  catSpec: CategorySpecification;
}

@Component({
  selector: 'app-add-edit-merchandise',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MessageService],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TabViewModule,
    DialogModule,
    InputTextModule,
    InputTextareaModule,
    InputNumberModule,
    CheckboxModule,
    ButtonModule,
    DropdownModule,
    MultiSelectModule,
    CalendarModule,
    TagModule,
    ImageUploadComponent,
    InventoryEditorComponent,
    DividerModule,
    ToastModule,
    CardModule,
    SkeletonModule,
  ],
  templateUrl: './add-edit-merchandise.component.html',
  styleUrls: ['./add-edit-merchandise.component.scss'],
})
export class AddEditMerchandiseComponent implements OnChanges {
  private fb = inject(FormBuilder);
  private categoriesService = inject(CategoriesService);
  private merchandiseService = inject(MerchandiseService);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);

  @Input() visible = false;
  @Input() mode: 'new' | 'edit' = 'new';
  @Input() merchandise: Merchandise | null = null;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<void>();

  protected readonly TAB = TAB;

  protected saving = signal(false);
  protected loadingCategories = signal(false);
  protected loadingSpecs = signal(false);
  protected activeTabIndex = signal<TabIndex>(TAB.BASIC);
  protected formSubmitted = signal(false);

  protected categories = signal<Category[]>([]);
  protected selectedCategory = signal<Category | null>(null);
  protected selectedCategoryFull = signal<Category | null>(null);
  protected specFormEntries = signal<SpecFormEntry[]>([]);
  protected specsVersion = signal(0);
  protected inventory = signal<MerchandiseInventory>({
    total_quantity: 0,
    tracked_attribute: null,
    attribute_quantities: [],
  });

  // Image state — source of truth for the images[] payload sent to the API
  protected imageUrls = signal<string[]>([]);

  // Unsaved changes tracking
  protected hasUnsavedChanges = computed(() => this.form.dirty);

  protected inventorySpecificationSources = computed<InventorySpecificationSource[]>(() => {
    this.specsVersion();
    return this.specFormEntries().map((entry) => ({
      referenceId: entry.catSpec.referenceId,
      slug: entry.catSpec.slug,
      name: entry.catSpec.name || entry.catSpec.slug,
      type: entry.catSpec.type ?? 'string',
      value: entry.ctrl.get('value')?.value ?? null,
      options: entry.catSpec.options ?? [],
      isActive: entry.catSpec.isActive,
      isStockTrackable: entry.catSpec.isStockTrackable,
    }));
  });

  protected currencyOptions = [
    { label: 'UAH — Гривня', value: 'UAH' },
    { label: 'USD — Долар', value: 'USD' },
    { label: 'EUR — Євро', value: 'EUR' },
  ];

  protected ownershipTypeOptions: Array<{ label: string; value: MerchandiseOwnershipType; description: string }> = [
    { label: 'Власний товар',    value: 'owned',        description: 'Магазин викупив товар' },
    { label: 'Під реалізацію',   value: 'consignment',  description: 'Товар взятий під реалізацію' },
    { label: 'Дропшипінг',       value: 'dropshipping', description: 'Відправка від постачальника' },
    { label: 'Партнерський',     value: 'partner',      description: 'Товар партнера' },
    { label: 'Оренда',           value: 'rental',       description: 'Товар здається в оренду' },
  ];

  form: FormGroup = this.fb.group({
    // ── Tab 1: Basic info ─────────────────────────────────────────
    sku: ['', [Validators.required, Validators.maxLength(100)]],
    name: ['', [Validators.required, Validators.maxLength(255)]],
    slug: ['', [Validators.required, Validators.maxLength(255)]],
    categoryId: [null, [Validators.required]],
    shortDescription: ['', [Validators.maxLength(1000)]],
    description: ['', [Validators.maxLength(10000)]],
    purchasePrice: [0, [Validators.required, Validators.min(0)]],
    salePrice: [0, [Validators.required, Validators.min(0)]],
    retailPrice: [0, [Validators.required, Validators.min(0)]],
    currency: ['UAH'],
    isActive: [true],
    isVisible: [true],
    ownershipType: ['owned', [Validators.required]],
    // ── Tab 2: Specifications (dynamic FormArray) ─────────────────
    specifications: this.fb.array([]),
    // ── Tab 3: SEO ───────────────────────────────────────────────
    seoTitle: ['', [Validators.maxLength(255)]],
    seoDescription: ['', [Validators.maxLength(500)]],
    seoKeywords: [''],
    canonicalUrl: ['', [Validators.maxLength(2048)]],
    ogImage: ['', [Validators.maxLength(2048)]],
  });

  get specificationsArray(): FormArray {
    return this.form.get('specifications') as FormArray;
  }

  get headerTitle(): string {
    return this.mode === 'edit' ? 'Редагувати товар' : 'Новий товар';
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnChanges(changes: SimpleChanges): void {
    const visibleBecameTrue = changes['visible']?.currentValue === true;
    const merchandiseChangedWhileOpen = changes['merchandise'] && this.visible;

    if (visibleBecameTrue || merchandiseChangedWhileOpen) {
      this.initForm();
      if (this.categories().length === 0) {
        this.loadCategories();
      }
    }
  }

  // ── Data loading ───────────────────────────────────────────────────────────

  private async loadCategories(): Promise<void> {
    this.loadingCategories.set(true);
    try {
      const cats = await this.categoriesService.getCategories(1, 200);
      this.categories.set(cats.filter((c) => c.isActive));

      // On edit mode, re-trigger specs build now that categories are loaded
      if (this.mode === 'edit' && this.merchandise) {
        const cat = cats.find((c) => c._id === this.merchandise!.categoryId);
        if (cat) {
          this.selectedCategory.set(cat);
          this.loadFullCategory(cat._id, this.merchandise.specifications);
        }
      }
    } catch {
      this.categories.set([]);
    } finally {
      this.loadingCategories.set(false);
      this.cdr.markForCheck();
    }
  }

  // ── Form initialisation ────────────────────────────────────────────────────

  private initForm(): void {
    this.formSubmitted.set(false);
    this.activeTabIndex.set(TAB.BASIC);
    this.selectedCategory.set(null);
    this.selectedCategoryFull.set(null);
    this.specFormEntries.set([]);
    this.imageUrls.set([]);

    this.clearSpecificationsArray();

    this.form.patchValue({
      sku: '',
      name: '',
      slug: '',
      categoryId: null,
      shortDescription: '',
      description: '',
      purchasePrice: 0,
      salePrice: 0,
      retailPrice: 0,
      currency: 'UAH',
      isActive: true,
      isVisible: true,
      ownershipType: 'owned',
      seoTitle: '',
      seoDescription: '',
      seoKeywords: '',
      canonicalUrl: '',
      ogImage: '',
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.inventory.set({
      total_quantity: 0,
      tracked_attribute: null,
      attribute_quantities: [],
    });

    if (this.mode === 'edit' && this.merchandise) {
      this.patchFormFromMerchandise();
    }

    this.cdr.markForCheck();
  }

  private patchFormFromMerchandise(): void {
    const m = this.merchandise!;
    this.imageUrls.set([...m.images]);

    this.form.patchValue({
      sku: m.sku,
      name: m.name,
      slug: m.slug,
      categoryId: m.categoryId,
      shortDescription: m.shortDescription ?? '',
      description: m.description ?? '',
      purchasePrice: m.purchasePrice,
      salePrice: m.salePrice,
      retailPrice: m.retailPrice,
      currency: m.currency,
      isActive: m.isActive,
      isVisible: m.isVisible,
      ownershipType: m.ownershipType ?? 'owned',
      seoTitle: m.seoTitle ?? '',
      seoDescription: m.seoDescription ?? '',
      seoKeywords: m.seoKeywords?.join(', ') ?? '',
      canonicalUrl: m.canonicalUrl ?? '',
      ogImage: m.ogImage ?? '',
    });
    this.inventory.set(m.inventory ?? {
      total_quantity: 0,
      tracked_attribute: null,
      attribute_quantities: [],
    });

    // Specs will be built after categories load, handled in loadCategories()
    const cat = this.categories().find((c) => c._id === m.categoryId);
    if (cat) {
      this.selectedCategory.set(cat);
      this.loadFullCategory(cat._id, m.specifications);
    }
  }

  // ── Category selection ─────────────────────────────────────────────────────

  protected onCategoryChange(categoryId: string): void {
    const cat = this.categories().find((c) => c._id === categoryId) ?? null;
    this.selectedCategory.set(cat);
    this.selectedCategoryFull.set(null);
    this.clearSpecificationsArray();
    this.specFormEntries.set([]);
    if (cat) {
      this.loadFullCategory(cat._id, []);
    }
    this.cdr.markForCheck();
  }

  private async loadFullCategory(
    categoryId: string,
    existingValues: MerchandiseSpecification[]
  ): Promise<void> {
    this.loadingSpecs.set(true);
    this.cdr.markForCheck();
    try {
      const fullCat = await this.categoriesService.getCategoryById(categoryId);
      this.selectedCategoryFull.set(fullCat);
      this.buildSpecificationsForm(fullCat, existingValues);
    } catch {
      // fallback to the lightweight category from the list
      const fallback = this.selectedCategory();
      if (fallback) {
        this.selectedCategoryFull.set(fallback);
        this.buildSpecificationsForm(fallback, existingValues);
      }
    } finally {
      this.loadingSpecs.set(false);
      this.cdr.markForCheck();
    }
  }

  // ── Dynamic specifications form ────────────────────────────────────────────

  /**
   * Builds the specifications FormArray from the active specs of the selected category.
   * Fills in existing values when in edit mode.
   *
   * @param category       - the selected category document
   * @param existingValues - merchandise.specifications (for pre-filling on edit)
   */
  private buildSpecificationsForm(
    category: Category,
    existingValues: MerchandiseSpecification[]
  ): void {
    this.clearSpecificationsArray();
    this.specFormEntries.set([]);

    const activeSpecs = (category.specifications ?? []).filter(
      (s): s is CategorySpecification => s.isActive !== false
    );

    const valueMap = new Map<string, MerchandiseSpecification>();
    for (const sv of existingValues) {
      valueMap.set(sv.referenceId, sv);
    }

    const entries: SpecFormEntry[] = [];

    for (const catSpec of activeSpecs) {
      const existing = valueMap.get(catSpec.referenceId);
      const initialValue = existing ? existing.value : null;
      const validators = catSpec.isRequired ? [Validators.required] : [];

      const group = this.fb.group({
        referenceId: [catSpec.referenceId],
        slug: [catSpec.slug],
        type: [catSpec.type ?? 'string'],
        value: [initialValue, validators],
      });

      this.specificationsArray.push(group);
      entries.push({ ctrl: group, catSpec });
    }

    this.specFormEntries.set(entries);
    this.bumpSpecsVersion();
    this.cdr.markForCheck();
  }

  private clearSpecificationsArray(): void {
    while (this.specificationsArray.length > 0) {
      this.specificationsArray.removeAt(0);
    }
  }

  // ── Name → slug auto-generation ───────────────────────────────────────────

  protected onNameChange(value: string): void {
    const slugControl = this.form.get('slug');
    if (this.mode === 'new' && slugControl && !slugControl.touched) {
      const slug = value
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      slugControl.setValue(slug, { emitEvent: false });
    }
  }

  // ── Image management ───────────────────────────────────────────────────────

  protected onImagesChange(urls: string[]): void {
    this.imageUrls.set(urls);
    this.form.markAsDirty();
  }

  // ── Tab validation ─────────────────────────────────────────────────────────

  protected isTab1Invalid(): boolean {
    return ['sku', 'name', 'slug', 'categoryId', 'shortDescription', 'description',
      'purchasePrice', 'salePrice', 'retailPrice', 'ownershipType'].some(
      (f) => this.form.get(f)?.invalid
    );
  }

  protected isTab2Invalid(): boolean {
    return this.specificationsArray.invalid;
  }

  protected isTabInventoryInvalid(): boolean {
    return this.isInventoryInvalid();
  }

  protected isTab3Invalid(): boolean {
    return ['seoTitle', 'seoDescription', 'canonicalUrl', 'ogImage'].some(
      (f) => this.form.get(f)?.invalid
    );
  }

  // ── Spec control accessor ──────────────────────────────────────────────────

  protected getSpecControl(entry: SpecFormEntry): AbstractControl {
    return entry.ctrl.get('value')!;
  }

  protected getSelectOptions(
    catSpec: CategorySpecification
  ): Array<{ label: string; value: string }> {
    return (catSpec.options ?? [])
      .filter((o) => o.isActive !== false)
      .map((o) => ({ label: o.label, value: o.value }));
  }

  protected onSpecificationValueChanged(): void {
    this.bumpSpecsVersion();
  }

  private bumpSpecsVersion(): void {
    this.specsVersion.update((value) => value + 1);
  }

  protected onInventoryChange(value: MerchandiseInventory): void {
    this.inventory.set(value);
    this.form.markAsDirty();
  }

  protected isInventoryInvalid(): boolean {
    const inv = this.inventory();
    if (!inv.tracked_attribute) {
      return inv.total_quantity < 0 || !Number.isInteger(inv.total_quantity);
    }
    return (
      !inv.tracked_attribute.attribute_key ||
      inv.attribute_quantities.some(
        (row) => row.quantity < 0 || !Number.isInteger(row.quantity)
      )
    );
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  protected async onSave(): Promise<void> {
    this.formSubmitted.set(true);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      if (this.isTab1Invalid()) {
        this.activeTabIndex.set(TAB.BASIC);
      } else if (this.isTab2Invalid()) {
        this.activeTabIndex.set(TAB.SPECS);
      } else if (this.isTabInventoryInvalid()) {
        this.activeTabIndex.set(TAB.INVENTORY);
      } else if (this.isTab3Invalid()) {
        this.activeTabIndex.set(TAB.SEO);
      }
      this.cdr.markForCheck();
      return;
    }

    if (this.isInventoryInvalid()) {
      this.activeTabIndex.set(TAB.INVENTORY);
      this.cdr.markForCheck();
      return;
    }

    const v = this.form.value;

    const specifications: MerchandiseSpecification[] = this.specificationsArray.controls.map(
      (ctrl) => ({
        referenceId: ctrl.get('referenceId')!.value as string,
        slug: ctrl.get('slug')!.value as string,
        type: ctrl.get('type')!.value as any,
        value: ctrl.get('value')!.value,
      })
    );

    const payload: CreateMerchandiseDto = {
      sku: v.sku,
      name: v.name,
      slug: v.slug,
      categoryId: v.categoryId,
      description: v.description || null,
      shortDescription: v.shortDescription || null,
      specifications,
      images: this.imageUrls(),
      inventory: this.inventory(),
      purchasePrice: v.purchasePrice ?? 0,
      salePrice: v.salePrice ?? 0,
      retailPrice: v.retailPrice ?? 0,
      currency: v.currency || 'UAH',
      isActive: v.isActive,
      isVisible: v.isVisible,
      ownershipType: v.ownershipType || 'owned',
      seoTitle: v.seoTitle || null,
      seoDescription: v.seoDescription || null,
      seoKeywords: v.seoKeywords
        ? v.seoKeywords.split(',').map((k: string) => k.trim()).filter((k: string) => k)
        : [],
      canonicalUrl: v.canonicalUrl || null,
      ogImage: v.ogImage || null,
    };

    this.saving.set(true);
    try {
      if (this.mode === 'edit' && this.merchandise) {
        await this.merchandiseService.updateMerchandise(this.merchandise._id, payload);
        this.messageService.add({ severity: 'success', summary: 'Збережено', detail: 'Товар оновлено' });
      } else {
        await this.merchandiseService.createMerchandise(payload);
        this.messageService.add({ severity: 'success', summary: 'Створено', detail: 'Товар додано' });
      }
      this.saved.emit();
      this.close();
    } catch (err: any) {
      const detail = err?.error?.message || err?.message || 'Не вдалося зберегти товар';
      this.messageService.add({ severity: 'error', summary: 'Помилка', detail });
    } finally {
      this.saving.set(false);
      this.cdr.markForCheck();
    }
  }

  protected close(): void {
    this.visibleChange.emit(false);
  }
}
