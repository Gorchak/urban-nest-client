import {
  Component,
  OnInit,
  OnChanges,
  SimpleChanges,
  Input,
  Output,
  EventEmitter,
  inject,
  signal,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { InputNumberModule } from 'primeng/inputnumber';
import { DropdownModule } from 'primeng/dropdown';
import { MultiSelectModule } from 'primeng/multiselect';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button';
import { ColorPickerModule } from 'primeng/colorpicker';
import { ToastModule } from 'primeng/toast';
import { DividerModule } from 'primeng/divider';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import {
  ReferenceDefinition,
  ReferenceType,
  CreateReferenceDto,
} from '../../../core/models/reference.model';
import { ReferencesService } from '../../../core/services/references.service';
import { ReferenceOptionFormData, ReferenceTypeOption } from './reference-form.types';
import {
  REFERENCE_TYPE_OPTIONS,
  DEFAULT_COLOR_OPTIONS,
  DEFAULT_SIZE_OPTIONS,
} from './reference-form.constants';
import {
  generateSlug,
  isOptionsType,
  isNumericType,
  isStringType,
  parseTextareaOptions,
  kebabCaseValidator,
  regexPatternValidator,
} from './reference-form.utils';

@Component({
  selector: 'app-add-edit-reference',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MessageService],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DialogModule,
    InputTextModule,
    InputTextareaModule,
    InputNumberModule,
    DropdownModule,
    MultiSelectModule,
    CheckboxModule,
    ButtonModule,
    ColorPickerModule,
    ToastModule,
    DividerModule,
    TagModule,
  ],
  templateUrl: './add-edit-reference.component.html',
  styleUrls: ['./add-edit-reference.component.scss'],
})
export class AddEditReferenceComponent implements OnInit, OnChanges {
  private fb = inject(FormBuilder);
  private referencesService = inject(ReferencesService);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  @Input() visible = false;
  @Input() mode: 'new' | 'edit' = 'new';
  @Input() reference: ReferenceDefinition | null = null;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<void>();

  protected saving = signal(false);
  protected showBulkImport = signal(false);
  protected selectedType = signal<ReferenceType>('string');
  protected bulkImportText = '';
  protected slugManuallyEdited = false;

  protected readonly typeOptions: ReferenceTypeOption[] = REFERENCE_TYPE_OPTIONS;
  protected readonly isOptionsType = isOptionsType;
  protected readonly isNumericType = isNumericType;
  protected readonly isStringType = isStringType;

