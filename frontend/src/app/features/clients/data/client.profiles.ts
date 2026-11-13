import { Constitution, CredentialKey, Principal, RecurringRule } from '../domain/client.models';

/** Extra master data per client (keyed by client id). Empty until the database provides it. */
export interface ClientProfile {
  constitution: Constitution;
  address: string;
  principals: Principal[];
  previousAuditor: string;
  recurring: RecurringRule[];
  /** DEMO secrets only. Real values are encrypted at field level by the backend. */
  credentials: Partial<Record<CredentialKey, string>>;
}

export const CLIENT_PROFILES: Record<string, ClientProfile> = {};
