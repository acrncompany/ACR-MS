import { AssigneeSlot, StageKey } from './worksheet.models';

/** Sections of the sheet. A stage lists the sections its actor may edit. */
export type SectionKey =
  'header' | 'client' | 'work' | 'documents' | 'filing' | 'tax' | 'documentation' | 'delivery';

export type ActionTone = 'primary' | 'neutral' | 'warn' | 'danger';

/** Which completion step an action stamps. */
export type StampTarget = 'finished' | 'finalized' | 'documented';

export interface RequiredField {
  /** Dot path into the sheet, e.g. `delivery.receiverName`. Arrays must be non-empty. */
  path: string;
  label: string;
}

export interface ActionDef {
  key: string;
  label: string;
  icon: string;
  tone: ActionTone;
  /** Stage the sheet moves to. Rework/reject point back to an earlier stage. */
  to: StageKey;
  /** Extra input collected in the action dialog. */
  needs?: ('targetDate' | 'assignee')[];
  /** Which assignment slot `assignee` fills. */
  slot?: AssigneeSlot;
  commentRequired?: boolean;
  /** True for rework / reject / return: counted and flagged in the history. */
  sendsBack?: boolean;
  stamp?: StampTarget;
  decision?: 'OK' | 'Rework' | 'Reject';
  requires?: RequiredField[];
}

export interface StageDef {
  key: StageKey;
  label: string;
  order: number;
  description: string;
  /** Permission needed to act at this stage ("worksheet.<action>"). Empty for terminal stages. */
  permission: string;
  /**
   * Whose sheet the actor must be: `any` (permission is enough) or the assignment slot whose
   * assignee must be the actor or someone below them in the hierarchy.
   */
  actor: 'any' | AssigneeSlot;
  /** Sections the actor can edit while the sheet is in this stage. */
  sections: SectionKey[];
  /** Everyone with this stage's permission sees every sheet in the stage. */
  visibleToStageActors?: boolean;
  actions: ActionDef[];
  /** Counts as work in progress for dashboards (false for intake and closed). */
  terminal?: boolean;
}

export interface SlotDef {
  slot: AssigneeSlot;
  label: string;
  /** Candidates are active users with this role, below the person assigning. */
  roleId: string;
}

export interface WorkflowConfig {
  stages: StageDef[];
  /** Pick-lists used by the sections (delivery, payment and verification modes). */
  lists: { deliveryModes: string[]; paymentModes: string[]; verifyModes: string[] };
  slots: SlotDef[];
  reassignPermission: string;
  retargetPermission: string;
  /** Needs the sheet to be past intake and not closed. */
  firstStage: StageKey;
  closedStage: StageKey;
}
