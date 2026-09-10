import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, NgZone, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { PublicFooterComponent } from '../shared/public-footer.component';
import { environment } from '../../../environments/environment';

interface GoogleCredentialResponse { credential?: string; }
declare global { interface Window { google?: { accounts: { id: { initialize(config: { client_id: string; callback: (response: GoogleCredentialResponse) => void; ux_mode?: string }): void; renderButton(element: HTMLElement, options: Record<string, unknown>): void } } }; } }

type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

@Component({ selector: 'app-auth-page', standalone: true, imports: [CommonModule, ReactiveFormsModule, RouterLink, PublicFooterComponent], templateUrl: './auth-page.component.html', styleUrl: './auth-page.component.scss', changeDetection: ChangeDetectionStrategy.OnPush })
export class AuthPageComponent implements AfterViewInit {
  @ViewChild('googleButton') private googleButton?: ElementRef<HTMLElement>;
  private fb = inject(FormBuilder); private auth = inject(AuthService); private route = inject(ActivatedRoute); private router = inject(Router); private zone = inject(NgZone);
  protected mode = this.route.snapshot.data['mode'] as AuthMode;
  protected isPasswordSetup = this.route.snapshot.queryParamMap.get('setup') === '1';
  protected loading = signal(false); protected error = signal(''); protected success = signal(''); protected showPassword = signal(false);
  protected form = this.fb.nonNullable.group({
    firstName: ['', this.mode === 'register' ? [Validators.required] : []],
    lastName: ['', this.mode === 'register' ? [Validators.required] : []],
    email: ['', this.mode === 'reset' ? [] : [Validators.required, Validators.email]],
    phone: [''],
    password: ['', this.mode === 'forgot' ? [] : [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', this.mode === 'register' || this.mode === 'reset' ? [Validators.required] : []],
  });
  ngAfterViewInit(): void { if (this.mode === 'login' || this.mode === 'register') this.renderGoogleButton(); }
  private renderGoogleButton(attempt = 0): void {
    const target = this.googleButton?.nativeElement; const google = window.google;
    if (!target) return;
    if (!google) { if (attempt < 50) window.setTimeout(() => this.renderGoogleButton(attempt + 1), 100); else this.error.set('Не вдалося завантажити авторизацію Google'); return; }
    google.accounts.id.initialize({ client_id: environment.googleClientId, ux_mode: 'popup', callback: (response) => this.zone.run(() => void this.handleGoogleCredential(response)) });
    google.accounts.id.renderButton(target, { type: 'standard', theme: 'outline', size: 'large', text: this.mode === 'register' ? 'signup_with' : 'signin_with', shape: 'rectangular', logo_alignment: 'left', locale: 'uk', width: Math.min(460, Math.max(280, target.clientWidth)) });
  }
  private async handleGoogleCredential(response: GoogleCredentialResponse): Promise<void> {
    if (!response.credential || this.loading()) return;
    this.loading.set(true); this.error.set('');
    try { await this.auth.loginWithGoogle(response.credential); await this.router.navigateByUrl(this.route.snapshot.queryParamMap.get('returnUrl') || '/'); }
    catch (error: any) { this.error.set(error?.error?.message || 'Не вдалося увійти через Google'); }
    finally { this.loading.set(false); }
  }
  protected async submit(): Promise<void> {
    this.error.set(''); this.success.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Перевірте правильність заповнення полів');
      return;
    }
    const value = this.form.getRawValue();
    if ((this.mode === 'register' || this.mode === 'reset') && value.password !== value.confirmPassword) { this.error.set('Паролі не збігаються'); return; }
    this.loading.set(true);
    try {
      if (this.mode === 'login') { await this.auth.login(value.email, value.password); await this.router.navigateByUrl(this.route.snapshot.queryParamMap.get('returnUrl') || '/'); }
      else if (this.mode === 'register') {
        const result = await this.auth.register(value);
        if (result.requiresPasswordSetup) this.success.set(result.message);
        else await this.router.navigateByUrl('/');
      }
      else if (this.mode === 'forgot') { const response = await this.auth.forgotPassword(value.email); this.success.set(response.message); }
      else { const token = this.route.snapshot.queryParamMap.get('token') || ''; if (!token) throw new Error('У посиланні відсутній токен відновлення'); await this.auth.resetPassword(token, value.password); this.success.set('Пароль змінено. Тепер ви можете увійти.'); }
    } catch (error: any) { this.error.set(error?.error?.message || error?.message || 'Не вдалося виконати запит'); }
    finally { this.loading.set(false); }
  }
  protected title(): string {
    const resetTitle = this.isPasswordSetup ? 'Створення пароля' : 'Новий пароль';
    return ({ login: 'Вхід', register: 'Створити обліковий запис', forgot: 'Відновлення пароля', reset: resetTitle })[this.mode];
  }
}
