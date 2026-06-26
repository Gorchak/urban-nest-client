import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class StructuredDataService {
  private document = inject(DOCUMENT);

  set(id: string, data: object): void {
    const scriptId = `structured-data-${id}`;
    let script = this.document.getElementById(scriptId) as HTMLScriptElement | null;

    if (!script) {
      script = this.document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      this.document.head.appendChild(script);
    }

    script.textContent = JSON.stringify(data);
  }

  remove(id: string): void {
    this.document.getElementById(`structured-data-${id}`)?.remove();
  }
}
