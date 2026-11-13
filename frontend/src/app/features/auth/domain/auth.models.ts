export interface LoginCredentials {
  email: string;
  password: string;
}

/** A one-click role shortcut that only pre-fills the login form (mock mode only). */
export interface DemoAccount extends LoginCredentials {
  /** Button label, e.g. "Finance Officer". */
  label: string;
  icon: string;
}
