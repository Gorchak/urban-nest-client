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
import { FileUploadModule } from 'primeng/fileupload';
import { ImageModule } from 'primeng/image';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { ToastModule } from 'primeng/toast';
import { CardModule } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { SkeletonModule } from 'primeng/skeleton';

import { Category, CategorySpecification } from '../../../core/models/category.model';
import { Merchandise, MerchandiseSpecification, CreateMerchandiseDto, MerchandiseOwnershipType } from '../../../core/models/merchandise.model';
import { CategoriesService } from '../../../core/services/categories.service';
import { MerchandiseService } from '../../../core/services/merchandise.service';

const TAB = { BASIC: 0, SPECS: 1, SEO: 2 } as const;
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
    FileUploadModule,
    ImageModule,
    TagModule,
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
  protected specFormEntries = signal<SpecFormEntry[]>([]);

  // Image preview state
  protected imageUrls = signal<string[]>([]);
  protected newImageUrl = signal('');

  // Unsaved changes tracking
  protected hasUnsavedChanges = computed(() => this.form.dirty);

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
    stockQuantity: [0, [Validators.required, Validators.min(0)]],
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
          this.buildSpecificationsForm(cat, this.merchandise.specifications);
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
    this.specFormEntries.set([]);
    this.imageUrls.set([]);
    this.newImageUrl.set('');

    this.clearSpecificationsArray();

    this.form.patchValue({
      sku: '',
      name: '',
      slug: '',
      categoryId: null,
      shortDescription: '',
      description: '',
      stockQuantity: 0,
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
      stockQuantity: m.stockQuantity,
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

    // Specs will be built after categories load, handled in loadCategories()
    const cat = this.categories().find((c) => c._id === m.categoryId);
    if (cat) {
      this.selectedCategory.set(cat);
      this.buildSpecificationsForm(cat, m.specifications);
    }
  }

  // ── Category selection ─────────────────────────────────────────────────────

  protected onCategoryChange(categoryId: string): void {
    const cat = this.categories().find((c) => c._id === categoryId) ?? null;
    this.selectedCategory.set(cat);
    this.clearSpecificationsArray();
    this.specFormEntries.set([]);
    if (cat) {
      this.buildSpecificationsForm(cat, []);
    }
    this.cdr.markForCheck();
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

  protected addImageUrl(): void {
    const url = this.newImageUrl().trim();
    if (!url) return;
    if (!this.imageUrls().includes(url)) {
      this.imageUrls.update((list) => [...list, url]);
      this.form.markAsDirty();
    }
    this.newImageUrl.set('');
    this.cdr.markForCheck();
  }

  protected removeImage(index: number): void {
    this.imageUrls.update((list) => list.filter((_, i) => i !== index));
    this.form.markAsDirty();
    this.cdr.markForCheck();
  }

  protected onFileUpload(event: any): void {
    const files: File[] = event.files ?? [];
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl && !this.imageUrls().includes(dataUrl)) {
          this.imageUrls.update((list) => [...list, dataUrl]);
          this.form.markAsDirty();
          this.cdr.markForCheck();
        }
      };
      reader.readAsDataURL(file);
    }
  }

  // ── Tab validation ─────────────────────────────────────────────────────────

  protected isTab1Invalid(): boolean {
    return ['sku', 'name', 'slug', 'categoryId', 'shortDescription', 'description',
      'stockQuantity', 'purchasePrice', 'salePrice', 'retailPrice', 'ownershipType'].some(
      (f) => this.form.get(f)?.invalid
    );
  }

  protected isTab2Invalid(): boolean {
    return this.specificationsArray.invalid;
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

  // ── Save ──────────────────────────────────────────────────────────────────

  protected async onSave(): Promise<void> {
    this.formSubmitted.set(true);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      if (this.isTab1Invalid()) {
        this.activeTabIndex.set(TAB.BASIC);
      } else if (this.isTab2Invalid()) {
        this.activeTabIndex.set(TAB.SPECS);
      } else if (this.isTab3Invalid()) {
        this.activeTabIndex.set(TAB.SEO);
      }
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
      stockQuantity: v.stockQuantity ?? 0,
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
