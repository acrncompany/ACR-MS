/** Every feature that has a repository. A feature listed in `realFeatures` talks to the backend. */
export const FEATURES = [
  'auth',
  'clients',
  'users',
  'organization',
  'organisationTypes',
  'works',
  'people',
  'worksheets',
  'dashboard',
  'hr',
] as const;
export type FeatureKey = (typeof FEATURES)[number];

export interface AppConfig {
  /**
   * Features that use the REAL backend API. Every other feature uses its mock repository and
   * sends no request. As features get a backend they move into this list; in production it must
   * list every feature that has one.
   */
  realFeatures: FeatureKey[];
  branding: {
    productName: string;
    tagline: string;
    logoUrl: string;
    /** Short selling points shown on the login page. */
    highlights?: string[];
    /** Optional CSS variable overrides, e.g. { "--mat-sys-primary": "#0b6e4f" }. */
    cssVariables?: Record<string, string>;
  };
  api: {
    baseUrl: string;
  };
  locale: {
    currency: string;
    locale: string;
  };
}
