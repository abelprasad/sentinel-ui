import { Component, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../api';

const SVG_NS = 'http://www.w3.org/2000/svg';
const PATH_COUNT = 36;

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login implements AfterViewInit {
  username = '';
  password = '';
  error = '';
  loading = false;

  constructor(private api: ApiService, private router: Router) {}

  ngAfterViewInit() {
    this.initPaths();
  }

  private initPaths() {
    const posGroup = document.getElementById('paths-pos');
    const negGroup = document.getElementById('paths-neg');
    if (!posGroup || !negGroup) return;

    this.buildGroup(posGroup,  1);
    this.buildGroup(negGroup, -1);

    this.animatePaths();
  }

  private buildGroup(group: HTMLElement, position: number) {
    for (let i = 0; i < PATH_COUNT; i++) {
      const x0  = -(380 - i * 5 * position);
      const y0  = -(189 + i * 6);
      const cx2 = -(312 - i * 5 * position);
      const cy2 =  (216 - i * 6);
      const ex  =  (152 - i * 5 * position);
      const ey  =  (343 - i * 6);
      const cx3 =  (616 - i * 5 * position);
      const cy3 =  (470 - i * 6);
      const ex2 =  (684 - i * 5 * position);
      const ey2 =  (875 - i * 6);

      const d = `M${x0} ${y0}C${x0} ${y0} ${cx2} ${cy2} ${ex} ${ey}C${cx3} ${cy3} ${ex2} ${ey2} ${ex2} ${ey2}`;

      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('stroke', '#F59E0B');
      path.setAttribute('stroke-width', String(0.5 + i * 0.03));
      path.setAttribute('stroke-opacity', String(Math.min(0.1 + i * 0.03, 1)));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke-dasharray', '900');
      path.setAttribute('stroke-dashoffset', String(900 - (i / PATH_COUNT) * 900));

      group.appendChild(path);
    }
  }

  private animatePaths() {
    const paths = document.querySelectorAll<SVGPathElement>('#paths-pos path, #paths-neg path');

    const tick = () => {
      paths.forEach((p, idx) => {
        const i = idx % PATH_COUNT;
        const speed = 0.3 + i * 0.008;
        let offset = parseFloat(p.getAttribute('stroke-dashoffset') ?? '0') - speed;
        if (offset < -900) offset = 900;
        p.setAttribute('stroke-dashoffset', String(offset));
      });
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }

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