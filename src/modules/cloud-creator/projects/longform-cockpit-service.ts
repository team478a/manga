import { buildCloudLongformCockpit } from "@/lib/cloud-longform-cockpit";
import { getCloudNarrativeContinuity } from "./narrative-continuity-service";
import { listCloudCharacterProfiles } from "./character-profile-service";
import { getCloudProjectWorkspace } from "./project-service";
import { listCloudPageProductionStates } from "../production/production-status-service";

export async function getCloudLongformCockpit(projectId: string) {
  const workspace = await getCloudProjectWorkspace(projectId);
  const [productionStates, continuity, characters] = await Promise.all([
    listCloudPageProductionStates(projectId, workspace.pages).catch(() => []),
    getCloudNarrativeContinuity(projectId).catch(() => ({
      available: false,
      facts: [],
      threads: [],
      review: { factCount: 0, threadCount: 0, openThreadCount: 0, warningCount: 0, issues: [] },
    })),
    listCloudCharacterProfiles(projectId).catch(() => ({ available: false, profiles: [] })),
  ]);
  return {
    project: workspace.project,
    longformAvailable: workspace.longform.available,
    continuityAvailable: continuity.available,
    cockpit: buildCloudLongformCockpit({
      episodes: workspace.episodes,
      pages: workspace.pages,
      longform: workspace.longform,
      productionStates,
      facts: continuity.facts,
      threads: continuity.threads,
      issues: continuity.review.issues,
      characterNames: characters.profiles.map((profile) => profile.name),
    }),
  };
}
