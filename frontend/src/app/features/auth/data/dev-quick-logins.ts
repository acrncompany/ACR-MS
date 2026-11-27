import { DemoAccount } from '../domain/auth.models';

/**
 * DEVELOPMENT ONLY. Emails of the users created by the backend dev seed (`npx prisma db seed`,
 * domain from SEED_EMAIL_DOMAIN, default acr.test). Quick login fills ONLY the email: the
 * password is whatever SEED_DEMO_PASSWORD is, and the developer types it. Never include a
 * password here. The login page only reads this under `ngDevMode`, so production builds drop it.
 */
export const DEV_QUICK_LOGINS: readonly DemoAccount[] = [
  { label: 'Board', icon: 'shield_person', email: 'board@acr.test' },
  { label: 'General Manager', icon: 'badge', email: 'general.manager@acr.test' },
  { label: 'Operations Manager', icon: 'engineering', email: 'operations.manager@acr.test' },
  { label: 'Finance Officer', icon: 'supervisor_account', email: 'finance.officer@acr.test' },
  { label: 'Finance Executive', icon: 'person', email: 'finance.executive@acr.test' },
  { label: 'HR', icon: 'diversity_3', email: 'hr@acr.test' },
  { label: 'BDE', icon: 'trending_up', email: 'bde@acr.test' },
  { label: 'Customer Care', icon: 'support_agent', email: 'customer.care@acr.test' },
  { label: 'Finance / Accounting', icon: 'calculate', email: 'finance.accounting@acr.test' },
];
