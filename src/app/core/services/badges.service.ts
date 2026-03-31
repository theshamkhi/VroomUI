import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Badge, StudentBadge } from '../../shared/models/progress.model';

@Injectable({ providedIn: 'root' })
export class BadgesService {
  private api = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getBadgesCatalog(): Observable<Badge[]> {
    return this.http.get<Badge[]>(`${this.api}/badges`);
  }

  getMyBadges(): Observable<StudentBadge[]> {
    return this.http.get<StudentBadge[]>(`${this.api}/badges/my-badges`);
  }

  getBadgesForStudent(studentId: string): Observable<StudentBadge[]> {
    return this.http.get<StudentBadge[]>(`${this.api}/badges/student/${studentId}`);
  }
}
