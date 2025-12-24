import { NgTemplateOutlet } from '@angular/common';
import { Component, input, signal } from '@angular/core';

@Component({
  selector: 'app-json-tree',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `
    <div class="flex gap-2 mb-2">
      <button
        class="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 text-gray-600"
        (click)="expandAll()"
      >
        Expand All
      </button>
      <button
        class="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 text-gray-600"
        (click)="collapseAll()"
      >
        Collapse All
      </button>
    </div>
    <div class="font-mono text-xs">
      <ng-container *ngTemplateOutlet="nodeTemplate; context: { $implicit: data(), path: '', depth: 0 }"></ng-container>
    </div>

    <ng-template #nodeTemplate let-value let-path="path" let-depth="depth">
      @if (isObject(value) || isArray(value)) {
        @let keys = objectKeys(value);
        @let collapsed = isCollapsed(path);
        <span
          class="cursor-pointer select-none hover:bg-gray-200 rounded px-0.5 -mx-0.5"
          (click)="toggle(path)"
        >
          <span class="text-gray-400">{{ collapsed ? '▶' : '▼' }}</span>
          <span class="text-purple-600">{{ isArray(value) ? '[' : '{' }}</span>
          @if (collapsed) {
            <span class="text-gray-400 italic">{{ keys.length }} {{ isArray(value) ? 'items' : 'keys' }}</span>
            <span class="text-purple-600">{{ isArray(value) ? ']' : '}' }}</span>
          }
        </span>
        @if (!collapsed) {
          <div [style.padding-left.px]="16">
            @for (key of keys; track key; let last = $last) {
              <div class="flex">
                @if (!isArray(value)) {
                  <span class="text-emerald-600 shrink-0">"{{ key }}"</span>
                  <span class="text-gray-500 mr-1">:</span>
                }
                <div class="flex-1 min-w-0">
                  <ng-container *ngTemplateOutlet="nodeTemplate; context: { $implicit: getValue(value, key), path: path + '/' + key, depth: depth + 1 }"></ng-container>
                  @if (!last) {
                    <span class="text-gray-500">,</span>
                  }
                </div>
              </div>
            }
          </div>
          <span class="text-purple-600">{{ isArray(value) ? ']' : '}' }}</span>
        }
      } @else if (value === null) {
        <span class="text-gray-400">null</span>
      } @else if (typeof value === 'string') {
        <span class="text-amber-600 break-all">"{{ value }}"</span>
      } @else if (typeof value === 'number') {
        <span class="text-blue-600">{{ value }}</span>
      } @else if (typeof value === 'boolean') {
        <span class="text-pink-600">{{ value }}</span>
      } @else {
        <span class="text-gray-600">{{ value }}</span>
      }
    </ng-template>
  `,
})
export class JsonTreeComponent {
  data = input.required<unknown>();
  initialDepth = input<number>(1);

  private collapsedPaths = signal<Set<string>>(new Set());

  isObject(val: unknown): val is Record<string, unknown> {
    return val !== null && typeof val === 'object' && !Array.isArray(val);
  }

  isArray(val: unknown): val is unknown[] {
    return Array.isArray(val);
  }

  objectKeys(val: unknown): string[] {
    if (this.isArray(val)) {
      return val.map((_, i) => String(i));
    }
    if (this.isObject(val)) {
      return Object.keys(val);
    }
    return [];
  }

  getValue(val: unknown, key: string): unknown {
    if (this.isArray(val)) {
      return val[Number(key)];
    }
    if (this.isObject(val)) {
      return val[key];
    }
    return undefined;
  }

  isCollapsed(path: string): boolean {
    return this.collapsedPaths().has(path);
  }

  toggle(path: string): void {
    this.collapsedPaths.update((set) => {
      const newSet = new Set(set);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  }

  expandAll(): void {
    this.collapsedPaths.set(new Set());
  }

  collapseAll(): void {
    const paths = this.collectAllPaths(this.data(), '');
    this.collapsedPaths.set(new Set(paths));
  }

  private collectAllPaths(val: unknown, path: string): string[] {
    const paths: string[] = [];
    if (this.isObject(val) || this.isArray(val)) {
      paths.push(path);
      const keys = this.objectKeys(val);
      for (const key of keys) {
        paths.push(...this.collectAllPaths((val as Record<string, unknown>)[key], `${path}/${key}`));
      }
    }
    return paths;
  }
}

