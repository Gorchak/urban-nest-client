import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Category } from '../../core/models/category.model';
import { CategoriesService } from '../../core/services/categories.service';
import { toRouteSlug } from '../../core/utils/route-slug';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { NewsletterService } from '../../core/services/newsletter.service';

@Component({
  selector: 'app-public-footer',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule],
  template: `
    <footer>
      <div class="footer-top">
        <div class="identity">
          <a class="brand" routerLink="/">
            <img src="/assets/ulia_title.svg.svg" alt="Ulia" width="92" height="65" loading="lazy" decoding="async" />
          </a>
          <p>Обрані речі для красивих щоденних історій.</p>
          <div class="socials">
            <a href="https://www.instagram.com/uliaconceptstore/" target="_blank" rel="noopener noreferrer" aria-label="Ulia Concept Store в Instagram"><i class="ri-instagram-line"></i></a>
            <a href="https://www.threads.com/@uliaconceptstore?xmt=AQG0YtmoxgntwsnMmwzw-ISicsNFIvF-Buuq30Yucc9q1aA" target="_blank" rel="noopener noreferrer" aria-label="Ulia Concept Store у Threads"><i class="ri-threads-line"></i></a>
          </div>
        </div>

        <nav class="footer-group" [class.footer-group--open]="openSection() === 'catalog'">
          <button type="button" class="footer-group__toggle" [attr.aria-expanded]="openSection() === 'catalog'" aria-controls="footer-catalog" (click)="toggleSection('catalog')">
            <span>Каталог</span><i [class]="openSection() === 'catalog' ? 'ri-subtract-line' : 'ri-add-line'"></i>
          </button>
          <div id="footer-catalog" class="footer-group__content">
            @for (category of categories(); track category._id) {
              <a [routerLink]="['/category', routeSlug(category)]">{{ category.name }}</a>
            }
          </div>
        </nav>

        <nav class="footer-group" [class.footer-group--open]="openSection() === 'buyers'">
          <button type="button" class="footer-group__toggle" [attr.aria-expanded]="openSection() === 'buyers'" aria-controls="footer-buyers" (click)="toggleSection('buyers')">
            <span>Покупцям</span><i [class]="openSection() === 'buyers' ? 'ri-subtract-line' : 'ri-add-line'"></i>
          </button>
          <div id="footer-buyers" class="footer-group__content">
            <a routerLink="/delivery-and-payment">Доставка і оплата</a>
            <a routerLink="/returns-and-exchanges">Повернення та обмін</a>
            <a routerLink="/contacts">Контакти та магазин</a>
            <a href="mailto:uliaconcept%40gmail.com">uliaconcept&#64;gmail.com</a>
            <a href="tel:+380976456131">+38 097 645 61 31</a>
          </div>
        </nav>

        <div class="newsletter">
          <span>Новини Ulia</span>
          <h2>Підпишіться на оновлення та отримуйте інформацію про наші новинки.</h2>
          <form (submit)="subscribe($event)" novalidate>
            <label>
              <input type="email" placeholder="Ваш email" aria-label="Email" autocomplete="email" [formControl]="email" />
              <button type="submit" aria-label="Підписатися" [disabled]="submitting()"><span>Підписатися</span><i class="ri-arrow-right-line"></i></button>
            </label>
          </form>
          @if (email.touched && email.invalid) { <small class="message error">Введіть коректну email-адресу.</small> }
          @if (message()) { <small class="message" role="status" aria-live="polite" [class.error]="isError()">{{ message() }}</small> }
          <small>Підписуючись, ви погоджуєтесь отримувати новини магазину.</small>
        </div>
      </div>

      <div class="footer-bottom">
        <span>© {{ year }} Ulia</span>
        <nav class="legal" aria-label="Правова інформація">
          <a routerLink="/public-offer">Публічна оферта</a>
          <a routerLink="/privacy-policy">Політика конфіденційності</a>
        </nav>
      </div>
    </footer>
  `,
  styles: [`
    :host { display:block; color:#000; background:#fff; font-family:var(--un-sans); border-top:1px solid #000; }
    * { box-sizing:border-box; }
    footer { padding:clamp(3rem,7vw,7rem) 3vw 1.5rem; }
    .footer-top { display:grid; grid-template-columns:1.2fr .7fr .8fr 1.5fr; gap:clamp(2rem,5vw,6rem); }
    .brand { display:flex; align-items:center; width:max-content; }
    .brand img:first-child { width:54px; height:54px; object-fit:contain; }
    .brand img:last-child { width:92px; }
    .identity p { max-width:260px; margin:2rem 0; color:#000; line-height:1.6; }
    .socials { display:flex; gap:.6rem; }
    .socials a { width:38px; height:38px; display:grid; place-items:center; border:1px solid rgba(0,0,0,.25); color:inherit; text-decoration:none; }
    nav { display:flex; flex-direction:column; align-items:flex-start; gap:.8rem; }
    nav span,.newsletter>span { margin-bottom:.7rem; font-size:10px; font-weight:700; letter-spacing:.16em; text-transform:uppercase; }
    nav a { color:#000; font-size:13px; text-decoration:none; }
    nav a:hover { color:#000; }
    .footer-group__toggle { display:none; }
    .footer-group__content { display:flex; flex-direction:column; align-items:flex-start; gap:.8rem; }
    .newsletter h2 { max-width:520px; margin:0 0 2rem; font-family:var(--un-serif, Georgia,serif); font-size:clamp(2rem,3.5vw,4.2rem); font-weight:400; letter-spacing:-.035em; line-height:.98; }
    .newsletter label { padding:.8rem 0; display:flex; border-bottom:1px solid rgba(0,0,0,.55); }
    .newsletter input { min-width:0; flex:1; border:0; outline:0; background:transparent; color:#000; font:inherit; }
    .newsletter button { display:flex;align-items:center;gap:8px;border:0;background:transparent;color:#000;font-size:13px;cursor:pointer; }
    .newsletter button i { font-size:22px; }
    .newsletter small { display:block; margin-top:.8rem; color:#000; font-size:10px; line-height:1.5; }
    .newsletter form { margin:0; }
    .newsletter button:disabled { opacity:.45; cursor:wait; }
    .newsletter .message { font-size:12px; }
    .newsletter .message.error { color:#a3261e; }
    .footer-bottom { margin-top:clamp(4rem,8vw,8rem); padding-top:1.5rem; display:flex; justify-content:space-between; gap:1rem; border-top:1px solid rgba(0,0,0,.2); color:#000; font-size:10px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; }
    .legal { flex-direction:row; gap:1.4rem; }
    .legal a { color:inherit; font-size:10px; }
    @media(max-width:950px){.footer-top{grid-template-columns:1fr 1fr}.newsletter{grid-column:1/-1}.footer-bottom{margin-top:4rem}}
    @media(max-width:560px){
      footer{padding:3.5rem 20px calc(1.5rem + env(safe-area-inset-bottom))}
      .footer-top{grid-template-columns:1fr;gap:2.5rem}
      .identity p{margin:1.25rem 0}
      .footer-group{display:block;border-top:1px solid rgba(0,0,0,.18)}
      .footer-group:last-of-type{border-bottom:1px solid rgba(0,0,0,.18)}
      .footer-group__toggle{width:100%;min-height:58px;padding:0;display:flex;align-items:center;justify-content:space-between;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer}
      .footer-group__toggle span{margin:0;font-family:var(--un-serif,Georgia,serif);font-size:20px;font-weight:400;letter-spacing:0;text-transform:none}
      .footer-group__toggle i{font-size:17px}
      .footer-group__content{max-height:0;gap:.25rem;overflow:hidden;opacity:0;transition:max-height .3s ease,opacity .2s ease,padding .3s ease}
      .footer-group--open .footer-group__content{max-height:600px;padding:0 0 20px;opacity:1}
      nav a{min-height:24px;display:flex;align-items:center}
      .newsletter{grid-column:auto;padding-top:.5rem}
      .newsletter h2{margin-bottom:1.25rem;font-size:clamp(2.4rem,12vw,3.3rem)}
      .newsletter label{min-height:52px}
      .newsletter input{font-size:16px}
      .footer-bottom{margin-top:3.5rem;align-items:flex-start;flex-direction:column;line-height:1.5}
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicFooterComponent implements OnInit {
  private categoriesService = inject(CategoriesService);
  private newsletterService = inject(NewsletterService);
  protected categories = signal<Category[]>([]);
  protected year = new Date().getFullYear();
  protected openSection = signal<'catalog' | 'buyers' | null>('catalog');
  protected email = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] });
  protected submitting = signal(false);
  protected message = signal('');
  protected isError = signal(false);
  protected async subscribe(event?: Event): Promise<void> {
    event?.preventDefault();
    this.email.markAsTouched();
    if (this.email.invalid || this.submitting()) return;
    this.submitting.set(true); this.message.set('');
    try {
      this.message.set(await this.newsletterService.subscribe(this.email.value));
      this.isError.set(false); this.email.reset();
    } catch (error: any) {
      this.message.set(error?.error?.message || 'Не вдалося оформити підписку. Спробуйте ще раз.');
      this.isError.set(true);
    } finally { this.submitting.set(false); }
  }
  protected toggleSection(section: 'catalog' | 'buyers'): void {
    this.openSection.update((current) => current === section ? null : section);
  }
  protected routeSlug(category: Category): string {
    return toRouteSlug(category.slug);
  }

  async ngOnInit(): Promise<void> {
    try {
      const categories = await this.categoriesService.getCategories(1, 200);
      this.categories.set(categories.filter((category) => !category.parentId && category.isActive && category.isVisible).slice(0, 8));
    } catch {
      this.categories.set([]);
    }
  }
}
