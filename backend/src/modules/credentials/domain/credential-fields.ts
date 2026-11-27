/**
 * The portal credential fields a client can hold (MCA, Income Tax, GST, PF/ESI, Others). One set
 * per client, shared by every work sheet of that client. An allow-list: any other key is refused.
 */
export const CREDENTIAL_FIELDS = [
  'mca.id',
  'mca.password',
  'incomeTax.pan',
  'incomeTax.password',
  'incomeTax.dob',
  'gst.id',
  'gst.password',
  'pfEsi.id',
  'pfEsi.password',
  'others.id',
  'others.password',
] as const;

export type CredentialField = (typeof CREDENTIAL_FIELDS)[number];

export const CREDENTIAL_VALUE_MAX_LENGTH = 200;

/** Audit actions of the credential lifecycle (never contain the value). */
export const CREDENTIAL_AUDIT = {
  update: 'client.credential.update',
  clear: 'client.credential.clear',
  reveal: 'client.credential.reveal',
  denied: 'client.credential.reveal.denied',
  blocked: 'client.credential.reveal.blocked',
} as const;
