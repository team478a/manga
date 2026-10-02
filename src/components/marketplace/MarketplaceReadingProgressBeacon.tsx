"use client";

import { useEffect } from "react";
import { saveMarketplaceReadingProgress } from "@/app/actions/marketplace-reading-progress-actions";

export function MarketplaceReadingProgressBeacon({
  workId,
  publicationId,
  pageNumber,
}: {
  workId: string;
  publicationId: string;
  pageNumber: number;
}) {
  useEffect(() => {
    void saveMarketplaceReadingProgress({ workId, publicationId, pageNumber });
  }, [workId, publicationId, pageNumber]);
  return null;
}
