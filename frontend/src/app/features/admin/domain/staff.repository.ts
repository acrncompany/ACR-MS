import { Observable } from 'rxjs';
import { Page, PageQuery } from '../../../core/http/page';
import { AssignableStaff, NewStaffInput, StaffInput, StaffMember } from './admin.models';

export interface StaffQuery extends PageQuery {
  /** null = both active and inactive. */
  active: boolean | null;
}

export interface CreatedStaff {
  user: StaffMember;
  /** Present only when the server generated a temporary password. Shown ONCE; never stored. */
  temporaryPassword: string | null;
}

/**
 * Staff (users). Search and paging happen on the server. The server enforces visibility (own
 * subtree, or everyone for Board/GM), who may manage whom, and the delete-only-without-history
 * rule: a delete answers 409 with a message when the person has history.
 */
export abstract class StaffRepository {
  abstract list(query: StaffQuery): Observable<Page<StaffMember>>;
  abstract get(id: string): Observable<StaffMember>;
  /** Active people the caller may pick (manager dropdown). Deactivated people never appear. */
  abstract assignable(): Observable<AssignableStaff[]>;
  /** Positions the caller may create people in. */
  abstract creatablePositionIds(): Observable<string[]>;
  /** Preview of the employee code the next create will get (not reserved). */
  abstract nextCode(): Observable<string>;
  abstract create(input: NewStaffInput): Observable<CreatedStaff>;
  abstract update(id: string, input: Partial<StaffInput>): Observable<StaffMember>;
  abstract setActive(id: string, active: boolean): Observable<void>;
  abstract delete(id: string): Observable<void>;
}
