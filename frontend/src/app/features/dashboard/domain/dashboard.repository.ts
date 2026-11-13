import { Observable } from 'rxjs';
import { Overview } from './dashboard.models';

export abstract class DashboardRepository {
  abstract overview(): Observable<Overview>;
}
