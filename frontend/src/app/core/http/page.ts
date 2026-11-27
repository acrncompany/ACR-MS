/** One page of a server-side list. `page` is 1-based. */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PageQuery {
  q: string;
  page: number;
  pageSize: number;
}
