import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GpxService } from '../services/gpx.service';
import { TabsService } from '../services/tabs.service';

@Component({
  selector: 'app-file-upload',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="file-upload">
      <label class="btn">
        Select GPX file
        <input type="file" accept=".gpx,application/gpx+xml" (click)="onClickInput($event)" (change)="onFile($event)" />
      </label>
    </div>
  `,
  styles: [
    `
    .btn { display:inline-block; padding:8px 12px; background:#1976d2; color:white; border-radius:8px; cursor:pointer; position:relative; overflow:hidden }
    input[type=file]{ position:absolute; inset:0; width:100%; height:100%; opacity:0; cursor:pointer }
    .msg{ margin-top:8px }
    `
  ]
})
export class FileUploadComponent {
  constructor(private gpx: GpxService, private tabs: TabsService) {}

  onFile(ev: Event) {
    console.log('file input change event', ev);
    const input = ev.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      try {
        const pts = this.gpx.parseGpx(text);
        this.tabs.openTab(file.name, pts);
      } catch (err) {
        console.error(err);
      }
    };
    reader.readAsText(file);
  }

  onClickInput(ev: Event) {
    console.log('file input clicked', ev);
    // clear previous selection to ensure change fires even if same file is selected
    const input = ev.target as HTMLInputElement;
    if (input && input.value) {
      input.value = '';
    }
  }
}
