import { Component, OnInit, OnDestroy, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ApiService, AnomalyScore, AircraftEntity, PositionDTO } from '../api';
import * as L from 'leaflet';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit, OnDestroy, AfterViewInit {
  anomalies: AnomalyScore[] = [];
  entities: AircraftEntity[] = [];
  positions: PositionDTO[] = [];
  loading = true;
  countdown = 30;

  selectedEntity: PositionDTO | null = null;
  selectedAnomalies: AnomalyScore[] = [];
  detailLoading = false;

  // simulation panel
  simPanelOpen = false;
  simLoading = false;
  simResult: string | null = null;
  simAltitude = 42000;
  simSpeed = 550;
  simHeading = 180;
  simEntityId: number | null = null;

  private map!: L.Map;
  private markers: Map<number, { marker: L.Marker; anomalous: boolean }> = new Map();
  private pollInterval: any;
  private positionInterval: any;
  private countdownInterval: any;

  constructor(private api: ApiService, private cdr: ChangeDetectorRef, private router: Router) {}

  ngOnInit() {
    const token = localStorage.getItem('sentinel_token');
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }

    this.api.setToken(token);
    this.fetchData();
    this.pollInterval = setInterval(() => this.fetchData(), 10000);
    this.positionInterval = setInterval(() => {
      this.fetchPositions();
      this.countdown = 30;
    }, 30000);
    this.countdownInterval = setInterval(() => {
      this.countdown = Math.max(0, this.countdown - 1);
      this.cdr.detectChanges();
    }, 1000);
  }

  ngAfterViewInit() {
    setTimeout(() => {
      const el = document.getElementById('map')!;
      this.map = L.map(el, {
        center: [40.05, -75.2],
        zoom: 10,
        zoomControl: false
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19
      }).addTo(this.map);

      L.control.zoom({ position: 'bottomright' }).addTo(this.map);

      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
        this.map.invalidateSize(true);
        this.fetchPositions();
      }, 500);
    }, 300);
  }

  fetchData() {
    this.api.getAnomalies().subscribe({
      next: data => {
        const sorted = data.sort((a, b) =>
          new Date(b.flaggedAt).getTime() - new Date(a.flaggedAt).getTime()
        );
        this.anomalies = sorted.slice(0, 100);
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        if (err.status === 401 || err.status === 403) {
          localStorage.removeItem('sentinel_token');
          this.router.navigate(['/login']);
        }
      }
    });

    this.api.getEntities().subscribe(data => {
      this.entities = data;
      this.cdr.detectChanges();
    });
  }

  fetchPositions() {
    this.api.getPositions().subscribe(data => {
      this.positions = data;
      this.updateMarkers(data);
    });
  }

  selectEntity(position: PositionDTO) {
    this.selectedEntity = position;
    this.selectedAnomalies = [];
    this.detailLoading = true;
    this.cdr.detectChanges();

    this.api.getEntityAnomalies(position.entityId).subscribe({
      next: data => {
        this.selectedAnomalies = data.slice(0, 20);
        this.detailLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.detailLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  closeDetail() {
    this.selectedEntity = null;
    this.selectedAnomalies = [];
    this.cdr.detectChanges();
  }

  // simulation panel
  toggleSimPanel() {
    this.simPanelOpen = !this.simPanelOpen;
    this.simResult = null;
  }

  quickFire() {
    this.simLoading = true;
    this.simResult = null;
    this.cdr.detectChanges();

    this.api.simulateQuick().subscribe({
      next: (anomaly) => {
        this.simLoading = false;
        this.simResult = anomaly
          ? `Injected: ${anomaly.entity.callsign} — score ${(anomaly.score * 100).toFixed(0)}%`
          : 'No entity with baseline found';
        this.fetchData();
        this.cdr.detectChanges();
      },
      error: () => {
        this.simLoading = false;
        this.simResult = 'Injection failed — check logs';
        this.cdr.detectChanges();
      }
    });
  }

  injectCustom() {
    if (!this.simEntityId) {
      this.simResult = 'Select an entity first';
      return;
    }
    this.simLoading = true;
    this.simResult = null;
    this.cdr.detectChanges();

    this.api.simulateCustom(
      this.simEntityId,
      this.simAltitude,
      this.simSpeed,
      this.simHeading
    ).subscribe({
      next: (anomaly) => {
        this.simLoading = false;
        this.simResult = anomaly
          ? `Injected: ${anomaly.entity.callsign} — score ${(anomaly.score * 100).toFixed(0)}%`
          : 'Score below threshold — try more extreme values';
        this.fetchData();
        this.cdr.detectChanges();
      },
      error: () => {
        this.simLoading = false;
        this.simResult = 'Injection failed — check logs';
        this.cdr.detectChanges();
      }
    });
  }

  private makePlaneIcon(heading: number, anomalous: boolean): L.DivIcon {
    const color = anomalous ? '#e05252' : '#cdd9e5';
    const glow = anomalous ? `filter: drop-shadow(0 0 4px rgba(224,82,82,0.8));` : '';
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"
           style="transform: rotate(${heading}deg); ${glow}">
        <polygon points="10,1 13,14 10,12 7,14" fill="${color}" opacity="0.95"/>
        <polygon points="5,8 15,8 13,11 7,11" fill="${color}" opacity="0.7"/>
        <polygon points="8,12 12,12 11,16 9,16" fill="${color}" opacity="0.6"/>
      </svg>`;
    return L.divIcon({
      className: '',
      html: svg,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
  }

  updateMarkers(positions: PositionDTO[]) {
    if (!this.map) return;

    const seen = new Set<number>();

    positions.forEach(p => {
      if (p.lat == null || p.lon == null) return;
      seen.add(p.entityId);

      const existing = this.markers.get(p.entityId);

      if (existing) {
        existing.marker.setLatLng([p.lat, p.lon]);
        if (existing.anomalous !== p.anomalous) {
          existing.marker.setIcon(this.makePlaneIcon(p.heading ?? 0, p.anomalous));
          existing.anomalous = p.anomalous;
        }
      } else {
        const marker = L.marker([p.lat, p.lon], {
          icon: this.makePlaneIcon(p.heading ?? 0, p.anomalous)
        })
          .bindTooltip(`
            <div class="marker-tooltip-inner">
              <div class="tt-callsign">${p.callsign || p.icaoHex}</div>
              <div class="tt-row">${p.altitude?.toLocaleString() ?? '--'} ft &nbsp; ${p.speed?.toFixed(0) ?? '--'} kts &nbsp; ${p.heading?.toFixed(0) ?? '--'}°</div>
              ${p.anomalous ? '<div class="tt-anomalous">ANOMALOUS</div>' : ''}
            </div>
          `, { permanent: false, className: 'marker-tooltip', direction: 'top', offset: [0, -10] })
          .on('click', () => this.selectEntity(p))
          .addTo(this.map);
        this.markers.set(p.entityId, { marker, anomalous: p.anomalous });
      }
    });

    this.markers.forEach((entry, id) => {
      if (!seen.has(id)) {
        entry.marker.remove();
        this.markers.delete(id);
      }
    });
  }

  ngOnDestroy() {
    clearInterval(this.pollInterval);
    clearInterval(this.positionInterval);
    clearInterval(this.countdownInterval);
    if (this.map) this.map.remove();
  }

  severityClass(score: number): string {
    if (score >= 0.8) return 'high';
    if (score >= 0.5) return 'medium';
    return 'low';
  }

  get visibleAnomalyCount(): number {
    return this.anomalies.length;
  }

  logout() {
    localStorage.removeItem('sentinel_token');
    this.router.navigate(['/login']);
  }
}