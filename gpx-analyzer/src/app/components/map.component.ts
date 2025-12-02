import { Component, AfterViewInit, OnDestroy, OnChanges, SimpleChanges, ViewChild, ElementRef, Input } from '@angular/core';
import { CommonModule, NgIf } from '@angular/common';
import * as L from 'leaflet';

// Ensure Leaflet's default marker icon URLs are valid when built by Angular.
// Use unpkg CDN so we don't have to copy images into assets.
(L as any).Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});
import { TrackPoint } from '../services/gpx.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIf],
  template: `
    <div class="config-bar" *ngIf="points && points.length > 0">
      <label>
        <input type="checkbox" [(ngModel)]="showKmMarkers" (ngModelChange)="updatePolyline()">
        Show km markers
      </label>
      <label>
        <input type="checkbox" [(ngModel)]="showGradient" (ngModelChange)="updatePolyline()">
        Show gradient
      </label>
    </div>
    <div #map class="map-root"></div>
  `,
  styles: [
    `
    :host{ display:block; height:100%; position: relative; }
    .map-root{ width:100%; height:100%; min-height:220px; border-radius:8px; overflow:hidden }
    .config-bar {
      position: absolute;
      top: 10px;
      left: 60px;
      z-index: 401; /* Above tiles, below popups */
      background: rgba(255, 255, 255, 0.9);
      padding: 8px;
      border-radius: 5px;
      box-shadow: 0 1px 5px rgba(0,0,0,0.4);
      display: flex;
      gap: 15px;
    }
    .config-bar label {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-family: sans-serif;
      font-size: 14px;
      cursor: pointer;
    }
    `
  ]
})
export class MapComponent implements AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('map', { static: true }) mapEl!: ElementRef<HTMLDivElement>;
  @Input() points: TrackPoint[] | null = null;

  showKmMarkers = false;
  showGradient = true;

  private map: L.Map | null = null;
  private segmentsLayer: L.LayerGroup | null = null;
  private resizeObserver: ResizeObserver | null = null;

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['points'] && this.map) {
      this.updatePolyline();
    }
  }

  private initMap() {
    if (this.map) return;
    this.map = L.map(this.mapEl.nativeElement, { center: [0, 0], zoom: 2 });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    this.updatePolyline();

    // Observe size changes so Leaflet can recalculate layout when the container grows
    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(() => {
        try {
          this.map?.invalidateSize();
        } catch (e) {
          // ignore
        }
      });
      this.resizeObserver.observe(this.mapEl.nativeElement);
    }
  }

  public updatePolyline() {
    if (!this.points || !this.map || this.points.length < 2) return;

    // Create or clear the layer that holds colored segments
    if (!this.segmentsLayer) {
      this.segmentsLayer = L.layerGroup().addTo(this.map);
    } else {
      this.segmentsLayer.clearLayers();
    }

    const bounds = L.latLngBounds([]);
    let nextKm = 1000; // meters

    // Draw each segment with color based on gradient (from previous->current)
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1];
      const b = this.points[i];
      const latlngs: L.LatLngExpression[] = [ [a.lat, a.lon], [b.lat, b.lon] ];
      const color = this.showGradient
        ? this.gradientToColor(typeof b.gradient === 'number' ? b.gradient : 0)
        : 'red';
      const seg = L.polyline(latlngs, { color, weight: 4, lineCap: 'round' });
      seg.addTo(this.segmentsLayer);
      bounds.extend(latlngs as any);

      // Check for kilometer checkpoints
      if (this.showKmMarkers) {
        const prevDist = a.cumDist || 0;
        const currDist = b.cumDist || 0;

        while (nextKm <= currDist) {
          if (prevDist < nextKm) {
            // We crossed a kilometer mark. Interpolate the position.
            const ratio = (nextKm - prevDist) / (currDist - prevDist);
            const lat = a.lat + (b.lat - a.lat) * ratio;
            const lon = a.lon + (b.lon - a.lon) * ratio;

            // Add marker
            const marker = L.circleMarker([lat, lon], {
              radius: 4, fillColor: 'black', color: 'black', weight: 1, opacity: 1, fillOpacity: 1
            });
            marker.addTo(this.segmentsLayer);
          }
          nextKm += 1000;
        }
      }
    }

    try {
      if (bounds.isValid()) this.map.fitBounds(bounds, { padding: [20, 20] });
    } catch (e) {
      // ignore
    }

    // ensure Leaflet recalculates sizes after layout changes
    setTimeout(() => {
      try {
        this.map?.invalidateSize();
      } catch (e) {
        // ignore
      }
    }, 0);
  }

  private gradientToColor(g: number) {
    // Map gradient (m/m) to a color between green (downhill) and red (uphill).
    // Clamp to a sensible range to avoid extreme hues.
    const min = -0.2; // steep downhill
    const max = 0.2;  // steep uphill
    const v = Math.max(min, Math.min(max, g));
    const t = (v - min) / (max - min); // 0..1
    const hue = (1 - t) * 120; // 120 (green) -> 0 (red)
    return `hsl(${hue}, 80%, 45%)`;
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    if (this.resizeObserver) {
      try { this.resizeObserver.disconnect(); } catch (e) { /* ignore */ }
      this.resizeObserver = null;
    }
  }
}
