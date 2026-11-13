import { DirectoryStore } from '../../../core/mock/directory.store';
import { CLIENT_PROFILES } from '../../clients/data/client.profiles';
import { addDays, todayIso } from '../../../shared/utils/date';
import { monthLabel, previousFinancialYear } from '../domain/period';
import { emptySheet, nextWorkNo } from '../domain/worksheet.factory';
import { Actor, ActionPayload, WorkSheet } from '../domain/worksheet.models';
import {
  SECTION_LABELS,
  applyAction,
  applyReassign,
  applyRetarget,
  historyEntry,
} from '../domain/workflow-engine';
import { SectionKey, StageDef, WorkflowConfig } from '../domain/workflow.models';
import { actorFor } from './actors';
import {
  DELIVERY_MODES,
  DOCUMENTATION_CHECKLIST,
  PAYMENT_MODES,
  VERIFY_MODES,
  WORKFLOW_CONFIG,
} from './workflow.config';

const MS_HOUR = 3_600_000;

interface Plan {
  client: string;
  type: string;
  /** Defaults to the usual period of the work type. */
  period?: string;
  /** Stage the sheet is in now. */
  stage: string;
  /** Target date as days from today (negative = already passed). */
  target: number;
  /** Days since the work was received. */
  ago: number;
  tl?: string;
  tm?: string;
  /** Do one send-back loop at this stage on the way (rework / reject). */
  loop?: { at: string; action: string; comment: string };
  /** TL moves the sheet to another Team Member after allocation. */
  reassignTo?: string;
  /** GM first sets the target `from` days from today, then moves it to `target` for a reason. */
  retarget?: { from: number; reason: string };
  recurring?: boolean;
  bills?: boolean;
  /** Only part of the delivery section is filled (sheet is still being delivered). */
  partialDelivery?: boolean;
}

const CONTENT: Record<
  string,
  { requirements: string[]; documents: string[]; fee: number; reference: string }
> = {
  'monthly-retainership': {
    requirements: ['Bookkeeping up to date', 'Bank reconciliation', 'Monthly MIS to promoter'],
    documents: ['Bank statements', 'Purchase invoices', 'Sales invoices', 'Expense vouchers'],
    fee: 12000,
    reference: 'Monthly mail',
  },
  'gst-filing': {
    requirements: [
      'Reconcile GSTR-2B with purchase register',
      'File GSTR-1 and GSTR-3B by due date',
    ],
    documents: ['Sales register', 'Purchase register', 'Bank statement'],
    fee: 2500,
    reference: 'Phone call',
  },
  'itr-filing': {
    requirements: [
      'Compute total income',
      'Claim Section 80C / 80D deductions',
      'E-verify the return',
    ],
    documents: [
      'Form 16 / 16A',
      'Form 26AS and AIS',
      'Bank interest certificates',
      'Investment proofs',
    ],
    fee: 3500,
    reference: 'Walk-in',
  },
  tds: {
    requirements: ['Reconcile TDS ledger with challans', 'File quarterly TDS return'],
    documents: ['TDS challans', 'Vendor payment register', 'PAN of deductees'],
    fee: 4000,
    reference: 'Email',
  },
  audit: {
    requirements: [
      'Finalise books of accounts',
      'Vouching and ledger scrutiny',
      'Issue audit report with UDIN',
    ],
    documents: ['Trial balance', 'Fixed asset register', 'Bank confirmations', 'Stock statement'],
    fee: 45000,
    reference: 'Engagement letter',
  },
  roc: {
    requirements: ['Prepare AOC-4 and MGT-7', 'Board / AGM resolutions'],
    documents: ['Audited financials', 'Director KYC', 'Board minutes'],
    fee: 8000,
    reference: 'Email',
  },
  others: {
    requirements: ['Prepare certificate as per client request'],
    documents: ['Supporting working'],
    fee: 5000,
    reference: 'Walk-in',
  },
};

const PLANS: Plan[] = [];

function previousFy(): string {
  return previousFinancialYear(todayIso());
}

function defaultPeriod(type: string): string {
  const now = todayIso();
  switch (type) {
    case 'itr-filing':
    case 'audit':
    case 'roc':
      return previousFinancialYear(now);
    case 'tds':
      return 'Q2 FY 2026-27';
    default:
      return monthLabel(now);
  }
}

/** Repeatable pseudo-random digits so seeded numbers look real but never change between loads. */
function digits(seed: number, length: number): string {
  let value = (seed * 2654435761) % 4294967296;
  let out = '';
  while (out.length < length) {
    value = (value * 1664525 + 1013904223) % 4294967296;
    out += String(value % 10);
  }
  return out;
}

/**
 * Builds the sample sheets by playing each one through the real workflow engine, so histories,
 * stamps, assignments and rework counters are exactly what the app itself would produce.
 */
