import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { CheckboxModule } from 'primeng/checkbox';
import { DropdownModule } from 'primeng/dropdown';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { PasswordModule } from 'primeng/password';
import { MessageService } from 'primeng/api';

import {
  Auth0User,
  UpdateAuth0UserDto,
  UserAppMetadata,
  UserDeliveryProfile,
  UserProfileMetadata,
} from '../../../core/models/user.model';
import {
  NovaPoshtaArea,
  NovaPoshtaCity,
  NovaPoshtaService,
  NovaPoshtaWarehouse,
} from '../../../core/services/nova-poshta.service';
import { UsersService } from '../../../core/services/users.service';
import { SingleImagePickerComponent } from '../../../shared/components/single-image-picker/single-image-picker.component';

interface CustomFieldDraft {
  key: string;
  value: string;
}

interface EditableUserProfile {
  email: string;
  firstName: string;
  lastName: string;
  middleName: string;
  phone: string;
  residentialAddress: string;
  avatarUrl: string;
  delivery: Required<UserDeliveryProfile>;
  appMetadata: UserAppMetadata;
  customFields: CustomFieldDraft[];
  password: string;
}

const emptyDelivery = (): Required<UserDeliveryProfile> => ({
  service: '',
  areaRef: '',
  region: '',
  cityRef: '',
  city: '',
  warehouseRef: '',
  warehouse: '',
});

const emptyProfile = (): EditableUserProfile => ({
  email: '',
  firstName: '',
  lastName: '',
  middleName: '',
  phone: '',
  residentialAddress: '',
  avatarUrl: '',
  delivery: emptyDelivery(),
  appMetadata: {},
  customFields: [],
  password: '',
});

@Component({
  selector: 'app-user-profile-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    InputTextareaModule,
    CheckboxModule,
    DropdownModule,
    AutoCompleteModule,
    PasswordModule,
    SingleImagePickerComponent,
  ],
  templateUrl: './user-profile-dialog.component.html',
  styleUrls: ['./user-profile-dialog.component.scss'],
})
export class UserProfileDialogComponent implements OnChanges {
  private usersService = inject(UsersService);
  private novaPoshtaService = inject(NovaPoshtaService);
  private messageService = inject(MessageService);
  private cdr = inject(ChangeDetectorRef);

  @Input() visible = false;
  @Input() user: Auth0User | null = null;
  @Input() showAdminFields = true;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<Auth0User>();

  protected saving = signal(false);
  protected resettingPassword = signal(false);
  protected novaPoshtaLoading = signal(false);
  protected editable = signal<EditableUserProfile>(emptyProfile());
  protected novaPoshtaAreas = signal<NovaPoshtaArea[]>([]);
  protected novaPoshtaCities = signal<NovaPoshtaCity[]>([]);
  protected novaPoshtaWarehouses = signal<NovaPoshtaWarehouse[]>([]);
  protected selectedNovaPoshtaCity = signal<NovaPoshtaCity | null>(null);
  protected selectedNovaPoshtaWarehouse = signal<NovaPoshtaWarehouse | null>(null);

