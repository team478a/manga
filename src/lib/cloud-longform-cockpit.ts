import type {
  CloudEpisode,
  CloudLongformStructure,
  CloudPage,
  CloudPageProductionState,
} from "@/modules/cloud-creator/contracts/types";
import type {
  CloudContinuityFact,
  CloudPlotThread,
  NarrativeContinuityIssue,
} from "@/lib/cloud-narrative-continuity";
import type { CloudChapterProductionPlan } from "@/lib/cloud-chapter-production-plan";

export type CloudCockpitPageStatus =
  | "not_started"
  | "generating"
  | "review_required"
  | "revision_required"
  | "finalized";

export type CloudCockpitPageItem = {
  id: string;
  pageNumber: number;
  status: CloudCockpitPageStatus;
};

export type CloudCockpitChapter = {
  id: string;
  title: string;
  episodeCount: number;
  plan: CloudChapterProductionPlan | null;
  complete: boolean;
  overdue: boolean;
  pages: CloudCockpitPageItem[];
  scenes: Array<{
    id: string;
    title: string;
    summary: string;
    pages: CloudCockpitPageItem[];
  }>;
};

export type CloudCockpitStatusFilter = "all" | "attention" | CloudCockpitPageStatus;

export function filterCloudCockpitStructure(input: {
  chapters: CloudCockpitChapter[];
  unassignedPages: CloudCockpitPageItem[];
  chapterId: string;
  status: CloudCockpitStatusFilter;
  limit: number;
}) {
  const chapterPages = input.chapters.flatMap((chapter) =>
    chapter.pages.map((page) => ({ ...page, chapterId: chapter.id })),
  );
  const allPages = input.chapterId === "unassigned"
    ? input.unassignedPages.map((page) => ({ ...page, chapterId: "unassigned" }))
    : chapterPages;
  const matches = allPages.filter((page) => {
    if (input.chapterId !== "all" && page.chapterId !== input.chapterId) return false;
    if (input.status === "all") return true;
    if (input.status === "attention")
      return page.status === "review_required" || page.status === "revision_required";
    return page.status === input.status;
  });
  return {
    totalMatches: matches.length,
    visiblePageIds: matches.slice(0, Math.max(1, input.limit)).map((page) => page.id),
  };
}

export function buildCloudLongformCockpit(input: {
  episodes: CloudEpisode[];
  pages: CloudPage[];
  longform: CloudLongformStructure;
  productionStates: CloudPageProductionState[];
  facts: CloudContinuityFact[];
  threads: CloudPlotThread[];
  issues: NarrativeContinuityIssue[];
  characterNames: string[];
  chapterPlans?: CloudChapterProductionPlan[];
  today?: string;
}) {
  const stateByPage = new Map(input.productionStates.map((state) => [state.pageId, state]));
  const orderedPages = [...input.pages].sort((left, right) => left.order_index - right.order_index);
  const pageItems = orderedPages.map((page) => {
    const state = stateByPage.get(page.id);
    const status: CloudCockpitPageStatus = state?.isStale
      ? "revision_required"
      : state?.status ?? "not_started";
    return { id: page.id, pageNumber: page.page_number, status };
  });
  const count = (status: CloudCockpitPageStatus) => pageItems.filter((page) => page.status === status).length;
  const openThreads = input.threads.filter((thread) => thread.status === "planned" || thread.status === "planted");
  const timeline = input.facts
    .filter((fact) => fact.fact_kind === "relationship" || fact.fact_kind === "timeline")
    .sort((left, right) => left.start_page - right.start_page)
    .map((fact) => ({
      id: fact.id,
      kind: fact.fact_kind,
      subject: fact.subject,
      label: `${fact.attribute}: ${fact.fact_value}`,
      startPage: fact.start_page,
      endPage: fact.end_page,
    }));

  const episodesByChapter = new Map<string, CloudEpisode[]>();
  for (const episode of input.episodes) {
    const chapterId = input.longform.episodeChapterIds[episode.id] ?? "unassigned";
    episodesByChapter.set(chapterId, [...(episodesByChapter.get(chapterId) ?? []), episode]);
  }
  const planByChapter = new Map((input.chapterPlans ?? []).map((plan) => [plan.chapter_id, plan]));
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const chapters = input.longform.chapters.map((chapter) => {
    const episodes = (episodesByChapter.get(chapter.id) ?? []).sort((a, b) => a.order_index - b.order_index);
    const episodeIds = new Set(episodes.map((episode) => episode.id));
    const scenes = input.longform.scenes
      .filter((scene) => scene.chapter_id === chapter.id || episodeIds.has(scene.episode_id))
      .sort((a, b) => a.order_index - b.order_index)
      .map((scene) => {
        const pages = pageItems.filter((page) => input.longform.pageSceneIds[page.id] === scene.id);
        return { id: scene.id, title: scene.title, summary: scene.summary, pages };
      });
    const chapterPages = pageItems.filter((page) => {
      const source = input.pages.find((item) => item.id === page.id);
      return Boolean(source && episodeIds.has(source.episode_id));
    });
    const plan = planByChapter.get(chapter.id) ?? null;
    const complete = chapterPages.length > 0 && chapterPages.every((page) => page.status === "finalized");
    return { id: chapter.id, title: chapter.title, episodeCount: episodes.length, scenes, pages: chapterPages, plan, complete, overdue: Boolean(plan?.due_date && !complete && plan.due_date < today) };
  });

  const priorityRank = { urgent: 0, high: 1, normal: 2, low: 3 } as const;
  const activeChapters = chapters.filter((chapter) => !chapter.complete);
  const nextChapter = [...activeChapters].sort((left, right) => {
    const leftRank = left.plan ? priorityRank[left.plan.priority] : priorityRank.normal;
    const rightRank = right.plan ? priorityRank[right.plan.priority] : priorityRank.normal;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return (left.plan?.due_date ?? "9999-12-31").localeCompare(right.plan?.due_date ?? "9999-12-31");
  })[0] ?? null;

  return {
    totalPages: pageItems.length,
    finalizedPages: count("finalized"),
    generatingPages: count("generating"),
    reviewPages: count("review_required") + count("revision_required"),
    notStartedPages: count("not_started"),
    completionPercent: pageItems.length ? Math.round((count("finalized") / pageItems.length) * 100) : 0,
    characterNames: [...new Set(input.characterNames)].sort((a, b) => a.localeCompare(b, "ja")),
    openThreads,
    issues: input.issues,
    timeline,
    chapters,
    overdueChapterCount: chapters.filter((chapter) => chapter.overdue).length,
    priorityChapterCount: chapters.filter((chapter) => !chapter.complete && (chapter.plan?.priority === "urgent" || chapter.plan?.priority === "high")).length,
    nextChapter,
    unassignedPages: pageItems.filter((page) => !input.longform.pageSceneIds[page.id]),
  };
}
