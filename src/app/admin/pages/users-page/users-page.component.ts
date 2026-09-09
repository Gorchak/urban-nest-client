import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  NgZone,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { AvatarModule } from 'primeng/avatar';
import { ToastModule } from 'primeng/toast';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../core/services/auth.service';
import { catchError, filter, firstValueFrom, of, take, timeout } from 'rxjs';

import { User } from '../../../core/models/user.model';
import { UsersService } from '../../../core/services/users.service';
import { UserProfileDialogComponent } from './user-profile-dialog.component';
import { AdminActionMenuComponent } from '../../components/admin-action-menu/admin-action-menu.component';

@Component({
  selector: 'app-users-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MessageService],
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    TagModule,
    AvatarModule,
    ToastModule,
    IconFieldModule,
    InputIconModule,
    UserProfileDialogComponent,
    AdminActionMenuComponent,
  ],
  templateUrl: './users-page.component.html',
  styleUrls: ['./users-page.component.scss'],
})
export class UsersPageComponent implements OnInit {
  private usersService = inject(UsersService);
  private messageService = inject(MessageService);
  private auth = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);

  protected users = signal<User[]>([]);
  protected pagination = signal({ total: 0, page: 1, limit: 20, pages: 0 });
  protected loading = signal(false);
  protected authRequired = signal(false);
  protected search = signal('');
  protected selectedUser = signal<User | null>(null);
  protected showProfileDialog = signal(false);

  async ngOnInit(): Promise<void> {
    await this.waitForAuth();
    if (this.authRequired()) return;
    await this.loadUsers();
  }

  protected async loadUsers(): Promise<void> {
    if (this.authRequired()) return;

    this.loading.set(true);
    try {
      const result = await this.usersService.getUsers({
        page: this.pagination().page,
        limit: this.pagination().limit,
        search: this.search() || undefined,
      });
      this.zone.run(() => {
        this.users.set([...result.data]);
        this.pagination.set({ ...result.pagination });
        this.cdr.detectChanges();
      });
    } catch (err: any) {
      if (err?.status === 401) {
        this.authRequired.set(true);
        return;
      }

      this.messageService.add({
        severity: 'error',
        summary: 'Користувачі',
        detail: err?.error?.message || 'Не вдалося отримати користувачів',
      });
    } finally {
      this.zone.run(() => {
        this.loading.set(false);
        this.cdr.detectChanges();
      });
    }
  }

  protected login(): void {
    this.auth.loginWithRedirect({
      appState: { target: '/admin/users' },
    });
  }

  protected async onPageChange(event: { first: number; rows: number }): Promise<void> {
    if (this.authRequired()) return;
    this.pagination.update((p) => ({ ...p, page: Math.floor(event.first / event.rows) + 1, limit: event.rows }));
    await this.loadUsers();
  }

  protected async onSearchChange(value: string): Promise<void> {
    if (this.authRequired()) return;
    this.search.set(value);
    this.pagination.update((p) => ({ ...p, page: 1 }));
    await this.loadUsers();
  }

  protected openProfile(user: User): void {
    this.selectedUser.set(user);
    this.showProfileDialog.set(true);
  }

  protected openCreateUser(): void {
    this.selectedUser.set(null);
    this.showProfileDialog.set(true);
  }

  protected async onUserSaved(user: User): Promise<void> {
    this.zone.run(() => {
      this.users.update((items) => {
        const exists = items.some((item) => item.userId === user.userId);
        return exists
          ? items.map((item) => (item.userId === user.userId ? { ...user } : item))
          : [{ ...user }, ...items];
      });
      this.selectedUser.set({ ...user });
      this.cdr.detectChanges();
    });
    await this.loadUsers();
  }

  protected displayName(user: User): string {
    const metadata = user.userMetadata || {};
    return [metadata.lastName, metadata.firstName, metadata.middleName].filter(Boolean).join(' ').trim()
      || user.name
      || user.nickname
      || user.email
      || user.phoneNumber
      || metadata.phone
      || user.userId;
  }

  protected providerLabel(user: User): string {
    return user.identities?.[0]?.provider || 'local';
  }

  private async waitForAuth(): Promise<void> {
    await firstValueFrom(this.auth.isLoading$.pipe(
      filter((isLoading) => !isLoading),
      take(1),
      timeout({ first: 5000, with: () => of(false) }),
      catchError(() => of(false)),
    ));

    const isAuthenticated = await firstValueFrom(this.auth.isAuthenticated$.pipe(
      take(1),
      timeout({ first: 5000, with: () => of(false) }),
      catchError(() => of(false)),
    ));

    this.authRequired.set(!isAuthenticated);
  }
}
