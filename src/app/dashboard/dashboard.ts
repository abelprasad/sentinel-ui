import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, AnomalyScore, AircraftEntity } from '../api';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit, OnDestroy {
  anomalies: AnomalyScore[] = [];
  entities: AircraftEntity[] = [];
  loading = true;
  private pollInterval: any;

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.api.login('abel', 'sentinel123').subscribe(res => {
      this.api.setToken(res.token);
      this.fetchData();
      this.pollInterval = setInterval(() => this.fetchData(), 10000);
    });
  }

  fetchData() {
    this.api.getAnomalies().subscribe(data => {
      this.anomalies = data.sort((a, b) =>
        new Date(b.flaggedAt).getTime() - new Date(a.flaggedAt).getTime()
      );
      this.loading = false;
      this.cdr.detectChanges();
    });

    this.api.getEntities().subscribe(data => {
      this.entities = data;
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy() {
    clearInterval(this.pollInterval);
  }

  severityClass(score: number): string {
    if (score >= 0.8) return 'high';
    if (score >= 0.5) return 'medium';
    return 'low';
  }
}