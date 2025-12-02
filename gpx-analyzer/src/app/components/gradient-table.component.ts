import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { GpxService, TrackPoint } from '../services/gpx.service';

@Component({
  selector: 'app-gradient-table',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="table-root">
      <label>Interval meters: <input type="number" [(ngModel)]="interval" /></label>
      <table *ngIf="rows.length>0">
        <thead><tr><th>From (m)</th><th>To (m)</th><th>Distance (m)</th><th>Avg Gradient (%)</th></tr></thead>
        <tbody>
          <tr *ngFor="let r of rows">
            <td>{{ r.from | number:'1.0-0' }}</td>
            <td>{{ r.to | number:'1.0-0' }}</td>
            <td>{{ r.dist | number:'1.0-0' }}</td>
            <td [style.color]="r.avgGrad>=0? 'crimson':'green'">{{ (r.avgGrad*100) | number:'1.2-2' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
  styles: [
    `
    .table-root { padding:8px }
    table { width:100%; border-collapse:collapse }
    th,td{ padding:6px; border-bottom:1px solid #eee }
    input{ width:100px }
    `
  ]
})

export class GradientTableComponent implements OnInit, OnChanges, OnDestroy {
  @Input() points?: TrackPoint[] | null;
  interval = 1000;
  rows: Array<{ from: number; to: number; dist: number; avgGrad: number }> = [];
  sub?: Subscription;

  constructor(private gpx: GpxService) {}

  ngOnInit() {
    if (!this.points) {
      this.sub = this.gpx.points$.subscribe((pts) => {
        if (!pts) { this.rows = []; return; }
        this.buildTable(pts);
      });
    } else {
      this.buildTable(this.points);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['points'] && this.points) {
      this.buildTable(this.points);
    }
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  buildTable(pts: TrackPoint[]) {
    const total = pts[pts.length - 1].cumDist || 0;
    const rows: any[] = [];
    for (let start = 0; start < total; start += this.interval) {
      const end = Math.min(start + this.interval, total);
      // find points inside range and compute weighted average gradient
      let weightedSum = 0;
      let distSum = 0;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1].cumDist || 0;
        const b = pts[i].cumDist || 0;
        const segStart = Math.max(a, start);
        const segEnd = Math.min(b, end);
        const segLen = segEnd - segStart;
        if (segLen > 0) {
          weightedSum += (pts[i].gradient || 0) * segLen;
          distSum += segLen;
        }
      }
      const avg = distSum > 0 ? weightedSum / distSum : 0;
      rows.push({ from: start, to: end, dist: distSum, avgGrad: avg });
    }
    this.rows = rows;
  }
}
