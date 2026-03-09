import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Progress } from '../../shared/models/progress.model';
import { StudentBadge } from '../../shared/models/progress.model';
import { Scenario } from '../../shared/models/scenario.model';
import { Student } from '../../shared/models/user.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private api = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getMyProgress(): Observable<Progress[]> {
    return this.http.get<Progress[]>(`${this.api}/progress/my-progress`);
  }

  getMyBadges(): Observable<StudentBadge[]> {
    return this.http.get<StudentBadge[]>(`${this.api}/badges/my-badges`);
  }

  getPopularScenarios(limit = 6): Observable<Scenario[]> {
    return this.http.get<Scenario[]>(`${this.api}/scenarios/popular?limit=${limit}`);
  }

  getTopRatedScenarios(limit = 4): Observable<Scenario[]> {
    return this.http.get<Scenario[]>(`${this.api}/scenarios/top-rated?limit=${limit}`);
  }

  getAllScenarios(): Observable<Scenario[]> {
    return this.http.get<Scenario[]>(`${this.api}/scenarios`);
  }
}
