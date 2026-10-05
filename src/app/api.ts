import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

export interface PublicAnomaly {
  id: number;
  callsign: string;
  icaoHex: string;
  classification: string;
  score: number;
  explanation: string;
  flaggedAt: string;
}

export interface PublicPosition {
  entityId: number;
  callsign: string;
  icaoHex: string;
  lat: number;
  lon: number;
  altitude: number;
  speed: number;
  heading: number;
  anomalous: boolean;
  score: number;
  classification: string;
}

export interface PublicStatus {
  activeTracksNow: number;
  anomaliesLastHour: number;
  totalEntities: number;
  recentAnomalies: PublicAnomaly[];
  positions: PublicPosition[];
}

export interface TrackPoint {
  timestamp: string;
  lat: number;
  lon: number;
  altitude: number;
  speed: number;
  heading: number;
}

export interface IncidentTrack {
  anomalyId: number;
  callsign: string;
  icaoHex: string;
  score: number;
  explanation: string;
  flaggedAt: string;
  triggerLat: number;
  triggerLon: number;
  points: TrackPoint[];
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getPublicStatus(): Observable<PublicStatus> {
    return this.http.get<PublicStatus>(`${this.base}/public/status`);
  }

  getIncidentTrack(anomalyId: number): Observable<IncidentTrack> {
    return this.http.get<IncidentTrack>(`${this.base}/public/track/${anomalyId}`);
  }
}
