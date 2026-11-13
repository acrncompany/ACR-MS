import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../../core/config/app-config.service';
import { Session } from '../../../core/auth/session.service';
import { LoginCredentials } from '../domain/auth.models';
import { AuthRepository } from '../domain/auth.repository';

/** Real implementation. Endpoints are placeholders until the backend auth module exists. */
@Injectable()
export class ApiAuthRepository extends AuthRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  login(credentials: LoginCredentials): Observable<Session> {
    return this.http.post<Session>(`${this.config.config.api.baseUrl}/auth/login`, credentials);
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.config.config.api.baseUrl}/auth/logout`, {});
  }
}
