import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Scenario, Difficulty, Theme } from '../../shared/models/scenario.model';

@Injectable({ providedIn: 'root' })
export class ScenarioService {
  private api = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Scenario[]> {
    return this.http.get<Scenario[]>(`${this.api}/scenarios`);
  }

  getById(id: string): Observable<Scenario> {
    return this.http.get<Scenario>(`${this.api}/scenarios/${id}`);
  }

  getByDifficulty(difficulty: Difficulty): Observable<Scenario[]> {
    return this.http.get<Scenario[]>(`${this.api}/scenarios/difficulty/${difficulty}`);
  }

  getByTheme(theme: Theme): Observable<Scenario[]> {
    return this.http.get<Scenario[]>(`${this.api}/scenarios/theme/${theme}`);
  }

  search(keyword: string): Observable<Scenario[]> {
    return this.http.get<Scenario[]>(`${this.api}/scenarios/search?keyword=${encodeURIComponent(keyword)}`);
  }

  getPopular(limit = 10): Observable<Scenario[]> {
    return this.http.get<Scenario[]>(`${this.api}/scenarios/popular?limit=${limit}`);
  }

  getTopRated(limit = 10): Observable<Scenario[]> {
    return this.http.get<Scenario[]>(`${this.api}/scenarios/top-rated?limit=${limit}`);
  }

  startScenario(scenarioId: string): Observable<void> {
    return this.http.post<void>(`${this.api}/progress/scenarios/${scenarioId}/start`, {});
  }
}
