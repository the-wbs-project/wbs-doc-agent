import { JsonPipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from '@syncfusion/ej2-angular-buttons';
import { catchError, interval, of, switchMap, takeWhile, tap } from 'rxjs';
import { JobResult, JobsService, JobStatus } from '../../services/jobs.service';

@Component({
  selector: 'app-job',
  imports: [JsonPipe, ButtonModule],
  template: `
    <div class="min-h-screen bg-gray-50 text-gray-900 p-4">
      <div class="max-w-4xl mx-auto">
        <button ejs-button cssClass="e-flat" iconCss="e-icons e-chevron-left" (click)="goBack()">
          Back
        </button>

        <h1 class="text-2xl font-semibold mb-2 mt-4">Job Status</h1>
        <p class="text-gray-500 text-sm mb-6 font-mono">{{ jobId() }}</p>

        @if (status()) {
          <div class="bg-white rounded-lg p-6 mb-6 shadow-sm border border-gray-200">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div>
                <p class="text-gray-500 text-xs uppercase">State</p>
                <p class="font-medium" [class]="stateColor(status()!.state)">
                  {{ status()!.state }}
                </p>
              </div>
              <div>
                <p class="text-gray-500 text-xs uppercase">Step</p>
                <p class="font-medium">{{ status()!.step }}</p>
              </div>
              <div>
                <p class="text-gray-500 text-xs uppercase">Progress</p>
                <p class="font-medium">{{ status()!.percent }}%</p>
              </div>
              <div>
                <p class="text-gray-500 text-xs uppercase">Updated</p>
                <p class="font-medium text-sm">{{ formatTime(status()!.updatedAt) }}</p>
              </div>
            </div>

            <div class="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                class="h-2 rounded-full transition-all duration-500"
                [class]="progressBarColor()"
                [style.width.%]="status()!.percent"
              ></div>
            </div>
          </div>

          @if (status()!.errors.length > 0) {
            <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <h3 class="text-red-600 font-medium mb-2">Errors</h3>
              <ul class="space-y-2 text-sm">
                @for (err of status()!.errors; track err.ts) {
                  <li class="text-red-700">
                    <span class="text-red-500">{{ formatTime(err.ts) }}</span>
                    {{ err.msg }}
                  </li>
                }
              </ul>
            </div>
          }

          <div class="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <h3 class="text-gray-600 font-medium mb-3">Messages</h3>
            <div class="space-y-1 text-sm font-mono max-h-80 overflow-y-auto">
              @for (msg of status()!.messages; track msg.ts) {
                <div class="flex gap-2">
                  <span class="text-gray-400 shrink-0">{{ formatTime(msg.ts) }}</span>
                  <span [class]="levelColor(msg.level)">{{ msg.msg }}</span>
                </div>
              }
            </div>
          </div>
        } @else if (error()) {
          <div class="bg-red-50 border border-red-200 rounded-lg p-4">
            <p class="text-red-600">{{ error() }}</p>
          </div>
        } @else {
          <div class="flex items-center justify-center py-12">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          </div>
        }

        @if (result()) {
          <div class="mt-6 bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <h3 class="text-gray-600 font-medium mb-3">Result</h3>
            @if (result()!.summary) {
              <div class="mb-4">
                <p class="text-gray-500 text-xs uppercase mb-1">Summary</p>
                <p class="text-gray-800">{{ result()!.summary }}</p>
              </div>
            }
            <div class="grid grid-cols-3 gap-4 mb-4">
              <div>
                <p class="text-gray-500 text-xs uppercase">Nodes</p>
                <p class="text-xl font-semibold">{{ result()!.qc.nodeCount }}</p>
              </div>
              <div>
                <p class="text-gray-500 text-xs uppercase">Inferred</p>
                <p class="text-xl font-semibold">{{ result()!.qc.inferredCount }}</p>
              </div>
              <div>
                <p class="text-gray-500 text-xs uppercase">Coverage</p>
                <p class="text-xl font-semibold">{{ (result()!.qc.coverageRatio * 100).toFixed(1) }}%</p>
              </div>
            </div>
            <details class="mt-4">
              <summary class="cursor-pointer text-gray-500 hover:text-gray-700">Raw Result JSON</summary>
              <pre class="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto max-h-96">{{ result() | json }}</pre>
            </details>
          </div>
        }
      </div>
    </div>
  `,
})
export class JobPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private jobsService = inject(JobsService);
  private destroyRef = inject(DestroyRef);

  jobId = signal<string>('');
  status = signal<JobStatus | null>(null);
  result = signal<JobResult | null>(null);
  error = signal<string | null>(null);

  progressBarColor(): string {
    const state = this.status()?.state;
    if (state === 'completed') return 'bg-emerald-500';
    if (state === 'failed') return 'bg-red-500';
    return 'bg-amber-500';
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/']);
      return;
    }
    this.jobId.set(id);
    this.startPolling();
  }

  private startPolling() {
    interval(2000)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(() => this.jobsService.getStatus(this.jobId())),
        tap((status) => this.status.set(status)),
        takeWhile((status) => status.state !== 'completed' && status.state !== 'failed', true),
        catchError((err) => {
          this.error.set(err.error?.error || 'Failed to fetch status');
          return of(null);
        })
      )
      .subscribe({
        complete: () => {
          if (this.status()?.state === 'completed') {
            this.fetchResult();
          }
        },
      });

    // Initial fetch
    this.jobsService.getStatus(this.jobId()).subscribe({
      next: (status) => this.status.set(status),
      error: (err) => this.error.set(err.error?.error || 'Failed to fetch status'),
    });
  }

  private fetchResult() {
    this.jobsService.getResult(this.jobId()).subscribe({
      next: (result) => this.result.set(result),
      error: () => { }, // ignore - result might not be ready yet
    });
  }

  goBack() {
    this.router.navigate(['/']);
  }

  stateColor(state: string): string {
    switch (state) {
      case 'completed':
        return 'text-emerald-600';
      case 'failed':
        return 'text-red-600';
      case 'running':
        return 'text-amber-600';
      default:
        return 'text-gray-600';
    }
  }

  levelColor(level: string): string {
    switch (level) {
      case 'error':
        return 'text-red-600';
      case 'warn':
        return 'text-amber-600';
      default:
        return 'text-gray-700';
    }
  }

  formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString();
  }
}
