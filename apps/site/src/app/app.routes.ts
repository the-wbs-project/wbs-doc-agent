import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/upload/upload.page').then((m) => m.UploadPage),
  },
  {
    path: 'job/:id',
    loadComponent: () => import('./pages/job/job.page').then((m) => m.JobPage),
  },
];
