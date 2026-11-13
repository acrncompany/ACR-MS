export interface AppConfig {
  /**
   * Frontend-only mode: every feature repository uses its mock implementation and no request
   * is sent to the backend. Must be false (or absent) in production.
   */
  mockMode: boolean;
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
