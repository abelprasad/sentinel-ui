import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../api';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {
  username = '';
  password = '';
  error = '';
  loading = false;

  constructor(private api: ApiService, private router: Router) {}

  submit() {
    if (!this.username || !this.password) return;
    this.loading = true;
    this.error = '';

    this.api.login(this.username, this.password).subscribe({
      next: (res) => {
        localStorage.setItem('sentinel_token', res.token);
        this.api.setToken(res.token);
        this.router.navigate(['/']);
      },
      error: () => {
        this.error = 'Invalid credentials';
        this.loading = false;
      }
    });
  }
}