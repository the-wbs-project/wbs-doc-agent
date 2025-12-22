import { Injectable, inject } from '@angular/core';
import { Observable, timer } from 'rxjs';
import { retry } from 'rxjs/operators';
import { EnvironmentService } from './environment.service';
import type { JobStatus } from './jobs.service';

@Injectable({ providedIn: 'root' })
export class StatusWsService {
  private envService = inject(EnvironmentService);

  private get wsUrl(): string {
    const apiUrl = this.envService.apiUrl;
    if (!apiUrl) {
      // Local dev - use current host with ws protocol
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.host}`;
    }
    // Production - convert https to wss
    return apiUrl.replace(/^http/, 'ws');
  }

  connect(jobId: string): Observable<JobStatus> {
    return new Observable<JobStatus>((subscriber) => {
      const ws = new WebSocket(`${this.wsUrl}/api/jobs/${jobId}/ws`);

      ws.onopen = () => {
        // Connection established - status will be sent immediately by server
      };

      ws.onmessage = (event) => {
        try {
          const status = JSON.parse(event.data) as JobStatus;
          subscriber.next(status);
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onerror = () => {
        subscriber.error(new Error('WebSocket error'));
      };

      ws.onclose = (event) => {
        if (event.wasClean) {
          subscriber.complete();
        } else {
          subscriber.error(new Error('WebSocket closed unexpectedly'));
        }
      };

      return () => {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      };
    }).pipe(
      retry({
        count: 5,
        delay: (_, retryCount) => timer(Math.min(1000 * Math.pow(2, retryCount - 1), 10000)),
      })
    );
  }
}

