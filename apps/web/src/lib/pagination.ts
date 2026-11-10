/**
 * Helper to compute a sliding-window pagination range with ellipsis ("...").
 * Prevents horizontal layout overflow when totalPages is large.
 *
 * Examples:
 *   getPaginationRange(1, 126)   => [1, 2, 3, 4, 5, "...", 126]
 *   getPaginationRange(80, 126)  => [1, "...", 79, 80, 81, "...", 126]
 *   getPaginationRange(125, 126) => [1, "...", 122, 123, 124, 125, 126]
 */
export type PaginationItem = number | "...";

export function getPaginationRange(currentPage: number, totalPages: number): PaginationItem[] {
  const safeTotal = Math.max(1, Math.floor(totalPages || 1));
  const safeCurrent = Math.min(Math.max(1, Math.floor(currentPage || 1)), safeTotal);

  // If total pages is small, show all numbers without ellipses
  if (safeTotal <= 7) {
    return Array.from({ length: safeTotal }, (_, i) => i + 1);
  }

  // Near the start: 1, 2, 3, 4, 5, "...", safeTotal
  if (safeCurrent <= 4) {
    return [1, 2, 3, 4, 5, "...", safeTotal];
  }

  // Near the end: 1, "...", safeTotal - 4, safeTotal - 3, safeTotal - 2, safeTotal - 1, safeTotal
  if (safeCurrent >= safeTotal - 3) {
    return [1, "...", safeTotal - 4, safeTotal - 3, safeTotal - 2, safeTotal - 1, safeTotal];
  }

  // In the middle: 1, "...", safeCurrent - 1, safeCurrent, safeCurrent + 1, "...", safeTotal
  return [1, "...", safeCurrent - 1, safeCurrent, safeCurrent + 1, "...", safeTotal];
}
