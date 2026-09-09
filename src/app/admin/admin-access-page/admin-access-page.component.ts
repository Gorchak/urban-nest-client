import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ButtonModule } from 'primeng/button';
import { AdminAccessService, AdminAccessState } from '../../core/services/admin-access.service';

@Component({
  selector: 'app-admin-access-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ButtonModule],
  templateUrl: './admin-access-page.component.html',
  styleUrls: ['./admin-access-page.component.scss'],
})
export class AdminAccessPageComponent implements OnInit {
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private adminAccess = inject(AdminAccessService);
  private cdr = inject(ChangeDetectorRef);

  protected loading = signal(true);
  protected access = signal<AdminAccessState | null>(null);

  ngOnInit(): void {
    this.adminAccess.check().subscribe({
      next: (state) => {
        this.access.set(state);
        this.loading.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.access.set({ isAuthenticated: false, isAdmin: false, user: null });
        this.loading.set(false);
        this.cdr.markForCheck();
      },
    });
  }

  protected login(): void {
    this.auth.loginWithRedirect({
      appState: { target: this.returnUrl },
    });
  }

  protected goToAdmin(): void {
    void this.router.navigateByUrl(this.returnUrl);
  }

  private get returnUrl(): string {
    return this.route.snapshot.queryParamMap.get('returnUrl') || '/admin/users';
  }
}
