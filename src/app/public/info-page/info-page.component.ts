import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';
import { PublicFooterComponent } from '../shared/public-footer.component';

@Component({
  selector: 'app-info-page',
  standalone: true,
  imports: [RouterLink, PublicFooterComponent],
  templateUrl: './info-page.component.html',
  styleUrl: './info-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InfoPageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private seo = inject(SeoService);

  protected page = '';

  ngOnInit(): void {
    this.page = String(this.route.snapshot.data['page'] || 'contacts');
    const titles: Record<string, string> = {
      delivery: 'Доставка і оплата',
      returns: 'Повернення та обмін',
      contacts: 'Контакти',
      offer: 'Публічна оферта',
      privacy: 'Політика конфіденційності',
    };
    const title = titles[this.page] || 'Інформація';
    this.seo.setPage({
      title: `${title} | Ulia`,
      description: `${title}: актуальна інформація інтернет-магазину Ulia.`,
      canonicalUrl: this.route.snapshot.url.map((segment) => segment.path).join('/'),
    });
  }
}
