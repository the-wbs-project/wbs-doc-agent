import { Component, inject, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule, CheckBoxModule, RadioButtonModule } from '@syncfusion/ej2-angular-buttons';
import type { ChangeArgs, ChangeEventArgs as CheckboxChangeEventArgs } from '@syncfusion/ej2-angular-buttons';
import { DropDownListModule } from '@syncfusion/ej2-angular-dropdowns';
import { TextBoxModule } from '@syncfusion/ej2-angular-inputs';
import { UploaderModule } from '@syncfusion/ej2-angular-inputs';
import type { SelectedEventArgs, UploaderComponent } from '@syncfusion/ej2-angular-inputs';
import type { ChangeEventArgs } from '@syncfusion/ej2-angular-dropdowns';
import { EnvironmentService, type ApiEnvironment } from '../../services/environment.service';
import { JobsService } from '../../services/jobs.service';

@Component({
  selector: 'app-upload',
  imports: [UploaderModule, DropDownListModule, ButtonModule, RadioButtonModule, CheckBoxModule, TextBoxModule, FormsModule],
  template: `
    <div class="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center p-4">
      <div class="w-full max-w-lg">
        <h1 class="text-2xl font-semibold mb-6 text-center">WBS Document Agent</h1>

        <div class="bg-white rounded-lg p-6 shadow-sm border border-gray-200 mb-4">
          <label class="block text-sm text-gray-600 mb-3">API Environment</label>
          <div class="flex gap-6">
            <ejs-radiobutton
              label="Local"
              name="environment"
              value="local"
              [checked]="envService.environment() === 'local'"
              (change)="onEnvironmentChange($event)"
            ></ejs-radiobutton>
            <ejs-radiobutton
              label="Production"
              name="environment"
              value="production"
              [checked]="envService.environment() === 'production'"
              (change)="onEnvironmentChange($event)"
            ></ejs-radiobutton>
          </div>
        </div>

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
            <ejs-checkbox
              label="Skip Cache"
              [checked]="skipCache()"
              (change)="onSkipCacheChange($event)"
            ></ejs-checkbox>
          </div>

          <div class="mt-6">
            <label class="block text-sm text-gray-600 mb-2">Context for Model (optional)</label>
            <textarea
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
              rows="4"
              placeholder="Provide any helpful context about this document... (e.g., document type, specific instructions, terminology hints)"
              [(ngModel)]="userContext"
            ></textarea>
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

  envService = inject(EnvironmentService);
  private jobsService = inject(JobsService);
  private router = inject(Router);

  dropArea = '.e-upload';
  selectedFile = signal<File | null>(null);
  mode = signal<string>('strict');
  skipCache = signal(false);
  userContext = '';
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

  onEnvironmentChange(event: ChangeArgs) {
    if (event.value) {
      this.envService.setEnvironment(event.value as ApiEnvironment);
    }
  }

  onSkipCacheChange(event: CheckboxChangeEventArgs) {
    this.skipCache.set(event.checked ?? false);
  }

  upload() {
    const file = this.selectedFile();
    if (!file) return;

    this.uploading.set(true);
    this.error.set(null);

    const options: { skipCache?: boolean; userContext?: string } = { skipCache: this.skipCache() };
    if (this.userContext.trim()) {
      options.userContext = this.userContext.trim();
    }

    this.jobsService.uploadFile(file, this.mode() as 'strict' | 'best_judgment', options).subscribe({
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
