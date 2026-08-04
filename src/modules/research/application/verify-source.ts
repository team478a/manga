import type { CloudResearchSourceSnapshot } from "../domain/evidence.ts";

export type ResearchSourceFetcher = (
  url: string,
) => Promise<CloudResearchSourceSnapshot>;

export async function verifyResearchSource(
  url: string,
  fetchSource: ResearchSourceFetcher,
) {
  return fetchSource(url);
}
