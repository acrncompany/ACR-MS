/** One row of the works master (the client form's "Applicable laws" list). */
export interface WorkEntry {
  id: string;
  /** WRK-0001... Issued by the server once, never changes, never typed in. */
  code: string;
  name: string;
}

/** Only the name: the server issues the code. */
export interface WorkInput {
  name: string;
}
