import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TagModule } from 'primeng/tag';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ReferencesService } from '../../../core/services/references.service';
import { ReferenceDefinition } from '../../../core/models/reference.model';
import { REFERENCE_TYPE_LABELS } from '../add-edit-reference/reference-form.constants';
import { AddEditReferenceComponent } from '../add-edit-reference/add-edit-reference.component';

@Component({
  selector: 'app-category-references',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    ButtonModule,
    ToastModule,
    ConfirmDialogModule,
    TagModule,
    AddEditReferenceComponent,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './category-references.component.html',
  styleUrls: ['./category-references.component.scss'],
})
export class CategoryReferencesComponent implements OnInit {
  private referencesService = inject(ReferencesService);
  protected messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);

  protected readonly typeLabels = REFERENCE_TYPE_LABELS;

  protected references: ReferenceDefinition[] = [];
  protected loading = false;
  protected showDialog = false;
  protected dialogMode: 'new' | 'edit' = 'new';
  protected selectedReference: ReferenceDefinition | null = null;

  async ngOnInit(): Promise<void> {
    await this.loadReferences();
  }

  private async loadReferences(): Promise<void> {
    this.loading = true;
    try {
      this.references = await this.referencesService.getReferences();
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Помилка',
        detail: 'Не вдалося завантажити характеристики',
      });
    } finally {
      this.loading = false;
    }
  }

  protected openNew(): void {
    this.dialogMode = 'new';
    this.selectedReference = null;
    this.showDialog = true;
  }

  protected openEdit(reference: ReferenceDefinition): void {
    this.dialogMode = 'edit';
    this.selectedReference = reference;
    this.showDialog = true;
  }

  protected async onReferenceSaved(): Promise<void> {
    await this.loadReferences();
  }

  protected confirmDelete(reference: ReferenceDefinition): void {
    this.confirmationService.confirm({
      message: `Ви впевнені, що хочете видалити "${reference.name}"?`,
      header: 'Підтвердження',
      icon: 'pi pi-exclamation-triangle',
      accept: async () => {
        try {
          await this.referencesService.deleteReference(reference._id);
          this.messageService.add({
            severity: 'success',
            summary: 'Видалено',
            detail: 'Характеристику видалено',
          });
          await this.loadReferences();
        } catch {
          this.messageService.add({
            severity: 'error',
            summary: 'Помилка',
            detail: 'Не вдалося видалити характеристику',
          });
        }
      },
    });
  }
}