  protected deliveryServiceOptions = [
    { label: 'Нова пошта', value: 'nova_poshta' },
    { label: 'Інша служба', value: 'custom' },
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['visible']?.currentValue || changes['user']) && this.visible && this.user) {
      this.editable.set(this.toEditable(this.user));
      this.selectedNovaPoshtaCity.set(null);
      this.selectedNovaPoshtaWarehouse.set(null);
      void this.prepareNovaPoshtaData();
    }
  }

  protected close(): void {
    this.visibleChange.emit(false);
  }

  protected patch(patch: Partial<EditableUserProfile>): void {
    this.editable.update((current) => ({ ...current, ...patch }));
  }

  protected patchDelivery(patch: Partial<UserDeliveryProfile>): void {
    this.editable.update((current) => ({
      ...current,
      delivery: { ...current.delivery, ...patch },
    }));
  }

  protected setRole(key: 'isAdmin' | 'isModerator', value: boolean): void {
    this.editable.update((current) => ({
      ...current,
      appMetadata: { ...current.appMetadata, [key]: value },
    }));
  }

  protected addCustomField(): void {
    this.editable.update((current) => ({
      ...current,
      customFields: [...current.customFields, { key: '', value: '' }],
    }));
  }

  protected updateCustomField(index: number, patch: Partial<CustomFieldDraft>): void {
    this.editable.update((current) => ({
      ...current,
      customFields: current.customFields.map((field, i) => (i === index ? { ...field, ...patch } : field)),
    }));
  }

  protected removeCustomField(index: number): void {
    this.editable.update((current) => ({
      ...current,
      customFields: current.customFields.filter((_, i) => i !== index),
    }));
  }

  protected async onDeliveryServiceChange(value: string): Promise<void> {
    this.patchDelivery({
      service: value,
      ...(value === 'nova_poshta'
        ? {}
        : { areaRef: '', cityRef: '', warehouseRef: '', region: '', city: '', warehouse: '' }),
    });

    if (value === 'nova_poshta') {
      await this.prepareNovaPoshtaData();
    } else {
      this.selectedNovaPoshtaCity.set(null);
      this.selectedNovaPoshtaWarehouse.set(null);
      this.novaPoshtaCities.set([]);
      this.novaPoshtaWarehouses.set([]);
    }
  }

  protected async onNovaPoshtaAreaChange(areaRef: string): Promise<void> {
    const area = this.novaPoshtaAreas().find((item) => item.Ref === areaRef);
    this.patchDelivery({
      areaRef,
      region: area?.Description || '',
      city: '',
      cityRef: '',
      warehouse: '',
      warehouseRef: '',
    });
    this.novaPoshtaCities.set([]);
    this.novaPoshtaWarehouses.set([]);
    this.selectedNovaPoshtaCity.set(null);
    this.selectedNovaPoshtaWarehouse.set(null);
    await this.loadNovaPoshtaCities(areaRef, '');
  }

  protected async searchNovaPoshtaCities(query = ''): Promise<void> {
    await this.loadNovaPoshtaCities(this.editable().delivery.areaRef, query);
  }

  protected async onNovaPoshtaCitySelect(city: NovaPoshtaCity): Promise<void> {
    this.selectedNovaPoshtaCity.set(city);
    this.patchDelivery({
      cityRef: city.Ref,
      city: city.Description || '',
      warehouse: '',
      warehouseRef: '',
    });
    this.novaPoshtaWarehouses.set([]);
    this.selectedNovaPoshtaWarehouse.set(null);
    await this.loadNovaPoshtaWarehouses(city.Ref, '');
  }

  protected async searchNovaPoshtaWarehouses(query = ''): Promise<void> {
    const cityRef = this.editable().delivery.cityRef;
    if (!cityRef) return;
    await this.loadNovaPoshtaWarehouses(cityRef, query);
  }

  protected onNovaPoshtaWarehouseSelect(warehouse: NovaPoshtaWarehouse): void {
    this.selectedNovaPoshtaWarehouse.set(warehouse);
    this.patchDelivery({
      warehouseRef: warehouse.Ref,
      warehouse: warehouse.Description || '',
    });
  }

  protected async save(): Promise<void> {
    if (!this.user) return;
    const current = this.editable();

    this.saving.set(true);
    try {
      const userMetadata: UserProfileMetadata = {
        ...(this.user.userMetadata || {}),
        firstName: current.firstName.trim(),
        lastName: current.lastName.trim(),
        middleName: current.middleName.trim(),
        phone: current.phone.trim(),
        residentialAddress: current.residentialAddress.trim(),
        avatarUrl: current.avatarUrl.trim(),
        delivery: current.delivery,
      };

      const payload: UpdateAuth0UserDto = {
        userMetadata,
      };
      if (this.showAdminFields) {
        payload.appMetadata = {
          isAdmin: Boolean(current.appMetadata.isAdmin),
          isModerator: Boolean(current.appMetadata.isModerator),
          ...this.customFieldsToMetadata(current.customFields),
        };
      }
      const email = current.email.trim();
      if (email && email.toLowerCase() !== this.user.email.toLowerCase()) payload.email = email;

      const saved = await this.usersService.updateUser(this.user.userId, payload);
      if (current.password.trim()) {
        await this.usersService.updatePassword(this.user.userId, current.password.trim());
      }

      this.messageService.add({ severity: 'success', summary: 'Збережено', detail: 'Профіль користувача оновлено' });
      this.saved.emit(saved);
      this.visibleChange.emit(false);
    } catch (err: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Помилка',
        detail: err?.error?.message || 'Не вдалося зберегти користувача',
      });
    } finally {
      this.saving.set(false);
      this.cdr.markForCheck();
    }
  }

  protected async sendPasswordReset(): Promise<void> {
    if (!this.user) return;

    this.resettingPassword.set(true);
    try {
      const result = await this.usersService.sendPasswordReset(this.user.userId);
      this.messageService.add({
        severity: 'success',
        summary: 'Надіслано',
        detail: `Лист для відновлення пароля надіслано на ${result.email}`,
      });
    } catch (err: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Помилка',
        detail: err?.error?.message || 'Не вдалося надіслати відновлення пароля',
      });
    } finally {
      this.resettingPassword.set(false);
      this.cdr.markForCheck();
    }
  }

  private toEditable(user: Auth0User): EditableUserProfile {
    const metadata = user.userMetadata || {};
    const delivery = { ...emptyDelivery(), ...(metadata.delivery || {}) };
    const knownAppFields = new Set(['isAdmin', 'isModerator']);

    return {
      email: user.email || '',
      firstName: String(metadata.firstName || ''),
      lastName: String(metadata.lastName || ''),
      middleName: String(metadata.middleName || ''),
      phone: String(metadata.phone || ''),
      residentialAddress: String(metadata.residentialAddress || ''),
      avatarUrl: String(metadata.avatarUrl || user.picture || ''),
      delivery,
      appMetadata: { ...(user.appMetadata || {}) },
      customFields: Object.entries(user.appMetadata || {})
        .filter(([key]) => !knownAppFields.has(key))
        .map(([key, value]) => ({ key, value: this.stringifyFieldValue(value) })),
      password: '',
    };
  }

  private customFieldsToMetadata(fields: CustomFieldDraft[]): UserAppMetadata {
    return fields.reduce<UserAppMetadata>((acc, field) => {
      const key = field.key.trim();
      if (!key || key === 'isAdmin' || key === 'isModerator') return acc;
      acc[key] = this.parseFieldValue(field.value);
      return acc;
    }, {});
  }

  private parseFieldValue(value: string): unknown {
    const trimmed = value.trim();
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed !== '' && !Number.isNaN(Number(trimmed))) return Number(trimmed);
    return trimmed;
  }

  private stringifyFieldValue(value: unknown): string {
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  }

  private async prepareNovaPoshtaData(): Promise<void> {
    const delivery = this.editable().delivery;
    if (delivery.service !== 'nova_poshta') return;

    await this.loadNovaPoshtaAreas();
    if (delivery.areaRef) {
      await this.loadNovaPoshtaCities(delivery.areaRef, delivery.city);
      this.selectedNovaPoshtaCity.set(
        this.novaPoshtaCities().find((city) => city.Ref === delivery.cityRef) ||
        (delivery.cityRef ? { Ref: delivery.cityRef, Description: delivery.city, Area: delivery.areaRef } : null)
      );
    }
    if (delivery.cityRef) {
      await this.loadNovaPoshtaWarehouses(delivery.cityRef, delivery.warehouse);
      this.selectedNovaPoshtaWarehouse.set(
        this.novaPoshtaWarehouses().find((warehouse) => warehouse.Ref === delivery.warehouseRef) ||
        (delivery.warehouseRef ? { Ref: delivery.warehouseRef, Description: delivery.warehouse, CityRef: delivery.cityRef } : null)
      );
    }
  }

  private async loadNovaPoshtaAreas(): Promise<void> {
    if (this.novaPoshtaAreas().length) return;

    this.novaPoshtaLoading.set(true);
    try {
      this.novaPoshtaAreas.set(await this.novaPoshtaService.getAreas());
    } catch (err: any) {
      this.showNovaPoshtaError(err);
    } finally {
      this.novaPoshtaLoading.set(false);
      this.cdr.markForCheck();
    }
  }

  private async loadNovaPoshtaCities(areaRef?: string, search = ''): Promise<void> {
    this.novaPoshtaLoading.set(true);
    try {
      this.novaPoshtaCities.set(await this.novaPoshtaService.getCities(areaRef, search, search ? 100 : 500));
    } catch (err: any) {
      this.showNovaPoshtaError(err);
    } finally {
      this.novaPoshtaLoading.set(false);
      this.cdr.markForCheck();
    }
  }

  private async loadNovaPoshtaWarehouses(cityRef: string, search = ''): Promise<void> {
    this.novaPoshtaLoading.set(true);
    try {
      this.novaPoshtaWarehouses.set(await this.novaPoshtaService.getWarehouses(cityRef, search, search ? 100 : 500));
    } catch (err: any) {
      this.showNovaPoshtaError(err);
    } finally {
      this.novaPoshtaLoading.set(false);
      this.cdr.markForCheck();
    }
  }

  private showNovaPoshtaError(err: any): void {
    this.messageService.add({
      severity: 'error',
      summary: 'Нова пошта',
      detail: err?.error?.message || 'Не вдалося отримати дані Нової пошти',
    });
  }
}
