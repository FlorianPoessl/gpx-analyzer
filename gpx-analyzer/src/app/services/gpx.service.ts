import { Injectable, signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface TrackPoint {
  lat: number;
  lon: number;
  ele: number;
  time?: Date;
  distFromPrev?: number; // meters
  cumDist?: number; // meters
  gradient?: number; // ele diff / dist (m/m)
}

@Injectable({ providedIn: 'root' })
export class GpxService {
  private _points = new BehaviorSubject<TrackPoint[] | null>(null);
  readonly points$ = this._points.asObservable();

  setPoints(points: TrackPoint[]) {
    this._points.next(points);
  }

  parseGpx(xmlText: string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');
    const trkpts = Array.from(doc.querySelectorAll('trkpt'));
    const pts: TrackPoint[] = trkpts.map((el: Element) => {
      const lat = parseFloat(el.getAttribute('lat') || '0');
      const lon = parseFloat(el.getAttribute('lon') || '0');
      const eleEl = el.querySelector('ele');
      const timeEl = el.querySelector('time');
      const ele = eleEl ? parseFloat(eleEl.textContent || '0') : 0;
      const time = timeEl ? new Date(timeEl.textContent || '') : undefined;
      return { lat, lon, ele, time };
    });

    // compute distances, cumulative distance and gradients
    let cum = 0;
    for (let i = 0; i < pts.length; i++) {
      if (i === 0) {
        pts[i].distFromPrev = 0;
        pts[i].cumDist = 0;
        pts[i].gradient = 0;
      } else {
        const d = haversine(pts[i - 1].lat, pts[i - 1].lon, pts[i].lat, pts[i].lon);
        pts[i].distFromPrev = d;
        cum += d;
        pts[i].cumDist = cum;
        const eleDiff = pts[i].ele - pts[i - 1].ele;
        pts[i].gradient = d > 0 ? eleDiff / d : 0;
      }
    }

    this.setPoints(pts);
    return pts;
  }
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000; // meters
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
