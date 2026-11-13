import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '../../../core/config/app-config.service';
import { Overview } from '../domain/dashboard.models';
import { DashboardRepository } from '../domain/dashboard.repository';

/** Real implementation. The endpoint is a placeholder until the backend module exists. */
@Injectable()
export class ApiDashboardRepository extends DashboardRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  overview(): Observable<Overview> {
    return this.http.get<Overview>(`${this.config.config.api.baseUrl}/dashboard/overview`);
  }
}