export function buildSeedSheets(
  directory: DirectoryStore,
  config: WorkflowConfig = WORKFLOW_CONFIG,
): WorkSheet[] {
  const now = Date.now();
  const today = todayIso();
  const nameOf = (id: string): string => directory.userName(id);
  const actors = new Map<string, Actor>();
  const actor = (id: string): Actor => {
    let found = actors.get(id);
    if (!found) {
      found = actorFor(directory, id);
      actors.set(id, found);
    }
    return found;
  };
  const sheets: WorkSheet[] = [];

  // Oldest first, so numbers run in the order the work arrived.
  const ordered = PLANS.map((plan, index) => ({ plan, index })).sort(
    (a, b) => b.plan.ago - a.plan.ago || a.index - b.index,
  );
  for (const { plan, index } of ordered) {
    const steps = play(plan, index, 1);
    const spacing = Math.min(
      30,
      Math.max(1, (plan.ago * 24 - 3) / Math.max(steps.history.length, 1)),
    );
    const sheet = play(
      plan,
      index,
      spacing,
      nextWorkNo(sheets, new Date(now - plan.ago * 24 * MS_HOUR).getUTCFullYear()),
    );
    sheets.push(sheet);
  }
  return sheets;

  function play(
    plan: Plan,
    index: number,
    spacingHours: number,
    workNo = 'WS-0000-0000',
  ): WorkSheet {
    const start = now - (plan.ago * 24 + 3) * MS_HOUR;
    let clock = start;
    const tick = (): string => {
      const iso = new Date(clock).toISOString();
      clock += spacingHours * MS_HOUR;
      return iso;
    };
    let counter = 0;
    const entryId = (): string => `h-${index}-${counter++}`;

    const profile = CLIENT_PROFILES[plan.client];
    const content = CONTENT[plan.type];
    const acc = actor('u-acc');

    let sheet = emptySheet(
      `ws-${index + 1}`,
      workNo,
      config.firstStage,
      acc.id,
      new Date(start).toISOString().slice(0, 10),
      DOCUMENTATION_CHECKLIST,
    );
    sheet.clientId = plan.client;
    sheet.workTypeKey = plan.type;
    sheet.period = plan.period ?? defaultPeriod(plan.type);
    sheet.reference = content.reference;
    sheet.mobile = profile.principals[0]?.mobile ?? '';
    sheet.contacts = profile.principals.map((p) => ({
      name: p.name,
      phone: p.mobile,
      email: `${p.name
        .toLowerCase()
        .replace(/[^a-z]+/g, '.')
        .replace(/^\.|\.$/g, '')}@example.in`,
    }));
    sheet.score = (index % 3) + 2;
    sheet.requirements = [...content.requirements];
    sheet.documents = content.documents.map((name) => ({ name, receivedOn: sheet.receivedDate }));
    if (plan.bills) {
      sheet.pendingBills = [
        { ref: `INV/25-26/${100 + index}`, amount: 4500 + index * 250 },
        { ref: `INV/25-26/${140 + index}`, amount: 12000 },
      ];
    }
    if (plan.recurring) sheet.recurringKey = `${plan.client}|${plan.type}|${sheet.period}`;
    const createdAt = tick();
    sheet.history.push(
      historyEntry(entryId(), acc, createdAt, {
        kind: 'create',
        label: 'Work sheet created',
        toStage: config.firstStage,
      }),
    );

    const tl = plan.tl ?? 'u-fo';
    const tm = plan.tm ?? 'u-fe';
    const stageActor = (stage: StageDef): Actor => {
      switch (stage.permission) {
        case 'worksheet.create':
        case 'worksheet.deliver':
          return acc;
        case 'worksheet.assign':
          return actor('u-gm');
        case 'worksheet.plan':
        case 'worksheet.approve':
          return actor('u-ops');
        case 'worksheet.execute':
          return actor(sheet.assignedTmId ?? tm);
        default:
          return actor(sheet.assignedTlId ?? tl);
      }
    };

    let loopDone = !plan.loop;
    let guard = 0;
    while (guard++ < 40) {
      const stage = config.stages.find((s) => s.key === sheet.stage)!;
      if (sheet.stage === plan.stage && loopDone) break;
      if (stage.terminal) break;
      const who = stageActor(stage);
      const at = tick();
      fill(sheet, stage, plan, index, at, who, entryId);

      if (plan.loop && !loopDone && stage.key === plan.loop.at) {
        const back = stage.actions.find((a) => a.key === plan.loop?.action)!;
        sheet = applyAction(
          sheet,
          back,
          { comment: plan.loop.comment },
          who,
          at,
          config,
          entryId(),
          nameOf,
        );
        loopDone = true;
        continue;
      }
      const forward = stage.actions.find((a) => !a.sendsBack)!;
      const payload: ActionPayload = {};
      if (forward.needs?.includes('targetDate')) {
        payload.targetDate = addDays(today, plan.retarget?.from ?? plan.target);
      }
      if (forward.slot === 'ops') payload.assigneeId = 'u-ops';
      if (forward.slot === 'tl') payload.assigneeId = tl;
      if (forward.slot === 'tm') payload.assigneeId = tm;
      sheet = applyAction(sheet, forward, payload, who, at, config, entryId(), nameOf);

      if (forward.slot === 'ops' && plan.retarget) {
        sheet = applyRetarget(
          sheet,
          { targetDate: addDays(today, plan.target), reason: plan.retarget.reason },
          actor('u-gm'),
          tick(),
          entryId(),
        );
      }
      if (forward.slot === 'tm' && plan.reassignTo) {
        sheet = applyReassign(
          sheet,
          {
            slot: 'tm',
            assigneeId: plan.reassignTo,
            reason: `${nameOf(tm)} is on leave this week.`,
          },
          actor(tl),
          tick(),
          config,
          entryId(),
          nameOf,
        );
      }
    }
    // Partly filled work for sheets that are in the middle of a stage.
    const current = config.stages.find((s) => s.key === sheet.stage);
    if (current && !current.terminal && plan.partialDelivery) {
      sheet.delivery.mode = DELIVERY_MODES[1];
      sheet.delivery.items = 'Acknowledgement copy and challan';
    }
    if (current?.key === 'execution' && index % 2 === 0) {
      sheet.filing.ackNo = `AA${digits(index, 13)}`;
    }
    return sheet;
  }

  /** Fills the sections of a stage the way its actor would before moving on. */
  function fill(
    sheet: WorkSheet,
    stage: StageDef,
    plan: Plan,
    index: number,
    at: string,
    who: Actor,
    entryId: () => string,
  ): void {
    const day = at.slice(0, 10);
    const touched: SectionKey[] = [];
    if (stage.key === 'execution') {
      const type = plan.type;
      sheet.filing = {
        itFiledDate: day,
        ackNo:
          type === 'gst-filing'
            ? `AA${digits(index, 13)}`
            : type === 'roc'
              ? `T${digits(index, 8)}`
              : digits(index, 15),
        udin: type === 'audit' ? `26${digits(index, 6)}BH${digits(index + 3, 8)}` : '',
        udinDate: type === 'audit' ? day : '',
        itrVSentDate: type === 'itr-filing' ? day : '',
        itVerified: type === 'itr-filing' ? 'yes' : '',
        itVerifiedMode: type === 'itr-filing' ? VERIFY_MODES[0] : '',
        itVerifiedDate: type === 'itr-filing' ? day : '',
      };
      sheet.tax = {
        kind: type === 'itr-filing' && index % 2 === 0 ? 'refund' : 'payable',
        amount: type === 'monthly-retainership' ? null : 3200 + index * 475,
        fy: previousFy(),
        paymentDate: day,
        paymentMode: PAYMENT_MODES[3],
        receiptDate: day,
        receiptMode: PAYMENT_MODES[4],
      };
      touched.push('filing', 'tax');
    }
    if (stage.key === 'documentation') {
      sheet.completion.checklist = sheet.completion.checklist.map((i) => ({ ...i, done: true }));
      sheet.completion.folderLocations = [
        `Almirah ${(index % 4) + 1}, Shelf ${(index % 3) + 1}`,
        `\\\\server\\clients\\${plan.client}\\${sheet.period.replace(/\s+/g, '_')}`,
      ];
      touched.push('documentation');
    }
    if (stage.key === 'delivery') {
      const principal = CLIENT_PROFILES[plan.client].principals[0];
      const fee = CONTENT[plan.type].fee;
      sheet.delivery = {
        mode: DELIVERY_MODES[index % DELIVERY_MODES.length],
        items: 'Filed return, acknowledgement and computation',
        date: day,
        receiverName: principal.name,
        receiverPhone: principal.mobile,
        invoiceNo: `INV/26-27/${String(200 + index).padStart(4, '0')}`,
        invoiceAmount: fee,
        receiptAmount: fee,
        receiptDate: day,
        receiptMode: PAYMENT_MODES[index % PAYMENT_MODES.length],
      };
      touched.push('delivery');
    }
    if (touched.length) {
      sheet.history.push(
        historyEntry(entryId(), who, at, {
          kind: 'edit',
          label: `Saved ${touched.map((s) => SECTION_LABELS[s]).join(', ')}`,
          fromStage: stage.key,
          toStage: stage.key,
        }),
      );
    }
  }
}
