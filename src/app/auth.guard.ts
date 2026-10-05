import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { ApiService } from './api';

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const api = inject(ApiService);

  const token = localStorage.getItem('sentinel_token');
  if (token) {
    api.setToken(token);
    return true;
  }

  router.navigate(['/login']);
  return false;
};