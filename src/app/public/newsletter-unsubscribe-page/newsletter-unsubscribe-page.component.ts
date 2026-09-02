import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NewsletterService } from '../../core/services/newsletter.service';

@Component({
  selector: 'app-newsletter-unsubscribe-page', standalone: true, imports: [RouterLink],
  template: `<main><div><h1>{{ title() }}</h1><p>{{ message() }}</p><a routerLink="/">Повернутися до магазину</a></div></main>`,
  styles: [`main{min-height:70vh;display:grid;place-items:center;padding:30px;text-align:center}div{max-width:600px}h1{font:clamp(36px,6vw,64px) var(--un-serif,Georgia,serif);font-weight:400}p{line-height:1.6}a{display:inline-block;margin-top:20px;color:inherit}`]
})
export class NewsletterUnsubscribePageComponent implements OnInit {
  private route = inject(ActivatedRoute); private service = inject(NewsletterService);
  protected title = signal('Відписка від оновлень'); protected message = signal('Обробляємо ваш запит…');
  async ngOnInit(): Promise<void> {
    const token = this.route.snapshot.queryParamMap.get('token') || '';
    try { this.message.set(await this.service.unsubscribe(token)); }
    catch (error: any) { this.title.set('Не вдалося відписатися'); this.message.set(error?.error?.message || 'Посилання недійсне.'); }
  }
}
