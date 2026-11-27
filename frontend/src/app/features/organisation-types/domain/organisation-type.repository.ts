import { Observable } from 'rxjs';
import { Page, PageQuery } from '../../../core/http/page';
import { OrganisationTypeEntry, OrganisationTypeInput } from './organisation-type.models';

export abstract class OrganisationTypeRepository {
  /** One page of the master. Search (name, code) and paging happen on the server. */
  abstract list(query: PageQuery): Observable<Page<OrganisationTypeEntry>>;
  /** Preview of the code the next create will get (not reserved: the server issues it on save). */
  abstract nextCode(): Observable<string>;
  /** The server issues the code in the same transaction as the insert. */
  abstract create(input: OrganisationTypeInput): Observable<OrganisationTypeEntry>;
  /** Renames only: the code is permanent. */
  abstract update(id: string, input: OrganisationTypeInput): Observable<OrganisationTypeEntry>;
}
