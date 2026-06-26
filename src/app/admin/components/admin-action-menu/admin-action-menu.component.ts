import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-admin-action-menu',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  templateUrl: './admin-action-menu.component.html',
  styleUrls: ['./admin-action-menu.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminActionMenuComponent {
  @Input() buttonLabel = 'Дія';
  @Input() showView = false;
  @Input() showEdit = false;
  @Input() showDelete = false;
  @Input() showSale = false;
  @Input() deleteDisabled = false;

  @Output() view = new EventEmitter<void>();
  @Output() edit = new EventEmitter<void>();
  @Output() delete = new EventEmitter<void>();
  @Output() sale = new EventEmitter<void>();

  @ViewChild('trigger', { static: true }) private trigger?: ElementRef<HTMLElement>;

  private host = inject(ElementRef<HTMLElement>);

  protected isOpen = false;
  protected panelStyle: Record<string, string> = {};

  protected toggleMenu(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.isOpen) {
      this.closeMenu();
      return;
    }

    this.positionPanel();
    this.isOpen = true;
  }

  protected runAction(event: MouseEvent, action: EventEmitter<void>, disabled = false): void {
    event.preventDefault();
    event.stopPropagation();

    if (disabled) return;

    this.closeMenu();
    action.emit();
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen) return;
    if (this.host.nativeElement.contains(event.target as Node)) return;
    this.closeMenu();
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  protected closeMenu(): void {
    this.isOpen = false;
  }

  private positionPanel(): void {
    const trigger = this.trigger?.nativeElement;
    if (!trigger) return;

    const panelWidth = 192;
    const gap = 6;
    const viewportPadding = 8;
    const rect = trigger.getBoundingClientRect();
    const left = Math.max(
      viewportPadding,
      Math.min(window.innerWidth - panelWidth - viewportPadding, rect.right - panelWidth),
    );

    this.panelStyle = {
      top: `${rect.bottom + gap}px`,
      left: `${left}px`,
      width: `${panelWidth}px`,
    };
  }
}
