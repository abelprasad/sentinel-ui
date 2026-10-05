import { Component, OnInit, OnDestroy, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, PublicStatus, PublicAnomaly, PublicPosition, IncidentTrack } from '../api';
import * as L from 'leaflet';

type LoadState = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit, OnDestroy, AfterViewInit {
  state: LoadState = 'loading';
  errorMsg = '';
  status: PublicStatus | null = null;
  showHowItWorks = false;

  // Replay state
  replayTrack: IncidentTrack | null = null;
  replayIndex = 0;
  replayPlaying = false;
  replayLoading = false;
  private replayTimer: any = null;
  private replayLine: L.Polyline | null = null;
  private replayMarker: L.Marker | null = null;
  private replayTriggerMarker: L.CircleMarker | null = null;

  private map!: L.Map;
  private markers: Map<number, L.Marker> = new Map();
  private pollInterval: any;

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.refresh();
    this.pollInterval = setInterval(() => this.refresh(), 30000);
  }

  ngAfterViewInit() {
    setTimeout(() => {
      const el = document.getElementById('map')!;
      this.map = L.map(el, { center: [40.05, -75.2], zoom: 10, zoomControl: false });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(this.map);
      L.control.zoom({ position: 'bottomright' }).addTo(this.map);
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
        this.map.invalidateSize(true);
        if (this.status) this.updateMarkers(this.status.positions);
      }, 500);
    }, 300);
  }

  refresh() {
    this.api.getPublicStatus().subscribe({
      next: (data) => {
        this.status = data;
        this.state = 'ready';
        if (this.map && !this.replayTrack) this.updateMarkers(data.positions);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.state = 'error';
        this.errorMsg = err?.message || 'Could not reach the Sentinel backend.';
        this.cdr.detectChanges();
      }
    });
  }

  retry() {
    this.state = 'loading';
    this.refresh();
  }

  updateMarkers(positions: PublicPosition[]) {
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
        const m = this.markers.get(p.entityId)!;
        m.setLatLng([p.lat, p.lon]);
        m.setIcon(icon);
      } else {
        const m = L.marker([p.lat, p.lon], { icon })
          .bindTooltip(`${p.callsign} · ${Math.round(p.altitude || 0)} ft`, { className: 'marker-tooltip' })
          .addTo(this.map);
        this.markers.set(p.entityId, m);
      }
    });
    this.markers.forEach((m, id) => {
      if (!seen.has(id)) { m.remove(); this.markers.delete(id); }
    });
  }

  // ---- Replay ----
  startReplay(anomaly: PublicAnomaly) {
    this.replayLoading = true;
    this.cdr.detectChanges();
    this.api.getIncidentTrack(anomaly.id).subscribe({
      next: (track) => {
        this.replayLoading = false;
        if (!track.points || track.points.length === 0) {
          this.errorMsg = 'No historical track available for this incident.';
          this.cdr.detectChanges();
          return;
        }
        this.replayTrack = track;
        this.replayIndex = 0;
        this.drawReplay();
        this.playReplay();
        this.cdr.detectChanges();
      },
      error: () => {
        this.replayLoading = false;
        this.errorMsg = 'Could not load the incident replay.';
        this.cdr.detectChanges();
      }
    });
  }

  drawReplay() {
    if (!this.map || !this.replayTrack) return;
    this.clearReplayLayers();
    const pts = this.replayTrack.points
      .filter(p => p.lat != null && p.lon != null)
      .map(p => [p.lat, p.lon] as [number, number]);
    if (pts.length === 0) return;
    this.replayLine = L.polyline(pts, { color: '#ff5a5a', weight: 2, opacity: 0.6 }).addTo(this.map);
    if (this.replayTrack.triggerLat != null) {
      this.replayTriggerMarker = L.circleMarker(
        [this.replayTrack.triggerLat, this.replayTrack.triggerLon],
        { radius: 8, color: '#ff5a5a', weight: 2, fillOpacity: 0.3 }
      ).addTo(this.map);
    }
    this.map.fitBounds(this.replayLine.getBounds().pad(0.2));
    this.updateReplayMarker();
  }

  updateReplayMarker() {
    if (!this.map || !this.replayTrack) return;
    const p = this.replayTrack.points[this.replayIndex];
    if (!p || p.lat == null) return;
    if (this.replayMarker) this.replayMarker.remove();
    this.replayMarker = L.marker([p.lat, p.lon], {
      icon: L.divIcon({
        className: '',
        html: '<div class="replay-plane"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      })
    }).addTo(this.map);
  }

  playReplay() {
    this.stopReplayTimer();
    this.replayPlaying = true;
    this.replayTimer = setInterval(() => {
      if (!this.replayTrack) return;
      if (this.replayIndex >= this.replayTrack.points.length - 1) {
        this.pauseReplay();
        return;
      }
      this.replayIndex++;
      this.updateReplayMarker();
      this.cdr.detectChanges();
    }, 400);
  }

  pauseReplay() {
    this.replayPlaying = false;
    this.stopReplayTimer();
    this.cdr.detectChanges();
  }

  toggleReplay() {
    if (this.replayPlaying) this.pauseReplay();
    else this.playReplay();
  }

  seekReplay(index: number) {
    this.replayIndex = index;
    this.updateReplayMarker();
    this.cdr.detectChanges();
  }

  exitReplay() {
    this.pauseReplay();
    this.replayTrack = null;
    this.replayIndex = 0;
    this.clearReplayLayers();
    if (this.status) this.updateMarkers(this.status.positions);
    this.map.setView([40.05, -75.2], 10);
    this.cdr.detectChanges();
  }

  private stopReplayTimer() {
    if (this.replayTimer) { clearInterval(this.replayTimer); this.replayTimer = null; }
  }

  private clearReplayLayers() {
    if (this.replayLine) { this.replayLine.remove(); this.replayLine = null; }
    if (this.replayMarker) { this.replayMarker.remove(); this.replayMarker = null; }
    if (this.replayTriggerMarker) { this.replayTriggerMarker.remove(); this.replayTriggerMarker = null; }
  }

  severityClass(score: number): string {
    if (score >= 0.8) return 'high';
    if (score >= 0.5) return 'medium';
    return 'low';
  }

  formatTime(iso: string): string {
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  }

  ngOnDestroy() {
    clearInterval(this.pollInterval);
    this.stopReplayTimer();
    if (this.map) this.map.remove();
  }
}
