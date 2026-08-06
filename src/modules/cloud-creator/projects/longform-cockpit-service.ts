import { inspectLongformProduction } from "../../manga/application/inspect-longform-production";
import { getCloudNarrativeContinuity } from "./narrative-continuity-service";
import { listCloudCharacterProfiles } from "./character-profile-service";
import { getCloudProjectWorkspace } from "./project-service";
import { listCloudPageProductionStates } from "../production/production-status-service";
import { listCloudChapterProductionPlans } from "./chapter-production-plan-service";
import { getCloudProjectResourceUsage } from "./project-budget-service";

export async function getCloudLongformCockpit(projectId: string) {
  return inspectLongformProduction({
    projectId,
    loadWorkspace: getCloudProjectWorkspace,
    loadProductionStates: (workspace) => listCloudPageProductionStates(projectId, workspace.pages),
    loadContinuity: () => getCloudNarrativeContinuity(projectId),
    loadCharacters: () => listCloudCharacterProfiles(projectId),
    loadChapterPlans: () => listCloudChapterProductionPlans(projectId),
    loadResourceUsage: () => getCloudProjectResourceUsage(projectId),
    selectWorkspace: (workspace) => workspace,
    today: new Date().toISOString().slice(0, 10),
  });
}
