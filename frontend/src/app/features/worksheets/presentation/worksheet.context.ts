import { Injectable, computed, inject } from '@angular/core';
import { AppConfigService } from '../../../core/config/app-config.service';
import { addDays, todayIso } from '../../../shared/utils/date';
import { loaded } from '../../../shared/utils/loaded';
import { ClientRepository } from '../../clients/domain/client.repository';
import { WorkSheet } from '../domain/worksheet.models';
import { WorksheetRepository } from '../domain/worksheet.repository';
import {
  availableActions,
  isClosed,
  isOverdue,
  stageDef,
  stageLabel,
} from '../domain/workflow-engine';

export type ChipTone = 'ok' | 'info' | 'warn' | 'bad' | 'neutral';

/** One sheet prepared for lists, boards and widgets. */
export interface SheetRow {
  sheet: WorkSheet;
  id: string;
  workNo: string;
  clientName: string;
  clientCode: string;
  workType: string;
  period: string;
  stageKey: string;
  stage: string;
  stageOrder: number;
  target: string;
  received: string;
  overdue: boolean;
  closed: boolean;
  sentBack: boolean;
  opsName: string;
  tlName: string;
  tmName: string;
  assignees: string[];
  /** The signed-in user has an action to take on this sheet right now. */
  waiting: boolean;
  tone: ChipTone;
}

/**
 * Joins sheets with client names, work types, stage labels and the signed-in user's actions.
 * Provided per route (it needs the route's repositories).
 */
@Injectable()
export class WorksheetContext {
  readonly repo = inject(WorksheetRepository);
  private readonly clientRepo = inject(ClientRepository);
  readonly locale = inject(AppConfigService).config.locale;

  private readonly clientList = loaded(() => this.clientRepo.listAll());
  readonly clients = this.clientList.rows;
  readonly reloadClients = this.clientList.reload;
  readonly today = todayIso();
  readonly weekEnd = addDays(this.today, 7);
  readonly monthPrefix = this.today.slice(0, 7);

  private readonly clientNames = computed(() => new Map(this.clients().map((c) => [c.id, c.name])));
  private readonly clientCodes = computed(
    () => new Map(this.clients().map((c) => [c.id, c.clientCode])),
  );
  private readonly typeLabels = computed(
    () => new Map(this.repo.workTypes().map((t) => [t.key, t.label])),
  );

  clientName(id: string): string {
    return this.clientNames().get(id) ?? '—';
  }

  clientCode(id: string): string {
    return this.clientCodes().get(id) ?? '';
  }

  typeLabel(key: string): string {
    return this.typeLabels().get(key) ?? key;
  }

  stageLabel(key: string): string {
    return stageLabel(this.repo.workflow(), key);
  }

  /** The sheet was sent back by its latest action (rework, reject or return). */
  private wasSentBack(sheet: WorkSheet): boolean {
    const config = this.repo.workflow();
    const last = [...sheet.history].reverse().find((h) => h.kind === 'action');
    if (!last?.fromStage || !last.toStage) return false;
    const from = stageDef(config, last.fromStage)?.order ?? 0;
    const to = stageDef(config, last.toStage)?.order ?? 0;
    return to < from;
  }

  readonly rows = computed<SheetRow[]>(() => {
    const config = this.repo.workflow();
    const actor = this.repo.actor();
    return this.repo.sheets().map((sheet) => {
      const closed = isClosed(sheet, config);
      const overdue = isOverdue(sheet, config, this.today);
      const sentBack = !closed && this.wasSentBack(sheet);
      const stage = stageDef(config, sheet.stage);
      const ops = this.repo.nameOf(sheet.assignedOpsId);
      const tl = this.repo.nameOf(sheet.assignedTlId);
      const tm = this.repo.nameOf(sheet.assignedTmId);
      return {
        sheet,
        id: sheet.id,
        workNo: sheet.workNo,
        clientName: this.clientName(sheet.clientId),
        clientCode: this.clientCode(sheet.clientId),
        workType: this.typeLabel(sheet.workTypeKey),
        period: sheet.period,
        stageKey: sheet.stage,
        stage: stage?.label ?? sheet.stage,
        stageOrder: stage?.order ?? 0,
        target: sheet.targetDate,
        received: sheet.receivedDate,
        overdue,
        closed,
        sentBack,
        opsName: ops,
        tlName: tl,
        tmName: tm,
        assignees: [ops, tl, tm].filter((n) => n !== '—'),
        waiting: !!actor && availableActions(sheet, actor, config).length > 0,
        tone: closed ? 'ok' : overdue ? 'bad' : sentBack ? 'warn' : 'info',
      };
    });
  });
}
