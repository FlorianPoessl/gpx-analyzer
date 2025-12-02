import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { TrackPoint } from './gpx.service';

export interface TrackTab {
  id: string;
  name: string;
  points: TrackPoint[];
  visibleComponents?: string[];
}

@Injectable({ providedIn: 'root' })
export class TabsService {
  private _tabs = new BehaviorSubject<TrackTab[]>([]);
  readonly tabs$ = this._tabs.asObservable();

  private _active = new BehaviorSubject<string | null>(null);
  readonly active$ = this._active.asObservable();
  readonly activeTab$ = combineLatest([this._tabs, this._active]).pipe(
    map(([tabs, activeId]) => tabs.find((t) => t.id === activeId) ?? null)
  );

  openTab(name: string, points: TrackPoint[]) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tab: TrackTab = { id, name, points, visibleComponents: ['height', 'gradient'] };
    const current = this._tabs.value.slice();
    current.push(tab);
    this._tabs.next(current);
    this._active.next(id);
    return id;
  }

  updateTab(id: string, patch: Partial<TrackTab>) {
    const current = this._tabs.value.slice();
    const idx = current.findIndex((t) => t.id === id);
    if (idx === -1) return;
    current[idx] = { ...current[idx], ...patch };
    this._tabs.next(current);
  }

  closeTab(id: string) {
    const current = this._tabs.value.filter((t) => t.id !== id);
    this._tabs.next(current);
    if (this._active.value === id) {
      const next = current.length ? current[current.length - 1].id : null;
      this._active.next(next);
    }
  }

  setActive(id: string | null) {
    this._active.next(id);
  }
}
