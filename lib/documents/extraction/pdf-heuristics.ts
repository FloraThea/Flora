export const MIN_TOTAL_CHARS = 80;
export const MIN_CHARS_PER_PAGE = 35;

export function isLikelyScannedPdfHeuristic(
  text: string,
  pageCount: number,
  pagesWithText: number,
): boolean {
  if (pagesWithText === 0 && !text.trim()) return true;
  if (!text.trim()) return true;
  if (pageCount <= 0) return text.trim().length < MIN_TOTAL_CHARS;

  const charsPerPage = text.trim().length / pageCount;
  return text.trim().length < MIN_TOTAL_CHARS || charsPerPage < MIN_CHARS_PER_PAGE;
}
