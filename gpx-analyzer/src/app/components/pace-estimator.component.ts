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

      <div class="controls">
        <label>Uphill sensitivity:</label>
        <select [(ngModel)]="sensitivity">
          <option *ngFor="let l of levels" [value]="l.id">{{ l.name }}</option>
        </select>
        <div class="level-desc">{{ levels[sensitivity]?.name }}</div>
      </div>

      <div class="controls">
        <label>Flat pace (per km):</label>
        <input type="text" placeholder="mm:ss" [(ngModel)]="flatPace" />
        <div class="level-desc">Enter pace you'd run on flat terrain (e.g. 06:30). If both this and target time are set, target time is used.</div>
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
                <td>
                  <span *ngIf="r.isPartial">{{ formatSeconds(r.timeSeconds) }} <small>(for {{ (r.distance*1000)|number:'1.0-0' }} m)</small></span>
                  <span *ngIf="!r.isPartial">{{ formatSeconds(r.paceSeconds) }}</span>
                </td>
              </tr>
            </tbody>
            <tfoot *ngIf="results && results.length">
              <tr>
                <td colspan="1"><strong>Total</strong></td>
                <td><strong>{{ totalDistanceKm.toFixed(2) }} km</strong></td>
                <td></td>
                <td><strong>{{ formatSeconds(totalTimeSeconds) }}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
    </div>
  `,
  styles: [
    `
    :host{ display:block }
    .pace-root{ display:flex; flex-direction:column; gap:8px }
    .controls{ display:flex; align-items:center; gap:8px }
    .controls select{ padding:6px; border-radius:6px; border:1px solid #ddd }
    .level-desc{ margin-left:8px; color:#444; font-size:0.9rem }
    .time-inputs{ display:flex; align-items:center; gap:6px }
    input[type=number]{ width:56px; padding:6px; border-radius:6px; border:1px solid #ddd }
    .results{ width:100%; border-collapse:collapse }
    .results th, .results td{ text-align:left; padding:6px 8px; border-bottom:1px solid #eee }
    .results td.up{ color:#b22222 }
    .results td.down{ color:#2e8b57 }
    .empty{ color:#666; font-style:italic }
    `
  ]
})
export class PaceEstimatorComponent {
  @Input() points: TrackPoint[] | null = null;

  hours = 0;
  minutes = 0;
  seconds = 0;
  // flat pace input (e.g. "06:30") representing mm:ss per km on flat
  flatPace = '';

  // sensitivity presets for how much elevation affects pace
  sensitivity = 2; // default index
  levels = [
    { id: 0, name: 'Absolute Pro (unchanged uphill)', factor: 0.05 },
    { id: 1, name: 'Strong Climber', factor: 0.12 },
    { id: 2, name: 'Balanced', factor: 0.2 },
    { id: 3, name: 'Cautious Climber', factor: 0.4 },
    { id: 4, name: "I'd rather walk the steeper uphills", factor: 0.8 }
  ];

  results: Array<{ distance: number; elevDelta: number; paceSeconds: number; isPartial: boolean; timeSeconds: number }> | null = null;
  totalTimeSeconds = 0;
  totalDistanceKm = 0;

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

    // determine base pace: prefer target finish time if configured, otherwise use flat pace input
    const hasTargetTime = (this.hours || 0) + (this.minutes || 0) + (this.seconds || 0) > 0;
    const parsedFlatPace = this.parsePace(this.flatPace);

    let basePaceSeconds: number;
    if (hasTargetTime) {
      basePaceSeconds = totalSeconds / totalKm; // seconds per km computed from target time
    } else if (parsedFlatPace) {
      basePaceSeconds = parsedFlatPace; // seconds per km from flat-pace input
    } else {
      // nothing provided: abort with no results
      this.results = null;
      return;
    }

    // generate per-km segments (include last partial) by interpolating elevation at each km boundary
    const segments: Array<{ distance: number; elevDelta: number }> = [];

    const totalMetersClamped = Math.max(0, totalMeters);
    const kmCount = Math.max(1, Math.ceil(totalMetersClamped / 1000));

    // helper: get elevation at an arbitrary distance (meters) along the track by linear interpolation
    const getElevationAt = (distMeters: number) => {
      if (distMeters <= 0) return this.points![0].ele ?? 0;
      if (distMeters >= totalMetersClamped) return this.points![this.points!.length - 1].ele ?? 0;
      // find segment containing distMeters
      for (let i = 1; i < this.points!.length; i++) {
        const prev = this.points![i - 1];
        const cur = this.points![i];
        const prevCum = prev.cumDist ?? 0;
        const curCum = cur.cumDist ?? 0;
        if (distMeters >= prevCum && distMeters <= curCum) {
          const segLen = curCum - prevCum;
          if (segLen <= 0) return cur.ele ?? prev.ele ?? 0;
          const ratio = (distMeters - prevCum) / segLen;
          const prevEle = prev.ele ?? 0;
          const curEle = cur.ele ?? 0;
          return prevEle + (curEle - prevEle) * ratio;
        }
      }
      return this.points![this.points!.length - 1].ele ?? 0;
    };

    for (let k = 0; k < kmCount; k++) {
      const start = k * 1000;
      const end = Math.min(totalMetersClamped, (k + 1) * 1000);
      const distanceMeters = end - start;
      if (distanceMeters <= 0) continue;
      const elevStart = getElevationAt(start);
      const elevEnd = getElevationAt(end);
      segments.push({ distance: distanceMeters / 1000, elevDelta: elevEnd - elevStart });
    }
    
    // Now compute pace per segment factoring elevation change
    const elevationFactor = this.levels[this.sensitivity]?.factor ?? 0.2; // seconds per meter of elevation gain

    const mapped = segments.map((s) => {
      const elevMeters = s.elevDelta;
      const adjustment = elevMeters * elevationFactor;
      const timeForSegmentSeconds = basePaceSeconds * s.distance + adjustment; // total seconds for this segment
      const isPartial = s.distance < 0.999; // treat <1km as partial
      const pacePerKm = timeForSegmentSeconds / s.distance; // seconds per km equivalent
      return { distance: s.distance, elevDelta: elevMeters, paceSeconds: isPartial ? pacePerKm : pacePerKm, isPartial, timeSeconds: timeForSegmentSeconds };
    });

    this.results = mapped;
    this.totalTimeSeconds = mapped.reduce((a, b) => a + (b.timeSeconds ?? 0), 0);
    this.totalDistanceKm = mapped.reduce((a, b) => a + (b.distance ?? 0), 0);
  }

  // parse a pace string like "6:30" or "06:30" or "1:06:30" (hh:mm:ss)
  private parsePace(input: string): number | null {
    if (!input) return null;
    const parts = input.split(':').map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) return null;
    const nums = parts.map((p) => Number(p));
    if (nums.some((n) => Number.isNaN(n) || n < 0)) return null;
    if (nums.length === 1) {
      // seconds only
      return nums[0];
    }
    if (nums.length === 2) {
      const [m, s] = nums;
      return m * 60 + s;
    }
    if (nums.length === 3) {
      const [h, m, s] = nums;
      return h * 3600 + m * 60 + s;
    }
    return null;
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
