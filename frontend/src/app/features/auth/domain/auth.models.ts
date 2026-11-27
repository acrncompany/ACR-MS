export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * A one-click shortcut on the login page (development only). With a `password` (mock mode) it
 * fills both fields; without one it fills ONLY the email and the user types the password.
 */
export interface DemoAccount {
  /** Button label, e.g. "Finance Officer". */
  label: string;
  icon: string;
  email: string;
  password?: string;
}
