import { Component, OnInit, OnDestroy, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, AnomalyScore, AircraftEntity, PositionDTO } from '../api';
import * as L from 'leaflet';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit, OnDestroy, AfterViewInit {
  anomalies: AnomalyScore[] = [];
  entities: AircraftEntity[] = [];
  positions: PositionDTO[] = [];
  loading = true;

  private map!: L.Map;
  private markers: Map<number, L.Marker> = new Map();
  private pollInterval: any;
  private positionInterval: any;

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.api.login('abel', 'sentinel123').subscribe(res => {
      this.api.setToken(res.token);
      this.fetchData();
      this.pollInterval = setInterval(() => this.fetchData(), 10000);
      this.positionInterval = setInterval(() => this.fetchPositions(), 30000);
    });
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

  fetchPositions() {
    this.api.getPositions().subscribe(data => {
      this.positions = data;
      this.updateMarkers(data);
    });
  }

  updateMarkers(positions: PositionDTO[]) {
    if (!this.map) return;

    const seen = new Set<number>();

    positions.forEach(p => {
      if (p.lat == null || p.lon == null) return;
      seen.add(p.entityId);

      const icon = L.divIcon({
        className: '',
        html: `<div class="aircraft-marker ${p.anomalous ? 'anomalous' : ''}"></div>`,
        iconSize: [10, 10],
        iconAnchor: [5, 5]
      });

      if (this.markers.has(p.entityId)) {
        const marker = this.markers.get(p.entityId)!;
        marker.setLatLng([p.lat, p.lon]);
        marker.setIcon(icon);
      } else {
        const marker = L.marker([p.lat, p.lon], { icon })
          .bindTooltip(p.callsign, { permanent: false, className: 'marker-tooltip' })
          .addTo(this.map);
        this.markers.set(p.entityId, marker);
      }
    });

    this.markers.forEach((marker, id) => {
      if (!seen.has(id)) {
        marker.remove();
        this.markers.delete(id);
      }
    });
  }

  ngOnDestroy() {
    clearInterval(this.pollInterval);
    clearInterval(this.positionInterval);
    if (this.map) this.map.remove();
  }

  severityClass(score: number): string {
    if (score >= 0.8) return 'high';
    if (score >= 0.5) return 'medium';
    return 'low';
  }
}