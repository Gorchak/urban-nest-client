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
} from '@angular/forms';


import { TabViewModule } from 'primeng/tabview';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { InputNumberModule } from 'primeng/inputnumber';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { ToastModule } from 'primeng/toast';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageService } from 'primeng/api';

import { Category, CategorySpecification } from '../../../core/models/category.model';
import { ReferenceDefinition } from '../../../core/models/reference.model';
import { CategoriesService } from '../../../core/services/categories.service';
import { ReferencesService } from '../../../core/services/references.service';
import { UploadService } from '../../../core/services/upload.service';
import { REFERENCE_TYPE_LABELS } from '../add-edit-reference/reference-form.constants';
import { SingleImagePickerComponent } from '../../../shared/components/single-image-picker/single-image-picker.component';
import { ImageUploadComponent } from '../../../shared/components/image-upload/image-upload.component';

const TAB = { BASIC: 0, SPECS: 1, SEO: 2 } as const;

/** Represents a pending file upload for a single-image field */
interface PendingFileField {
  field: 'image' | 'icon' | 'coverImage' | 'bannerImage';
  file: File;
}

@Component({
  selector: 'app-add-edit-category',
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
    AutoCompleteModule,
    TagModule,
    DividerModule,
    ToastModule,
    IconFieldModule,
    InputIconModule,
    TooltipModule,
    ProgressSpinnerModule,
    SingleImagePickerComponent,
    ImageUploadComponent,
  ],
  templateUrl: './add-edit-category.component.html',
  styleUrls: ['./add-edit-category.component.scss'],
})
export class AddEditCategoryComponent implements OnChanges {
  private fb = inject(FormBuilder);
  private categoriesService = inject(CategoriesService);
  private referencesService = inject(ReferencesService);
  private uploadService = inject(UploadService);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);

  @Input() visible = false;
  @Input() mode: 'new' | 'edit' = 'new';
  @Input() category: Category | null = null;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<void>();

  protected readonly TAB = TAB;
  protected readonly typeLabels = REFERENCE_TYPE_LABELS;

  protected saving = signal(false);
  protected loadingRefs = signal(false);
  protected activeTabIndex = signal(0);
  protected formSubmitted = signal(false);
  protected allReferences = signal<ReferenceDefinition[]>([]);
  protected searchQuery = signal('');

  /** Upload progress message shown while files are being sent to Cloudinary */
  protected uploadStatus = signal('');

  // Signal that mirrors enabledSpecIds — updated in refreshSpecMaps() to trigger computed re-evaluation
  private _selectedSpecIds = signal<Set<string>>(new Set());

  /** RIGHT column: references not yet added, filtered by search */
  protected availableReferences = computed(() => {
    const ids = this._selectedSpecIds();
    const refs = this.allReferences();
    const q = this.searchQuery().toLowerCase().trim();
    return refs.filter(
      (r) =>
        !ids.has(r._id) &&
        (!q || r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q))
    );
  });

  /** LEFT column: specs rendered from their stored snapshot; isOrphan=true when
   *  the source reference no longer exists in /api/references */
  protected selectedSpecsWithRef = computed(
    (): Array<{ ctrl: FormGroup; ref: CategorySpecification; id: string; isOrphan: boolean }> => {
      this._selectedSpecIds(); // reactive trigger
      const allRefIds = new Set(this.allReferences().map((r) => r._id));
      return this.specificationsArray.controls
        .map((ctrl) => {
          const id = ctrl.get('referenceId')?.value as string;
          const ref = ctrl.get('_ref')?.value as CategorySpecification | null;
          if (!ref || !id) return null;
          const isOrphan = !allRefIds.has(id);
          return { ctrl: ctrl as FormGroup, ref, id, isOrphan };
        })
        .filter(
          (item): item is { ctrl: FormGroup; ref: CategorySpecification; id: string; isOrphan: boolean } =>
            item !== null,
        );
    },
  );

  private enabledSpecIds = new Set<string>();
  private enabledSpecMap = new Map<string, FormGroup>();

  protected parentCategories: Category[] = [];
  protected filteredParentCategories: Category[] = [];

  form: FormGroup = this.fb.group({
    // ── Tab 1: Basic ─────────────────────────────────────────────
    name: ['', [Validators.required, Validators.maxLength(255)]],
    slug: ['', [Validators.required, Validators.maxLength(255)]],
    description: ['', [Validators.maxLength(5000)]],
    shortDescription: ['', [Validators.maxLength(500)]],
    parentId: [null],
    sortOrder: [0],
    isActive: [true],
    isVisible: [true],
    isFeatured: [false],
    // Single-image fields (stored as URL strings)
    image: ['', [Validators.maxLength(2048)]],
    icon: ['', [Validators.maxLength(2048)]],
    coverImage: ['', [Validators.maxLength(2048)]],
    bannerImage: ['', [Validators.maxLength(2048)]],
    // Multi-image gallery (array of URL strings)
    images: [[] as string[]],
    // ── Tab 2: Specifications ─────────────────────────────────────
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
    return this.mode === 'edit' ? 'Редагувати категорію' : 'Нова категорія';
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnChanges(changes: SimpleChanges): void {
    const visibleBecameTrue = changes['visible']?.currentValue === true;
    const categoryChangedWhileOpen = changes['category'] && this.visible;

    if (visibleBecameTrue || categoryChangedWhileOpen) {
      this.initForm();
      if (this.allReferences().length === 0) {
        this.loadReferences();
      } else {
        this.buildSpecificationsArray();
      }
    }
  }

  // ── Data loading ───────────────────────────────────────────────────────────

  private async loadReferences(): Promise<void> {
    this.loadingRefs.set(true);
    try {
      const refs = await this.referencesService.getReferences();
      this.allReferences.set(refs.filter((r) => r.isActive));
      this.buildSpecificationsArray();
    } catch {
      this.allReferences.set([]);
    } finally {
      this.loadingRefs.set(false);
      this.cdr.markForCheck();
    }
  }

  private async loadParentCategories(): Promise<void> {
    try {
      this.parentCategories = await this.categoriesService.getCategories();
      this.filteredParentCategories = [...this.parentCategories];
    } catch {
      this.parentCategories = [];
    }
    this.cdr.markForCheck();
  }

  // ── Form initialisation ────────────────────────────────────────────────────

  private initForm(): void {
    this.formSubmitted.set(false);
    this.activeTabIndex.set(0);
    this.searchQuery.set('');
    this.uploadStatus.set('');

    this.form.patchValue({
      name: '',
      slug: '',
      description: '',
      shortDescription: '',
      parentId: null,
      sortOrder: 0,
      isActive: true,
      isVisible: true,
      isFeatured: false,
      image: '',
      icon: '',
      coverImage: '',
      bannerImage: '',
      images: [],
      seoTitle: '',
      seoDescription: '',
      seoKeywords: '',
      canonicalUrl: '',
      ogImage: '',
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();

    if (this.mode === 'edit' && this.category) {
      this.patchFormFromCategory();
    }

    this.loadParentCategories();
    this.cdr.markForCheck();
  }

  private patchFormFromCategory(): void {
    const cat = this.category!;
    this.form.patchValue({
      name: cat.name,
      slug: cat.slug,
      description: cat.description ?? '',
      shortDescription: cat.shortDescription ?? '',
      sortOrder: cat.sortOrder,
      isActive: cat.isActive,
      isVisible: cat.isVisible,
      isFeatured: cat.isFeatured,
      image: cat.image ?? '',
      icon: cat.icon ?? '',
      coverImage: cat.coverImage ?? '',
      bannerImage: cat.bannerImage ?? '',
      images: cat.images ?? [],
      seoTitle: cat.seoTitle ?? '',
      seoDescription: cat.seoDescription ?? '',
      seoKeywords: cat.seoKeywords?.join(', ') ?? '',
      canonicalUrl: cat.canonicalUrl ?? '',
      ogImage: cat.ogImage ?? '',
    });
  }

  // ── Specifications FormArray ─────────────────────────────────────────────

  private buildSpecificationsArray(): void {
    while (this.specificationsArray.length) {
      this.specificationsArray.removeAt(0);
    }

    const existingSpecs: CategorySpecification[] =
      this.mode === 'edit' && this.category
        ? (this.category.specifications ?? [])
        : [];

    existingSpecs.forEach((spec) => {
      const freshRef = this.allReferences().find((r) => r._id === spec.referenceId);
      const specData: CategorySpecification = freshRef
        ? {
            ...freshRef,
            referenceId: spec.referenceId,
            isRequired: spec.isRequired,
            sortOrder: spec.sortOrder,
          }
        : spec;
      this.specificationsArray.push(this.createSpecGroup(specData));
    });

    this.refreshSpecMaps();
    this.cdr.markForCheck();
  }

  private createSpecGroup(spec: CategorySpecification): FormGroup {
    return this.fb.group({
      referenceId: [spec.referenceId],
      slug: [spec.slug],
      isRequired: [spec.isRequired ?? false],
      sortOrder: [spec.sortOrder ?? 0],
      _ref: [spec],
    });
  }

  private refreshSpecMaps(): void {
    this.enabledSpecIds.clear();
    this.enabledSpecMap.clear();
    this.specificationsArray.controls.forEach((ctrl) => {
      const id = ctrl.get('referenceId')?.value as string;
      if (id) {
        this.enabledSpecIds.add(id);
        this.enabledSpecMap.set(id, ctrl as FormGroup);
      }
    });
    this._selectedSpecIds.set(new Set(this.enabledSpecIds));
  }

  // ── Specification add / remove ────────────────────────────────────────────

  protected isSpecificationSelected(referenceId: string): boolean {
    return this.enabledSpecIds.has(referenceId);
  }

  protected addSpecification(ref: ReferenceDefinition): void {
    if (this.enabledSpecIds.has(ref._id)) return;
    const spec: CategorySpecification = {
      referenceId: ref._id,
      name: ref.name,
      slug: ref.slug,
      type: ref.type,
      description: ref.description,
      isRequired: ref.isRequired,
      sortOrder: ref.sortOrder ?? 0,
      isFilterable: ref.isFilterable,
      isVariant: ref.isVariant,
      isActive: ref.isActive,
      placeholder: ref.placeholder,
      helperText: ref.helperText,
      icon: ref.icon,
      unit: ref.unit,
      min: ref.min,
      max: ref.max,
      minLength: ref.minLength,
      maxLength: ref.maxLength,
      regex: ref.regex,
      defaultValue: ref.defaultValue,
      options: ref.options,
      createdAt: ref.createdAt,
      updatedAt: ref.updatedAt,
    };
    this.specificationsArray.push(this.createSpecGroup(spec));
    this.refreshSpecMaps();
    this.cdr.markForCheck();
  }

  protected removeSpecification(referenceId: string): void {
    const idx = this.specificationsArray.controls.findIndex(
      (c) => c.get('referenceId')?.value === referenceId
    );
    if (idx >= 0) {
      this.specificationsArray.removeAt(idx);
      this.refreshSpecMaps();
      this.cdr.markForCheck();
    }
  }

  // ── Name → slug ───────────────────────────────────────────────────────────

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

  // ── Parent category autocomplete ──────────────────────────────────────────

  protected filterParentCategories(event: { query: string }): void {
    const query = event.query.toLowerCase();
    this.filteredParentCategories = this.parentCategories.filter((c) =>
      c.name.toLowerCase().includes(query)
    );
  }

  // ── Tab validation ─────────────────────────────────────────────────────────

  protected isTab1Invalid(): boolean {
    return ['name', 'slug', 'description', 'shortDescription', 'image', 'icon', 'coverImage', 'bannerImage']
      .some((f) => this.form.get(f)?.invalid);
  }

  protected isTab3Invalid(): boolean {
    return ['seoTitle', 'seoDescription', 'canonicalUrl', 'ogImage']
      .some((f) => this.form.get(f)?.invalid);
  }

  protected get invalidTabCount(): number {
    return (this.isTab1Invalid() ? 1 : 0) + (this.isTab3Invalid() ? 1 : 0);
  }

  // ── Save (with pre-upload step) ───────────────────────────────────────────

  protected async onSave(): Promise<void> {
    this.formSubmitted.set(true);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      if (this.isTab1Invalid()) {
        this.activeTabIndex.set(TAB.BASIC);
      } else if (this.isTab3Invalid()) {
        this.activeTabIndex.set(TAB.SEO);
      }
      this.cdr.markForCheck();
      return;
    }

    this.saving.set(true);
    this.uploadStatus.set('');
    this.cdr.markForCheck();

    try {
      const v = this.form.value;

      // ── Step 1: Resolve single-image fields ─────────────────────────────
      // All four single-image fields are already URL strings (SingleImagePickerComponent
      // uploads to Cloudinary immediately when the user picks a file inside the dialog).
      // Nothing extra is needed here — values are ready.

      // ── Step 2: Resolve gallery images ──────────────────────────────────
      // ImageUploadComponent also uploads files immediately on selection.
      // The form value for `images` is already an array of URL strings.
      const galleryUrls: string[] = Array.isArray(v.images) ? v.images : [];

      // Count total pending remote uploads (already uploaded by sub-components, so 0 here)
      this.uploadStatus.set('');

      // ── Step 3: Build payload ────────────────────────────────────────────
      const specifications: CategorySpecification[] = this.specificationsArray.controls.map((ctrl) => {
        const ref = ctrl.get('_ref')?.value as CategorySpecification;
        return {
          ...ref,
          referenceId: ctrl.get('referenceId')?.value as string,
          isRequired: ctrl.get('isRequired')?.value as boolean,
          sortOrder: ctrl.get('sortOrder')?.value as number,
        };
      });

      const payload = {
        name: v.name,
        slug: v.slug,
        description: v.description || null,
        shortDescription: v.shortDescription || null,
        parentId: v.parentId?._id ?? null,
        sortOrder: v.sortOrder ?? 0,
        isActive: v.isActive,
        isVisible: v.isVisible,
        isFeatured: v.isFeatured,
        image: v.image || null,
        icon: v.icon || null,
        coverImage: v.coverImage || null,
        bannerImage: v.bannerImage || null,
        images: galleryUrls,
        specifications,
        seoTitle: v.seoTitle || null,
        seoDescription: v.seoDescription || null,
        seoKeywords: v.seoKeywords
          ? v.seoKeywords.split(',').map((k: string) => k.trim()).filter((k: string) => k)
          : [],
        canonicalUrl: v.canonicalUrl || null,
        ogImage: v.ogImage || null,
      };

      // ── Step 4: Persist ──────────────────────────────────────────────────
      if (this.mode === 'edit' && this.category) {
        await this.categoriesService.updateCategory(this.category._id, payload);
        this.messageService.add({ severity: 'success', summary: 'Збережено', detail: 'Категорію оновлено' });
      } else {
        await this.categoriesService.createCategory(payload);
        this.messageService.add({ severity: 'success', summary: 'Створено', detail: 'Категорію успішно збережено' });
      }

      this.saved.emit();
      this.close();
    } catch (err: any) {
      const detail = err?.error?.message || err?.message || 'Не вдалося зберегти категорію';
      this.messageService.add({ severity: 'error', summary: 'Помилка', detail });
    } finally {
      this.saving.set(false);
      this.uploadStatus.set('');
      this.cdr.markForCheck();
    }
  }

  protected close(): void {
    this.visibleChange.emit(false);
  }
}
