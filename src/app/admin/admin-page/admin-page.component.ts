import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '@auth0/auth0-angular';

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (auth.isLoading$ | async) {
      <div>Loading...</div>
    } @else {
      @if ((auth.isAuthenticated$ | async) && (auth.user$ | async); as user) {
        <p>Logged in as {{ user.email }}</p>
        <h1>User Profile</h1>
        <pre>{{ user | json }}</pre>
        <button (click)="auth.logout({ logoutParams: { returnTo: window.location.origin } })">Logout</button>
      } @else {
        @if (auth.error$ | async; as error) {
          <p>Error: {{ error.message }}</p>
        }
        <button (click)="auth.loginWithRedirect({ authorizationParams: { screen_hint: 'signup' } })">
          Sign Up
        </button>
        <button (click)="auth.loginWithRedirect()">Log In</button>
      }
    }
  `
})
export class AdminPageComponent {
  protected readonly window = window;
  protected auth = inject(AuthService);
}
