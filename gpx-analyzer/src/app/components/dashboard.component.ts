import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FileUploadComponent } from './file-upload.component';
import { HeightChartComponent } from './height-chart.component';
import { GradientTableComponent } from './gradient-table.component';
import { TabsComponent } from './tabs.component';
import { TabsService } from '../services/tabs.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, FileUploadComponent, HeightChartComponent, GradientTableComponent, TabsComponent],
  template: `
    <div class="dashboard-root">
      <header class="top">
        <div class="left">
          <h1>GPX Analyzer</h1>
        </div>
        <div class="right">
          <app-file-upload></app-file-upload>
        </div>
      </header>

      <app-tabs></app-tabs>

      <div class="content-area">
        <aside class="config" *ngIf="activeTab">
          <h3>Components</h3>
          <label class="comp-row"><input type="checkbox" [checked]="isVisible('height')" (change)="toggle('height',$event.target.checked)"/> Height chart</label>
          <label class="comp-row"><input type="checkbox" [checked]="isVisible('gradient')" (change)="toggle('gradient',$event.target.checked)"/> Gradient table</label>
        </aside>

        <main class="tiles">
          <div *ngIf="!activeTab" class="empty">Open a GPX file to get started.</div>

          <ng-container *ngIf="activeTab">
            <div class="tile" *ngFor="let c of activeTab.visibleComponents">
              <div class="tile-inner">
                <ng-container [ngSwitch]="c">
                  <app-height-chart *ngSwitchCase="'height'" [points]="activeTab.points"></app-height-chart>
                  <app-gradient-table *ngSwitchCase="'gradient'" [points]="activeTab.points"></app-gradient-table>
                  <div *ngSwitchDefault>Unknown component</div>
                </ng-container>
              </div>
            </div>
          </ng-container>
        </main>
      </div>
    </div>
  `,
  styles: [
    `
    :host { display:block }
    .dashboard-root{ display:flex; flex-direction:column; height:100vh; padding:12px; gap:12px }
    .top{ display:flex; justify-content:space-between; align-items:center }
    h1{ margin:0; font-size:1.25rem }
    app-tabs{ display:block }
    .content-area{ display:flex; gap:12px; flex:1; min-height:0 }
    .config{ width:220px; background:linear-gradient(180deg,#ffffff,#fbfdff); border-radius:12px; padding:12px; box-shadow:0 6px 24px rgba(20,40,80,0.06) }
    .config h3{ margin-top:0 }
    .comp-row{ display:flex; align-items:center; gap:8px; padding:6px 0 }
    .tiles{ display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:12px; flex:1; min-height:0 }
    .tile{ background: linear-gradient(180deg,#fff,#fbfcff); border-radius:12px; padding:10px; box-shadow:0 8px 30px rgba(20,40,80,0.06); border:1px solid rgba(30,60,120,0.06); display:flex; min-height:220px }
    .tile-inner{ display:flex; flex-direction:column; flex:1; min-height:0 }
    .tile app-height-chart, .tile app-gradient-table{ flex:1 1 auto; min-height:0 }
    .empty{ color:#666; font-style:italic }
    `
  ]
})
export class DashboardComponent {
  activeTab: any | null = null;

  constructor(private tabs: TabsService) {
    this.tabs.activeTab$.subscribe((t) => (this.activeTab = t));
  }

  isVisible(name: string) {
    if (!this.activeTab) return false;
    return this.activeTab.visibleComponents?.includes(name);
  }

  toggle(name: string, checked: boolean) {
    if (!this.activeTab) return;
    const id = this.activeTab.id;
    const current = this.activeTab.visibleComponents ? [...this.activeTab.visibleComponents] : [];
    if (checked) {
      if (!current.includes(name)) current.push(name);
    } else {
      const idx = current.indexOf(name);
      if (idx !== -1) current.splice(idx, 1);
    }
    this.tabs.updateTab(id, { visibleComponents: current });
  }

}
