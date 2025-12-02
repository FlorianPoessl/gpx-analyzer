import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import * as d3 from 'd3';
import { GpxService, TrackPoint } from '../services/gpx.service';

@Component({
  selector: 'app-height-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chart-root">
      <svg #svg></svg>
    </div>
  `,
  styles: [
    `
    .chart-root { width:100%; height:220px; background:linear-gradient(#fff,#f7f7f7); border-radius:6px; padding:8px; box-sizing:border-box }
    svg { width:100%; height:100% }
    `
  ]
})
export class HeightChartComponent implements OnInit, OnChanges, OnDestroy {
  @ViewChild('svg', { static: true }) svgRef!: ElementRef<SVGSVGElement>;
  sub?: Subscription;
  @Input() points?: TrackPoint[] | null;

  constructor(private gpx: GpxService, private el: ElementRef) {}

  ngOnInit() {
    if (!this.points) {
      this.sub = this.gpx.points$.subscribe((pts) => {
        if (!pts || pts.length === 0) {
          this.clear();
          return;
        }
        this.renderD3(pts);
      });
    } else {
      this.renderD3(this.points);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['points'] && this.points) {
      this.renderD3(this.points);
    }
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  clear() {
    const svg = d3.select(this.svgRef.nativeElement);
    svg.selectAll('*').remove();
  }

  renderD3(pts: TrackPoint[]) {
    const svgEl = this.svgRef.nativeElement;
    const svg = d3.select(svgEl);
    const margin = { top: 10, right: 10, bottom: 20, left: 30 };
    const width = Math.max(600, svgEl.clientWidth || 800);
    const height = 200;
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    svg.selectAll('*').remove();

    const maxDist = pts[pts.length - 1].cumDist || 0;
    const minEle = d3.min(pts, (d: TrackPoint) => d.ele) ?? 0;
    const maxEle = d3.max(pts, (d: TrackPoint) => d.ele) ?? 0;

    const x = d3.scaleLinear().domain([0, maxDist || 1]).range([margin.left, width - margin.right]);
    const y = d3.scaleLinear().domain([minEle, maxEle]).range([height - margin.bottom, margin.top]);

    // build segments
    const segs: Array<{ x1: number; y1: number; x2: number; y2: number; color: string }> = [];
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const g = p1.gradient || 0;
      segs.push({ x1: x(p0.cumDist || 0), y1: y(p0.ele), x2: x(p1.cumDist || 0), y2: y(p1.ele), color: gradientColor(g) });
    }

    // draw background axis
    const axisG = svg.append('g');
    const xAxis = d3
      .axisBottom(x)
      .ticks(6)
      .tickFormat((d: d3.NumberValue, i: number) => `${Math.round(Number(d) / 1000)} km`);
    const yAxis = d3.axisLeft(y).ticks(4);
    axisG.append('g').attr('transform', `translate(0, ${height - margin.bottom})`).call(xAxis as any);
    axisG.append('g').attr('transform', `translate(${margin.left},0)`).call(yAxis as any);

    // draw segments with D3 data join
    svg
      .append('g')
      .attr('class', 'segments')
      .selectAll('line')
      .data(segs)
      .join('line')
      .attr('x1', (d: { x1: number }) => d.x1)
      .attr('y1', (d: { y1: number }) => d.y1)
      .attr('x2', (d: { x2: number }) => d.x2)
      .attr('y2', (d: { y2: number }) => d.y2)
      .attr('stroke', (d: { color: string }) => d.color)
      .attr('stroke-width', 2)
      .attr('stroke-linecap', 'round');
  }
}

function gradientColor(g: number) {
  const perc = Math.tanh(Math.abs(g) * 50);
  const intensity = Math.round(80 + perc * 175);
  if (g >= 0) {
    return `rgb(${intensity},40,40)`;
  } else {
    return `rgb(40,${intensity},40)`;
  }
}
