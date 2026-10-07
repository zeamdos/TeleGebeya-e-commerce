import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';
import { provideAnimationsAsync } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideNgxTranslate } from './shared/pipes/translate.config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(appRoutes),
    provideAnimationsAsync(),
    provideHttpClient(),
    ...provideNgxTranslate(),
  ],
};
