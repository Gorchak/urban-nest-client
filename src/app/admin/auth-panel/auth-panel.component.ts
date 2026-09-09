import { Component, inject, signal } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';

@Component({
  selector: 'app-auth-panel',
  standalone: true,
  imports: [],
  templateUrl: './auth-panel.component.html',
  styleUrl: './auth-panel.component.scss'
})
export class AuthPanelComponent {
  private auth = inject(AuthService);

  private isAuthenticated$ = this.auth.isAuthenticated$.pipe(catchError(() => of(false)));
  private user$ = this.auth.user$;
  private isLoading$ = this.auth.isLoading$.pipe(catchError(() => of(false)));

  protected isAuthenticated = toSignal(this.isAuthenticated$, { initialValue: false });
  protected user = toSignal(this.user$, { initialValue: null });
  protected isLoading = toSignal(this.isLoading$, { initialValue: false });

  protected isProcessing = signal(false);

  protected login(): void {
    if (this.isProcessing()) return;
    this.isProcessing.set(true);
    this.auth.loginWithRedirect();
  }

  protected register(): void {
    if (this.isProcessing()) return;
    this.isProcessing.set(true);
    this.auth.loginWithRedirect({
      authorizationParams: {
        screen_hint: 'signup'
      }
    });
  }

  protected logout(): void {
    if (this.isProcessing()) return;
    this.isProcessing.set(true);
    this.auth.logout({
      logoutParams: {
        returnTo: window.location.origin
      }
    });
  }
}
