import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TabsService } from '../services/tabs.service';

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [CommonModule],
  template: `
    <nav class="tabs">
      <button class="tab" *ngFor="let t of tabs" [class.active]="t.id===active" (click)="activate(t.id)">
        <span class="tab-name">{{ t.name }}</span>
        <button class="close" (click)="close(t.id); $event.stopPropagation()">✕</button>
      </button>
      <div class="spacer"></div>
    </nav>
  `,
  styles: [
    `
    .tabs{ display:flex; gap:8px; align-items:center; padding:8px; background:linear-gradient(90deg,#f7f8fb,#fff); border-radius:10px }
    .tab{ display:flex; align-items:center; gap:8px; padding:6px 10px; border-radius:8px; border:0; background:transparent; cursor:pointer }
    .tab.active{ background:linear-gradient(90deg,#eef2ff,#e6f0ff); box-shadow:0 2px 8px rgba(30,60,120,0.06) }
    .tab-name{ max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
    .close{ margin-left:4px; border:0; background:transparent; color:#666; cursor:pointer }
    .spacer{ flex:1 }
    `
  ]
})
export class TabsComponent {
  tabs: any[] = [];
  active: string | null = null;

  constructor(private tabsService: TabsService) {
    this.tabsService.tabs$.subscribe((t) => (this.tabs = t));
    this.tabsService.active$.subscribe((a) => (this.active = a));
  }

  activate(id: string) {
    this.tabsService.setActive(id);
  }

  close(id: string) {
    this.tabsService.closeTab(id);
  }
}
