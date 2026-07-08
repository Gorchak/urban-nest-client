import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Category } from '../../core/models/category.model';
import { CategoriesService } from '../../core/services/categories.service';

@Component({
  selector: 'app-public-footer',
  standalone: true,
  imports: [RouterLink],
  template: `
    <footer>
      <div class="footer-top">
        <div class="identity">
          <a class="brand" routerLink="/">
            <img src="/assets/ulia_title.svg.svg" alt="Ulia" />
          </a>
          <p>Обрані речі для красивих щоденних історій.</p>
          <div class="socials">
            <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram"><i class="ri-instagram-line"></i></a>
            <a href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook"><i class="ri-facebook-fill"></i></a>
            <a href="https://t.me" target="_blank" rel="noreferrer" aria-label="Telegram"><i class="ri-telegram-2-line"></i></a>
          </div>
        </div>

        <nav>
          <span>Каталог</span>
          @for (category of categories(); track category._id) {
            <a [routerLink]="['/category', category.slug]">{{ category.name }}</a>
          }
        </nav>

        <nav>
          <span>Покупцям</span>
          <a routerLink="/">Новинки</a>
          <a routerLink="/checkout">Оформлення замовлення</a>
          <a href="mailto:gorchakua@gmail.com">Зв'язатися з нами</a>
          <a href="tel:+380000000000">+38 000 000 00 00</a>
        </nav>

        <div class="newsletter">
          <span>Новини Ulia</span>
          <h2>Будь першою, хто побачить нові колекції.</h2>
          <label>
            <input type="email" placeholder="Ваш email" />
            <button type="button" aria-label="Підписатися"><i class="ri-arrow-right-line"></i></button>
          </label>
          <small>Підписуючись, ви погоджуєтесь отримувати новини магазину.</small>
        </div>
      </div>

      <div class="footer-bottom">
        <span>© {{ year }} Ulia</span>
        <span>Зроблено з увагою до деталей</span>
      </div>
    </footer>
  `,
  styles: [`
    :host { display:block; color:var(--un-paper, #fff); background:var(--un-ink, #181713); font-family:var(--un-sans, Arial,Helvetica,sans-serif); }
    * { box-sizing:border-box; }
    footer { padding:clamp(3rem,7vw,7rem) 3vw 1.5rem; }
    .footer-top { display:grid; grid-template-columns:1.2fr .7fr .8fr 1.5fr; gap:clamp(2rem,5vw,6rem); }
    .brand { display:flex; align-items:center; width:max-content; filter:invert(1); }
    .brand img:first-child { width:54px; height:54px; object-fit:contain; }
    .brand img:last-child { width:92px; }
    .identity p { max-width:260px; margin:2rem 0; color:rgba(255,255,255,.65); line-height:1.6; }
    .socials { display:flex; gap:.6rem; }
    .socials a { width:38px; height:38px; display:grid; place-items:center; border:1px solid rgba(255,255,255,.25); color:inherit; text-decoration:none; }
    nav { display:flex; flex-direction:column; align-items:flex-start; gap:.8rem; }
    nav span,.newsletter>span { margin-bottom:.7rem; font-size:10px; font-weight:700; letter-spacing:.16em; text-transform:uppercase; }
    nav a { color:rgba(255,255,255,.7); font-size:13px; text-decoration:none; }
    nav a:hover { color:#fff; }
    .newsletter h2 { max-width:520px; margin:0 0 2rem; font-family:var(--un-serif, Georgia,serif); font-size:clamp(2rem,3.5vw,4.2rem); font-weight:400; letter-spacing:-.035em; line-height:.98; }
    .newsletter label { padding:.8rem 0; display:flex; border-bottom:1px solid rgba(255,255,255,.55); }
    .newsletter input { min-width:0; flex:1; border:0; outline:0; background:transparent; color:#fff; font:inherit; }
    .newsletter button { border:0; background:transparent; color:#fff; font-size:22px; cursor:pointer; }
    .newsletter small { display:block; margin-top:.8rem; color:rgba(255,255,255,.45); font-size:10px; line-height:1.5; }
    .footer-bottom { margin-top:clamp(4rem,8vw,8rem); padding-top:1.5rem; display:flex; justify-content:space-between; gap:1rem; border-top:1px solid rgba(255,255,255,.2); color:rgba(255,255,255,.55); font-size:10px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; }
    @media(max-width:950px){.footer-top{grid-template-columns:1fr 1fr}.newsletter{grid-column:1/-1}.footer-bottom{margin-top:4rem}}
    @media(max-width:560px){
      footer{padding:3.5rem 20px calc(1.5rem + env(safe-area-inset-bottom))}
      .footer-top{grid-template-columns:1fr;gap:2.5rem}
      .identity p{margin:1.25rem 0}
      nav{gap:.95rem}
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
  protected categories = signal<Category[]>([]);
  protected year = new Date().getFullYear();

  async ngOnInit(): Promise<void> {
    try {
      const categories = await this.categoriesService.getCategories(1, 200);
      this.categories.set(categories.filter((category) => !category.parentId && category.isActive && category.isVisible).slice(0, 8));
    } catch {
      this.categories.set([]);
    }
  }
}
