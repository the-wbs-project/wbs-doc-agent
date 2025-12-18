import { Component, inject, signal, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from '@syncfusion/ej2-angular-buttons';
import { DropDownListModule } from '@syncfusion/ej2-angular-dropdowns';
import { UploaderModule } from '@syncfusion/ej2-angular-inputs';
import type { SelectedEventArgs, UploaderComponent } from '@syncfusion/ej2-angular-inputs';
import type { ChangeEventArgs } from '@syncfusion/ej2-angular-dropdowns';
import { JobsService } from '../../services/jobs.service';

@Component({
  selector: 'app-upload',
  imports: [UploaderModule, DropDownListModule, ButtonModule],
  template: `
    <div class="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center p-4">
      <div class="w-full max-w-lg">
        <h1 class="text-2xl font-semibold mb-6 text-center">WBS Document Agent</h1>

        <div class="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <ejs-uploader
            #uploader
            [autoUpload]="false"
            [multiple]="false"
            [allowedExtensions]="'.pdf,.xlsx,.xls,.png,.jpg,.jpeg,.gif,.webp'"
            [dropArea]="dropArea"
            (selected)="onFileSelected($event)"
            (removing)="onFileRemoved($event)"
          >
          </ejs-uploader>

          <div class="mt-6">
            <label class="block text-sm text-gray-600 mb-2">Mode</label>
            <ejs-dropdownlist
              [dataSource]="modeOptions"
              [fields]="{ text: 'text', value: 'value' }"
              [value]="mode()"
              (change)="onModeChange($event)"
              placeholder="Select mode"
              cssClass="e-outline"
            >
            </ejs-dropdownlist>
          </div>

          <div class="mt-6">
            <button
              ejs-button
              [isPrimary]="true"
              [disabled]="!selectedFile() || uploading()"
              (click)="upload()"
              cssClass="e-block"
            >
              @if (uploading()) {
                Uploading...
              } @else {
                Upload & Process
              }
            </button>
          </div>

          @if (error()) {
            <div class="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
              {{ error() }}
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host ::ng-deep .e-upload {
        border: 2px dashed #d1d5db;
        background: transparent;
      }
      :host ::ng-deep .e-upload .e-file-drop {
        color: #6b7280;
      }
      :host ::ng-deep .e-upload .e-upload-files {
        border-top: 1px solid #e5e7eb;
      }
      :host ::ng-deep .e-btn.e-block {
        width: 100%;
      }
    `,
  ],
})
export class UploadPage {
  @ViewChild('uploader') uploader!: UploaderComponent;

  private jobsService = inject(JobsService);
  private router = inject(Router);

  dropArea = '.e-upload';
  selectedFile = signal<File | null>(null);
  mode = signal<string>('strict');
  uploading = signal(false);
  error = signal<string | null>(null);

  modeOptions = [
    { text: 'Strict', value: 'strict' },
    { text: 'Best Judgment', value: 'best_judgment' },
  ];

  onFileSelected(args: SelectedEventArgs) {
    if (args.filesData?.length) {
      this.selectedFile.set(args.filesData[0].rawFile as File);
    }
  }

  onFileRemoved(e: unknown) {
    console.log(e);
    this.selectedFile.set(null);
  }

  onModeChange(event: ChangeEventArgs) {
    this.mode.set(event.value as string);
  }

  upload() {
    const file = this.selectedFile();
    if (!file) return;

    this.uploading.set(true);
    this.error.set(null);

    this.jobsService.uploadFile(file, this.mode() as 'strict' | 'best_judgment').subscribe({
      next: (res) => {
        this.router.navigate(['/job', res.jobId]);
      },
      error: (err) => {
        this.uploading.set(false);
        this.error.set(err.error?.error || 'Upload failed');
      },
    });
  }
}
