import { WorkSheet } from './worksheet.models';

export function emptySheet(
  id: string,
  workNo: string,
  stage: string,
  createdById: string,
  receivedDate: string,
  checklist: readonly string[],
): WorkSheet {
  return {
    id,
    workNo,
    stage,
    createdById,
    receivedDate,
    assignDate: '',
    targetDate: '',
    reference: '',
    mobile: '',
    others: '',
    contacts: [],
    assignedById: null,
    assignedOpsId: null,
    assignedTlId: null,
    assignedTmId: null,
    clientId: '',
    workTypeKey: '',
    period: '',
    score: null,
    requirements: [],
    pendingBills: [],
    documents: [],
    returned: [],
    filing: {
      itFiledDate: '',
      ackNo: '',
      udin: '',
      udinDate: '',
      itrVSentDate: '',
      itVerified: '',
      itVerifiedMode: '',
      itVerifiedDate: '',
    },
    tax: {
      kind: '',
      amount: null,
      fy: '',
      paymentDate: '',
      paymentMode: '',
      receiptDate: '',
      receiptMode: '',
    },
    completion: {
      finished: { stamp: null, comments: '' },
      finalized: { stamp: null, comments: '' },
      documented: { stamp: null, comments: '' },
      checklist: checklist.map((label) => ({ label, done: false })),
      folderLocations: [],
    },
    officeApproval: { decision: '', stamp: null, comments: '' },
    delivery: {
      mode: '',
      items: '',
      date: '',
      receiverName: '',
      receiverPhone: '',
      invoiceNo: '',
      invoiceAmount: null,
      receiptAmount: null,
      receiptDate: '',
      receiptMode: '',
    },
    recurringKey: '',
    reworkCount: 0,
    closedAt: '',
    history: [],
  };
}

/** Next number of the form WS-2026-0001 for the given year. */
export function nextWorkNo(existing: readonly WorkSheet[], year: number): string {
  const prefix = `WS-${year}-`;
  const highest = existing
    .filter((s) => s.workNo.startsWith(prefix))
    .reduce((max, s) => Math.max(max, Number(s.workNo.slice(prefix.length)) || 0), 0);
  return `${prefix}${String(highest + 1).padStart(4, '0')}`;
}
