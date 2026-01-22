import { Injectable, signal } from '@angular/core';

export type ApiEnvironment = 'local' | 'production';

const STORAGE_KEY = 'wbs-api-environment';

const API_URLS: Record<ApiEnvironment, string> = {
  local: '', // Empty string uses relative URLs (works with proxy in dev)
  production: 'https://wbs-worker2.thewbsproject.workers.dev',
};

@Injectable({ providedIn: 'root' })
export class EnvironmentService {
  private _environment = signal<ApiEnvironment>(this.loadFromStorage());

  readonly environment = this._environment.asReadonly();

  get apiUrl(): string {
    return API_URLS[this._environment()];
  }

  setEnvironment(env: ApiEnvironment): void {
    this._environment.set(env);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, env);
    }
  }

  private loadFromStorage(): ApiEnvironment {
    if (typeof localStorage === 'undefined') {
      return 'local';
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'local' || stored === 'production') {
      return stored;
    }
    return 'local';
  }
}