  form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    slug: ['', [Validators.required, kebabCaseValidator()]],
    description: [''],
    type: ['string' as ReferenceType, Validators.required],
    isRequired: [false],
    isFilterable: [true],
    isVariant: [false],
    isStockTrackable: [false],
    isActive: [true],
    placeholder: [''],
    helperText: [''],
    unit: [''],
    min: [null as number | null],
    max: [null as number | null],
    minLength: [null as number | null],
    maxLength: [null as number | null],
    regex: ['', [regexPatternValidator()]],
    defaultValue: [''],
    sortOrder: [0],
    options: this.fb.array([]),
  });

  get optionsArray(): FormArray {
    return this.form.get('options') as FormArray;
  }

  get headerTitle(): string {
    return this.mode === 'edit' ? 'Редагувати характеристику' : 'Нова характеристика';
  }

  ngOnInit(): void {
    this.form
      .get('type')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((type: ReferenceType) => {
        this.selectedType.set(type);
        this.cdr.markForCheck();
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Reinitialise when:
    //   1. visible becomes true (normal open)
    //   2. reference changes while the dialog is already open
    //      (covers the case where close() mutates this.visible before Angular's
    //       binding cycle, so Angular may not see a visible change on re-open)
    const visibleBecameTrue = changes['visible']?.currentValue === true;
    const refChangedWhileOpen = changes['reference'] && this.visible;

    if (visibleBecameTrue || refChangedWhileOpen) {
      this.initForm();
    }
  }

  private initForm(): void {
    this.slugManuallyEdited = false;
    this.showBulkImport.set(false);
    this.bulkImportText = '';

    // Use patchValue + markAs* instead of reset() to avoid accidental
    // FormArray re-initialisation that reset() can cause.
    this.form.patchValue({
      name: '',
      slug: '',
      description: '',
      type: 'string' as ReferenceType,
      isRequired: false,
      isFilterable: true,
      isVariant: false,
      isStockTrackable: false,
      isActive: true,
      placeholder: '',
      helperText: '',
      unit: '',
      min: null,
      max: null,
      minLength: null,
      maxLength: null,
      regex: '',
      defaultValue: '',
      sortOrder: 0,
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();

    // Always clear options here — patchFormFromReference must NOT clear again.
    this.clearOptions();
    this.selectedType.set('string');

    if (this.mode === 'edit' && this.reference) {
      this.patchFormFromReference();
    }
    this.cdr.markForCheck();
  }

  private patchFormFromReference(): void {
    const ref = this.reference!;
    this.form.patchValue({
      name: ref.name,
      slug: ref.slug,
      description: ref.description ?? '',
      type: ref.type,
      isRequired: ref.isRequired,
      isFilterable: ref.isFilterable,
      isVariant: ref.isVariant,
      isStockTrackable: ref.isStockTrackable ?? false,
      isActive: ref.isActive,
      placeholder: ref.placeholder ?? '',
      helperText: ref.helperText ?? '',
      unit: ref.unit ?? '',
      min: ref.min,
      max: ref.max,
      minLength: ref.minLength,
      maxLength: ref.maxLength,
      regex: ref.regex ?? '',
      defaultValue: ref.defaultValue !== null ? String(ref.defaultValue) : '',
      sortOrder: ref.sortOrder,
    });
    this.selectedType.set(ref.type);

    // Options are already cleared in initForm() — just push the new ones.
    (ref.options ?? []).forEach((opt) => {
      this.optionsArray.push(
        this.createOptionGroup({
          id: opt.id,
          label: opt.label,
          value: opt.value,
          colorHex: opt.colorHex,
          sortOrder: opt.sortOrder,
          isActive: opt.isActive,
        })
      );
    });
    this.slugManuallyEdited = true;
  }

  private clearOptions(): void {
    while (this.optionsArray.length) {
      this.optionsArray.removeAt(0);
    }
  }

  private createOptionGroup(data?: Partial<ReferenceOptionFormData>): FormGroup {
    return this.fb.group({
      id: [data?.id ?? null],
      label: [data?.label ?? '', Validators.required],
      value: [data?.value ?? '', Validators.required],
      colorHex: [data?.colorHex ?? null],
      sortOrder: [data?.sortOrder ?? this.optionsArray.length],
      isActive: [data?.isActive ?? true],
    });
  }

  protected onNameChange(value: string): void {
    if (!this.slugManuallyEdited) {
      this.form.get('slug')?.setValue(generateSlug(value), { emitEvent: false });
    }
  }

  protected onSlugInput(): void {
    this.slugManuallyEdited = true;
  }

  protected addOption(): void {
    this.optionsArray.push(this.createOptionGroup());
    this.cdr.markForCheck();
  }

  protected removeOption(index: number): void {
    this.optionsArray.removeAt(index);
    this.cdr.markForCheck();
  }

  protected loadColorDefaults(): void {
    this.clearOptions();
    DEFAULT_COLOR_OPTIONS.forEach((opt) => {
      this.optionsArray.push(this.createOptionGroup(opt));
    });
    this.cdr.markForCheck();
  }

  protected loadSizeDefaults(): void {
    this.clearOptions();
    DEFAULT_SIZE_OPTIONS.forEach((opt) => {
      this.optionsArray.push(this.createOptionGroup(opt));
    });
    this.cdr.markForCheck();
  }

  protected onBulkImportInput(event: Event): void {
    this.bulkImportText = (event.target as HTMLTextAreaElement).value;
  }

  protected importBulkOptions(): void {
    if (!this.bulkImportText.trim()) return;
    const parsed = parseTextareaOptions(this.bulkImportText);
    parsed.forEach((opt) => {
      this.optionsArray.push(this.createOptionGroup(opt));
    });
    this.bulkImportText = '';
    this.showBulkImport.set(false);
    this.cdr.markForCheck();
  }

  protected getOptionGroup(index: number): FormGroup {
    return this.optionsArray.at(index) as FormGroup;
  }

  protected async onSave(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.cdr.markForCheck();
      return;
    }

    if (this.bulkImportText.trim()) {
      const parsed = parseTextareaOptions(this.bulkImportText);
      parsed.forEach((opt) => {
        this.optionsArray.push(this.createOptionGroup(opt));
      });
      this.bulkImportText = '';
      this.showBulkImport.set(false);
      this.cdr.markForCheck();
    }

    const formValue = this.form.value as {
      name: string;
      slug: string;
      description: string;
      type: ReferenceType;
      isRequired: boolean;
      isFilterable: boolean;
      isVariant: boolean;
      isStockTrackable: boolean;
      isActive: boolean;
      placeholder: string;
      helperText: string;
      unit: string;
      min: number | null;
      max: number | null;
      minLength: number | null;
      maxLength: number | null;
      regex: string;
      defaultValue: string;
      sortOrder: number;
      options: ReferenceOptionFormData[];
    };

    const dto: CreateReferenceDto = {
      name: formValue.name,
      slug: formValue.slug,
      description: formValue.description || null,
      type: formValue.type,
      isRequired: formValue.isRequired,
      isFilterable: formValue.isFilterable,
      isVariant: formValue.isVariant,
      isStockTrackable: formValue.isStockTrackable,
      isActive: formValue.isActive,
      placeholder: formValue.placeholder || null,
      helperText: formValue.helperText || null,
      icon: null,
      unit: formValue.unit || null,
      min: formValue.min,
      max: formValue.max,
      minLength: formValue.minLength,
      maxLength: formValue.maxLength,
      regex: formValue.regex || null,
      defaultValue: formValue.defaultValue || null,
      sortOrder: formValue.sortOrder ?? 0,
      options: formValue.options.map((opt) => ({
        ...(opt.id ? { id: opt.id } : {}),
        label: opt.label,
        value: opt.value,
        colorHex: opt.colorHex || null,
        sortOrder: opt.sortOrder,
        isActive: opt.isActive,
      })),
    };

    this.saving.set(true);
    try {
      if (this.mode === 'edit' && this.reference) {
        await this.referencesService.updateReference(this.reference._id, dto);
        this.messageService.add({
          severity: 'success',
          summary: 'Збережено',
          detail: 'Характеристику оновлено',
        });
      } else {
        await this.referencesService.createReference(dto);
        this.messageService.add({
          severity: 'success',
          summary: 'Створено',
          detail: 'Характеристику створено',
        });
      }
      this.saved.emit();
      this.close();
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Помилка',
        detail: 'Не вдалося зберегти характеристику',
      });
    } finally {
      this.saving.set(false);
      this.cdr.markForCheck();
    }
  }

  protected close(): void {
    // Only emit — do NOT mutate this.visible directly.
    // Direct mutation before Angular's binding cycle would mask the
    // visible=false→true transition when a different item is opened,
    // preventing ngOnChanges from calling initForm().
    this.visibleChange.emit(false);
  }
}
