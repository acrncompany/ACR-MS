import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, map } from 'rxjs';
import { SessionService } from '../../../core/auth/session.service';
import { AppConfigService } from '../../../core/config/app-config.service';
import {
  ActionPayload,
  Actor,
  AssigneeSlot,
  ReassignPayload,
  RetargetPayload,
  WorkSheet,
  WorkType,
} from '../domain/worksheet.models';
import {
  Assignee,
  GenerateResult,
  NewWorksheetInput,
  WorksheetRepository,
} from '../domain/worksheet.repository';
import { WorkflowConfig } from '../domain/workflow.models';

const EMPTY_WORKFLOW: WorkflowConfig = {
  stages: [],
  lists: { deliveryModes: [], paymentModes: [], verifyModes: [] },
  slots: [],
  reassignPermission: '',
  retargetPermission: '',
  firstStage: '',
  closedStage: '',
};

/** Real implementation. Endpoints are placeholders until the backend module exists. */
@Injectable()
export class ApiWorksheetRepository extends WorksheetRepository {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);
  private readonly session = inject(SessionService);

  private readonly workflowState = signal<WorkflowConfig>(EMPTY_WORKFLOW);
  private readonly typesState = signal<WorkType[]>([]);
  private readonly sheetsState = signal<WorkSheet[]>([]);
  private readonly names = signal<Record<string, string>>({});

  override readonly workflow = this.workflowState.asReadonly();
  override readonly workTypes = this.typesState.asReadonly();
  override readonly sheets = this.sheetsState.asReadonly();
  override readonly checklistTemplate: readonly string[] = [];
  override readonly actor = computed<Actor | null>(() => {
    const user = this.session.user();
    return user
      ? {
          id: user.id,
          name: user.name,
          role: user.role,
          roleId: user.roleId,
          seesAll: user.seesAll,
          permissions: user.permissions,
          // The server decides visibility; the client only knows itself.
          subtree: new Set([user.id]),
        }
      : null;
  });

  constructor() {
    super();
    this.http
      .get<WorkflowConfig>(`${this.base}/workflow`)
      .subscribe((w) => this.workflowState.set(w));
    this.http.get<WorkType[]>(`${this.base}/work-types`).subscribe((t) => this.typesState.set(t));
    this.reload();
  }

  private get base(): string {
    return `${this.config.config.api.baseUrl}/worksheets`;
  }

  private reload(): void {
    this.http.get<WorkSheet[]>(this.base).subscribe((list) => this.sheetsState.set(list));
  }

  private refreshed<T>(source: Observable<T>): Observable<T> {
    return source.pipe(map((value) => (this.reload(), value)));
  }

  nameOf(userId: string | null): string {
    return (userId && this.names()[userId]) || '—';
  }

  assignees(slot: AssigneeSlot): Assignee[] {
    void slot;
    return [];
  }

  create(input: NewWorksheetInput): Observable<WorkSheet> {
    return this.refreshed(this.http.post<WorkSheet>(this.base, input));
  }

  saveSections(draft: WorkSheet): Observable<WorkSheet> {
    return this.refreshed(this.http.patch<WorkSheet>(`${this.base}/${draft.id}`, draft));
  }

  perform(id: string, actionKey: string, payload: ActionPayload): Observable<WorkSheet> {
    return this.refreshed(
      this.http.post<WorkSheet>(`${this.base}/${id}/actions/${actionKey}`, payload),
    );
  }

  reassign(id: string, payload: ReassignPayload): Observable<WorkSheet> {
    return this.refreshed(this.http.post<WorkSheet>(`${this.base}/${id}/reassign`, payload));
  }

  retarget(id: string, payload: RetargetPayload): Observable<WorkSheet> {
    return this.refreshed(this.http.post<WorkSheet>(`${this.base}/${id}/retarget`, payload));
  }

  logCredentialReveal(id: string, fieldLabel: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/credential-reveals`, { fieldLabel });
  }

  generateRecurring(): Observable<GenerateResult> {
    return this.refreshed(this.http.post<GenerateResult>(`${this.base}/generate-recurring`, {}));
  }
}
