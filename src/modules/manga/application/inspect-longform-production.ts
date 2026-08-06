import { buildCloudLongformCockpit } from "../../../lib/cloud-longform-cockpit.ts";

type CockpitInput = Parameters<typeof buildCloudLongformCockpit>[0];

const unavailableContinuity = {
  available: false,
  facts: [],
  threads: [],
  review: {
    factCount: 0,
    threadCount: 0,
    openThreadCount: 0,
    warningCount: 0,
    issues: [],
  },
};

export async function inspectLongformProduction<Workspace, Project>(input: {
  projectId: string;
  loadWorkspace: (projectId: string) => Promise<Workspace>;
  loadProductionStates: (workspace: Workspace) => Promise<CockpitInput["productionStates"]>;
  loadContinuity: () => Promise<any>;
  loadCharacters: () => Promise<{ available: boolean; profiles: Array<{ name: string }> }>;
  loadChapterPlans: () => Promise<any>;
  loadResourceUsage: () => Promise<any>;
  selectWorkspace: (workspace: Workspace) => {
    project: Project;
    episodes: CockpitInput["episodes"];
    pages: CockpitInput["pages"];
    longform: CockpitInput["longform"];
  };
  today: string;
}) {
  const workspace = await input.loadWorkspace(input.projectId);
  const selected = input.selectWorkspace(workspace);
  const [productionStates, continuity, characters, chapterPlans, resources] =
    await Promise.all([
      input.loadProductionStates(workspace).catch(() => []),
      input.loadContinuity().catch(() => unavailableContinuity),
      input.loadCharacters().catch(() => ({ available: false, profiles: [] })),
      input.loadChapterPlans().catch(() => ({ available: false, plans: [] })),
      input.loadResourceUsage().catch(() => ({ available: false, usage: null })),
    ]);
  return {
    project: selected.project,
    longformAvailable: selected.longform.available,
    continuityAvailable: continuity.available,
    chapterPlansAvailable: chapterPlans.available,
    resourceBudgetAvailable: resources.available,
    resourceUsage: resources.usage,
    cockpit: buildCloudLongformCockpit({
      episodes: selected.episodes,
      pages: selected.pages,
      longform: selected.longform,
      productionStates,
      facts: continuity.facts,
      threads: continuity.threads,
      issues: continuity.review.issues,
      characterNames: characters.profiles.map((profile: { name: string }) => profile.name),
      chapterPlans: chapterPlans.plans,
      today: input.today,
    }),
  };
}
