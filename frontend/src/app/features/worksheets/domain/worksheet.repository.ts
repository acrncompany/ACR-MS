import { Signal } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Actor,
  ActionPayload,
  AssigneeSlot,
  Contact,
  ReassignPayload,
  RetargetPayload,
  WorkSheet,
  WorkType,
} from './worksheet.models';
import { WorkflowConfig } from './workflow.models';

export interface NewWorksheetInput {
  clientId: string;
  workTypeKey: string;
  period: string;
  mobile?: string;
  contacts?: Contact[];
}

export interface Assignee {
  id: string;
  name: string;
}

export interface GenerateResult {
  created: number;
  skipped: number;
}

/**
 * Work sheets. `sheets` already contains only what the signed-in user may see (hierarchy
 * visibility is applied by the data layer, and must be enforced by the backend).
 */
export abstract class WorksheetRepository {
  abstract readonly workflow: Signal<WorkflowConfig>;
  abstract readonly workTypes: Signal<WorkType[]>;
  abstract readonly sheets: Signal<WorkSheet[]>;
  /** The signed-in user as the workflow engine sees them; null when signed out. */
  abstract readonly actor: Signal<Actor | null>;
  abstract readonly checklistTemplate: readonly string[];

  abstract nameOf(userId: string | null): string;
  /** People the signed-in user may assign to a slot (below them in the hierarchy). */
  abstract assignees(slot: AssigneeSlot): Assignee[];

  abstract create(input: NewWorksheetInput): Observable<WorkSheet>;
  /** Saves the editable sections of `draft`; the server ignores everything else. */
  abstract saveSections(draft: WorkSheet): Observable<WorkSheet>;
  abstract perform(id: string, actionKey: string, payload: ActionPayload): Observable<WorkSheet>;
  abstract reassign(id: string, payload: ReassignPayload): Observable<WorkSheet>;
  abstract retarget(id: string, payload: RetargetPayload): Observable<WorkSheet>;
  /** Records in the sheet's history that a client credential was opened from it. */
  abstract logCredentialReveal(id: string, fieldLabel: string): Observable<void>;
  /** Creates this period's sheets for clients with recurring work (skips existing ones). */
  abstract generateRecurring(): Observable<GenerateResult>;
}
