/** Sample clients of an Indian CA firm. PAN/GSTIN are well-formed (GSTIN checksum included). */
export interface ClientSeed {
  id: string;
  name: string;
  pan: string;
  /** GST state code, or empty when the client is not GST-registered. */
  stateCode: string;
  city: string;
  services: string[];
  teamIds: string[];
}

const GST_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Builds a GSTIN: state code + PAN + entity number + 'Z' + check character. */
export function buildGstin(stateCode: string, pan: string, entity = 1): string {
  if (!stateCode) return '';
  const body = `${stateCode}${pan}${entity}Z`;
  let sum = 0;
  [...body].forEach((char, index) => {
    const product = GST_CHARS.indexOf(char) * (index % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  });
  return body + GST_CHARS[(36 - (sum % 36)) % 36];
}

export const CLIENT_SEEDS: ClientSeed[] = [];
