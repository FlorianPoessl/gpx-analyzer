import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TrackPoint } from '../services/gpx.service';

@Component({
  selector: 'app-pace-estimator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pace-root">
      <h3>Pace Estimator</h3>

      <div class="controls">
        <label>Target finish time:</label>
        <div class="time-inputs">
          <input type="number" min="0" [(ngModel)]="hours" placeholder="hh" /> :
          <input type="number" min="0" max="59" [(ngModel)]="minutes" placeholder="mm" /> :
          <input type="number" min="0" max="59" [(ngModel)]="seconds" placeholder="ss" />
          <button (click)="estimate()">Estimate</button>
        </div>
      </div>

      <div *ngIf="!points || points.length===0" class="empty">Open a GPX file to estimate pace.</div>

      <div *ngIf="results && results.length">
        <table class="results">
          <thead>
            <tr><th>Km</th><th>Distance</th><th>Elevation Δ (m)</th><th>Pace</th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let r of results; let i = index">
              <td>{{ i+1 }}</td>
              <td>{{ r.distance.toFixed(2) }} km</td>
              <td [class.up]="r.elevDelta>0" [class.down]="r.elevDelta<0">{{ r.elevDelta.toFixed(1) }}</td>
              <td>{{ formatSeconds(r.paceSeconds) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [
    `
    :host{ display:block }
    .pace-root{ display:flex; flex-direction:column; gap:8px }
    .controls{ display:flex; align-items:center; gap:8px }
    .time-inputs{ display:flex; align-items:center; gap:6px }
    input[type=number]{ width:56px; padding:6px; border-radius:6px; border:1px solid #ddd }
    .results{ width:100%; border-collapse:collapse }
    .results th, .results td{ text-align:left; padding:6px 8px; border-bottom:1px solid #eee }
    .results td.up{ color:#b22222 }
    .results td.down{ color:#6a0dad }
    .empty{ color:#666; font-style:italic }
    `
  ]
})
export class PaceEstimatorComponent {
  @Input() points: TrackPoint[] | null = null;

  hours = 0;
  minutes = 0;
  seconds = 0;

  results: Array<{ distance: number; elevDelta: number; paceSeconds: number }> | null = null;

  estimate() {
    if (!this.points || this.points.length === 0) {
      this.results = null;
      return;
    }

    const totalSeconds = Math.max(1, (this.hours || 0) * 3600 + (this.minutes || 0) * 60 + (this.seconds || 0));

    // compute total distance in km
    const last = this.points[this.points.length - 1];
    const totalMeters = last.cumDist ?? 0;
    const totalKm = Math.max(0.001, totalMeters / 1000);

    const basePaceSeconds = totalSeconds / totalKm; // seconds per km

    // generate per-km segments (include last partial)
    const segments: Array<{ distance: number; elevDelta: number }> = [];

    let segDistRemaining = 1000; // meters to fill current km
    let segElev = 0;
    let acc = 0;

    for (let i = 1; i < this.points.length; i++) {
      let segLen = this.points[i].distFromPrev ?? 0;
      let segEle = (this.points[i].ele ?? 0) - (this.points[i - 1].ele ?? 0);

      while (segLen > 0) {
        if (segLen >= segDistRemaining) {
          // take part to finish current km
          const ratio = segDistRemaining / segLen;
          segElev += segEle * ratio;
          segments.push({ distance: (1000 - acc) / 1000, elevDelta: segElev });
          // prepare next km
          segLen = segLen - segDistRemaining;
          segEle = segEle * (1 - ratio);
          segDistRemaining = 1000;
          segElev = 0;
          acc = 0;
        } else {
          // consume entire segment but not yet finish km
          segElev += segEle;
          segDistRemaining -= segLen;
          acc += segLen;
          segLen = 0;
        }
      }
    }

    // if there's remaining partial km (acc > 0)
    const coveredMeters = segments.reduce((s, x) => s + x.distance * 1000, 0);
    const remainingMeters = Math.max(0, totalMeters - coveredMeters);
    if (remainingMeters > 0) {
      // approximate remaining elevation by walking backwards
      let remElev = 0;
      let toCollect = remainingMeters;
      for (let i = this.points.length - 1; i > 0 && toCollect > 0; i--) {
        const d = this.points[i].distFromPrev ?? 0;
        const e = (this.points[i].ele ?? 0) - (this.points[i - 1].ele ?? 0);
        const take = Math.min(d, toCollect);
        const ratio = d > 0 ? take / d : 0;
        remElev += e * ratio;
        toCollect -= take;
      }
      segments.push({ distance: remainingMeters / 1000, elevDelta: remElev });
    }

    // Now compute pace per segment factoring elevation change
    const elevationFactor = 0.2; // seconds per meter of elevation gain

    this.results = segments.map((s) => {
      const elevMeters = s.elevDelta;
      const adjustment = elevMeters * elevationFactor;
      const paceForSegmentSeconds = basePaceSeconds * s.distance + adjustment;
      const pacePerKm = paceForSegmentSeconds / s.distance;
      return { distance: s.distance, elevDelta: elevMeters, paceSeconds: pacePerKm };
    });
  }

  formatSeconds(sec: number) {
    if (!isFinite(sec) || sec <= 0) return '--:--';
    const s = Math.round(sec);
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    if (hh > 0) return `${hh}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
    return `${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
  }
}
