export function marketplaceReadingProgressKey(
  workId: string,
  publicationId: string,
) {
  return `${workId}:${publicationId}`;
}

export function resolveMarketplaceReadingPage(
  accessiblePages: number[],
  requestedPage: number | null,
  savedPage: number | null,
) {
  if (!accessiblePages.length) return null;
  if (requestedPage !== null && accessiblePages.includes(requestedPage)) {
    return requestedPage;
  }
  if (requestedPage === null && savedPage !== null && accessiblePages.includes(savedPage)) {
    return savedPage;
  }
  return accessiblePages[0];
}
