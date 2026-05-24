/** Primeira carga (sem dados em cache). */
export function isCrmListInitialLoad(q: {
  isPending: boolean;
  data: unknown;
}): boolean {
  return q.isPending && q.data === undefined;
}
