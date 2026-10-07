import { Routes } from '@angular/router';

export const appRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/notebooks/components/notebook-list/notebook-list.component')
      .then(m => m.NotebookListComponent),
  },
  {
    path: 'notebooks/:id',
    loadComponent: () => import('./features/editor/components/editor-page/editor-page.component')
      .then(m => m.EditorPageComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
