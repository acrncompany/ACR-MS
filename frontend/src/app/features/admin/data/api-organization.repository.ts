import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { AppConfigService } from '../../../core/config/app-config.service';
import { Department, Position, Role } from '../domain/admin.models';
import {
  DepartmentInput,
  OrganizationRepository,
  PositionInput,
} from '../domain/organization.repository';

/** The API names a position's title `name` and its parent `parentId`. */
interface ApiPosition extends Omit<Position, 'title'> {
  name: string;
}

const toPosition = ({ name, ...rest }: ApiPosition): Position => ({ ...rest, title: name });

@Injectable()
export class ApiOrganizationRepository extends OrganizationRepository {
  private readonly http = inject(HttpClient);
  private readonly base = inject(AppConfigService).config.api.baseUrl;

  departments(): Observable<Department[]> {
    return this.http
      .get<{ items: Department[] }>(`${this.base}/departments`)
      .pipe(map((r) => r.items));
  }

  positions(): Observable<Position[]> {
    return this.http
      .get<{ items: ApiPosition[] }>(`${this.base}/positions`)
      .pipe(map((r) => r.items.map(toPosition)));
  }

  roles(): Observable<Role[]> {
    return this.http.get<{ items: Role[] }>(`${this.base}/roles`).pipe(map((r) => r.items));
  }

  addDepartment(input: DepartmentInput & { code: string }): Observable<Department> {
    return this.http.post<Department>(`${this.base}/departments`, input);
  }

  updateDepartment(id: string, input: DepartmentInput): Observable<Department> {
    return this.http.patch<Department>(`${this.base}/departments/${id}`, input);
  }

  addPosition(input: PositionInput & { code: string }): Observable<Position> {
    const { title, ...rest } = input;
    return this.http
      .post<ApiPosition>(`${this.base}/positions`, { ...rest, name: title })
      .pipe(map(toPosition));
  }

  updatePosition(id: string, input: PositionInput): Observable<Position> {
    const { title, ...rest } = input;
    return this.http
      .patch<ApiPosition>(`${this.base}/positions/${id}`, { ...rest, name: title })
      .pipe(map(toPosition));
  }
}
