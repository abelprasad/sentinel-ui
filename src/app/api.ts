import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AnomalyScore {
  id: number;
  score: number;
  explanation: string;
  flaggedAt: string;
  entity: { id: number; callsign: string; icaoHex: string };
  event: { lat: number; lon: number; altitude: number; speed: number; heading: number };
}

export interface AircraftEntity {
  id: number;
  callsign: string;
  icaoHex: string;
  type: string;
  metadata: string;
}

export interface PositionDTO {
  entityId: number;
  callsign: string;
  icaoHex: string;
  lat: number;
  lon: number;
  altitude: number;
  speed: number;
  heading: number;
  anomalous: boolean;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = 'http://localhost:8080';
  private token = '';

  constructor(private http: HttpClient) {}

  setToken(token: string) {
    this.token = token;
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${this.token}` });
  }

  login(username: string, password: string): Observable<{ token: string }> {
    return this.http.post<{ token: string }>(`${this.base}/auth/login`, { username, password });
  }

  getAnomalies(): Observable<AnomalyScore[]> {
    return this.http.get<AnomalyScore[]>(`${this.base}/anomalies`, { headers: this.headers() });
  }

  getEntities(): Observable<AircraftEntity[]> {
    return this.http.get<AircraftEntity[]>(`${this.base}/entities`, { headers: this.headers() });
  }

  getPositions(): Observable<PositionDTO[]> {
    return this.http.get<PositionDTO[]>(`${this.base}/positions`, { headers: this.headers() });
  }
}