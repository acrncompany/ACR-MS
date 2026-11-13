import { WorkType } from '../domain/worksheet.models';
import { WorkflowConfig } from '../domain/workflow.models';

export const DELIVERY_MODES = ['By hand', 'Courier', 'Email', 'Portal download'];
export const PAYMENT_MODES = ['Cash', 'Cheque', 'UPI', 'NEFT / RTGS', 'Net banking'];
export const VERIFY_MODES = [
  'Aadhaar OTP',
  'EVC - bank account',
  'EVC - net banking',
  'ITR-V by post',
];

/**
 * MOCK workflow definition. The real one will be served by the backend and will change, so the
 * UI and the engine only ever read this shape: stages, their order, who may act (permission)
 * and where each action leads. Rework/reject targets are plain `to` stage keys.
 */
export const WORKFLOW_CONFIG: WorkflowConfig = {
  lists: { deliveryModes: DELIVERY_MODES, paymentModes: PAYMENT_MODES, verifyModes: VERIFY_MODES },
  firstStage: 'intake',
  closedStage: 'closed',
  reassignPermission: 'worksheet.reassign',
  retargetPermission: 'worksheet.retarget',
  slots: [
    { slot: 'ops', label: 'Operations Manager', roleId: 'r-ops' },
    { slot: 'tl', label: 'Team Lead', roleId: 'r-fo' },
    { slot: 'tm', label: 'Team Member', roleId: 'r-fe' },
  ],
  stages: [
    {
      key: 'intake',
      label: 'Intake',
      order: 1,
      description: 'Finance / Accounting records the work received from the client.',
      permission: 'worksheet.create',
      actor: 'any',
      sections: ['header', 'client', 'work', 'documents'],
      visibleToStageActors: true,
      actions: [
        {
          key: 'submit',
          label: 'Submit for approval',
          icon: 'send',
          tone: 'primary',
          to: 'approval',
          requires: [
            { path: 'clientId', label: 'Client' },
            { path: 'workTypeKey', label: 'Nature of work' },
            { path: 'period', label: 'Period / year' },
            { path: 'receivedDate', label: 'Received date' },
          ],
        },
      ],
    },
    {
      key: 'approval',
      label: 'Approval & assignment',
      order: 2,
      description:
        'General Manager reviews, sets the target date and assigns an Operations Manager.',
      permission: 'worksheet.assign',
      actor: 'any',
      sections: [],
      actions: [
        {
          key: 'assign',
          label: 'Approve & assign',
          icon: 'how_to_reg',
          tone: 'primary',
          to: 'planning',
          needs: ['targetDate', 'assignee'],
          slot: 'ops',
        },
        {
          key: 'return',
          label: 'Return to intake',
          icon: 'undo',
          tone: 'warn',
          to: 'intake',
          commentRequired: true,
          sendsBack: true,
        },
      ],
    },
    {
      key: 'planning',
      label: 'Planning',
      order: 3,
      description: 'Operations Manager assigns a Team Lead.',
      permission: 'worksheet.plan',
      actor: 'ops',
      sections: [],
      actions: [
        {
          key: 'plan',
          label: 'Assign Team Lead',
          icon: 'supervisor_account',
          tone: 'primary',
          to: 'allocation',
          needs: ['assignee'],
          slot: 'tl',
        },
      ],
    },
    {
      key: 'allocation',
      label: 'Allocation',
      order: 4,
      description: 'Team Lead assigns a Team Member.',
      permission: 'worksheet.allocate',
      actor: 'tl',
      sections: [],
      actions: [
        {
          key: 'allocate',
          label: 'Assign Team Member',
          icon: 'person_add',
          tone: 'primary',
          to: 'execution',
          needs: ['assignee'],
          slot: 'tm',
        },
      ],
    },
    {
      key: 'execution',
      label: 'Execution',
      order: 5,
      description: 'Team Member does the work and fills the filing details.',
      permission: 'worksheet.execute',
      actor: 'tm',
      sections: ['filing', 'tax', 'documents'],
      actions: [
        {
          key: 'finish',
          label: 'Work Finished',
          icon: 'task_alt',
          tone: 'primary',
          to: 'review',
          stamp: 'finished',
        },
      ],
    },
    {
      key: 'review',
      label: 'Review',
      order: 6,
      description: 'Team Lead finalizes the work or sends it back for rework.',
      permission: 'worksheet.finalize',
      actor: 'tl',
      sections: [],
      actions: [
        {
          key: 'finalize',
          label: 'Work Finalized',
          icon: 'verified',
          tone: 'primary',
          to: 'documentation',
          stamp: 'finalized',
        },
        {
          key: 'rework',
          label: 'Send for rework',
          icon: 'replay',
          tone: 'warn',
          to: 'execution',
          commentRequired: true,
          sendsBack: true,
        },
      ],
    },
    {
      key: 'documentation',
      label: 'Documentation',
      order: 7,
      description: 'Documentation checklist and folder locations.',
      permission: 'worksheet.document',
      actor: 'tl',
      sections: ['documentation'],
      actions: [
        {
          key: 'document',
          label: 'Mark documented',
          icon: 'folder_managed',
          tone: 'primary',
          to: 'office',
          stamp: 'documented',
          requires: [{ path: 'completion.folderLocations', label: 'Folder location' }],
        },
      ],
    },
    {
      key: 'office',
      label: 'Office approval',
      order: 8,
      description: 'Operations Manager / General Manager approves, sends back or rejects.',
      permission: 'worksheet.approve',
      actor: 'ops',
      sections: [],
      actions: [
        {
          key: 'approve',
          label: 'Approve (OK)',
          icon: 'check_circle',
          tone: 'primary',
          to: 'delivery',
          decision: 'OK',
        },
        {
          key: 'office-rework',
          label: 'Rework',
          icon: 'replay',
          tone: 'warn',
          to: 'execution',
          decision: 'Rework',
          commentRequired: true,
          sendsBack: true,
        },
        {
          key: 'reject',
          label: 'Reject',
          icon: 'cancel',
          tone: 'danger',
          to: 'review',
          decision: 'Reject',
          commentRequired: true,
          sendsBack: true,
        },
      ],
    },
    {
      key: 'delivery',
      label: 'Delivery & billing',
      order: 9,
      description:
        'Finance / Accounting delivers the work, raises the invoice and records the fee.',
      permission: 'worksheet.deliver',
      actor: 'any',
      sections: ['delivery'],
      visibleToStageActors: true,
      actions: [
        {
          key: 'close',
          label: 'Close sheet',
          icon: 'lock',
          tone: 'primary',
          to: 'closed',
          requires: [
            { path: 'delivery.mode', label: 'Delivery mode' },
            { path: 'delivery.date', label: 'Delivery date' },
            { path: 'delivery.receiverName', label: 'Receiver name' },
            { path: 'delivery.invoiceNo', label: 'Invoice no' },
            { path: 'delivery.invoiceAmount', label: 'Invoice amount' },
          ],
        },
      ],
    },
    {
      key: 'closed',
      label: 'Closed',
      order: 10,
      description: 'Work delivered and billed.',
      permission: '',
      actor: 'any',
      sections: [],
      terminal: true,
      actions: [],
    },
  ],
};

export const WORK_TYPES: WorkType[] = [
  { key: 'monthly-retainership', label: 'Monthly Retainership', periodKind: 'month' },
  { key: 'gst-filing', label: 'GST Filing', periodKind: 'month' },
  { key: 'itr-filing', label: 'ITR Filing', periodKind: 'fy' },
  { key: 'tds', label: 'TDS', periodKind: 'quarter' },
  { key: 'audit', label: 'Audit', periodKind: 'fy' },
  { key: 'roc', label: 'ROC', periodKind: 'fy' },
  { key: 'others', label: 'Others', periodKind: 'text' },
];

/** Default documentation checklist copied onto every new sheet. */
export const DOCUMENTATION_CHECKLIST: string[] = [
  'Working papers filed',
  'Client documents scanned',
  'Acknowledgement / receipt attached',
  'Computation sheet signed',
];
