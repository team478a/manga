export type ContinuitySubjectKind = "character" | "location" | "prop";

export type ContinuityVersionRef = {
  subjectId: string;
  version: number;
  kind: ContinuitySubjectKind;
};

export type ContinuityPlacement = {
  pageId: string;
  pageNumber: number;
  panelId: string;
  sourceJobId: string;
  assetId: string | null;
  assetSha256: string | null;
  jobInput: unknown;
};

export type VisualContinuityCandidate = {
  code: "duplicate_asset" | "duplicate_digest";
  first: Pick<ContinuityPlacement, "pageId" | "pageNumber" | "panelId" | "assetId">;
  second: Pick<ContinuityPlacement, "pageId" | "pageNumber" | "panelId" | "assetId">;
  message: string;
};

export type ContinuityAssignment = {
  pageId: string;
  panelId: string;
  subjectId: string;
  kind: ContinuitySubjectKind;
};

export type ContinuitySubject = {
  id: string;
  name: string;
  kind: ContinuitySubjectKind;
  currentVersion: number;
  referenceAssetIds: string[];
};

export type ContinuityStyle = {
  id: string;
  currentVersion: number;
  referenceAssetIds: string[];
} | null;

export type ContinuityIssue = {
  code:
    | "generation_record_missing"
    | "subject_assignment_missing"
    | "subject_profile_missing"
    | "subject_version_missing"
    | "subject_version_outdated"
    | "subject_reference_missing"
    | "style_version_missing"
    | "style_version_outdated"
    | "style_reference_missing"
    | "mixed_subject_versions";
  severity: "warning" | "info";
  pageId: string | null;
  pageNumber: number | null;
  panelId: string | null;
  subjectId: string | null;
  message: string;
};

export type ContinuityReview = {
  generatedPanelCount: number;
  reviewedPanelCount: number;
  warningCount: number;
  infoCount: number;
  issues: ContinuityIssue[];
  visualCandidateCount: number;
  visualCandidates: VisualContinuityCandidate[];
};

type ParsedJobInput = {
  characterVersions: Map<string, number>;
  worldVersions: Map<string, { version: number; kind: "location" | "prop" }>;
  styleVersion: { bibleId: string; version: number } | null;
  referenceAssetIds: Set<string>;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function positiveInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function parseJobInput(value: unknown): ParsedJobInput | null {
  const input = record(value);
  if (!input) return null;
  const characterVersions = new Map<string, number>();
  const worldVersions = new Map<
    string,
    { version: number; kind: "location" | "prop" }
  >();
  for (const entry of Array.isArray(input.characterProfileVersions)
    ? input.characterProfileVersions
    : []) {
    const item = record(entry);
    const version = positiveInteger(item?.version);
    if (typeof item?.profileId === "string" && version)
      characterVersions.set(item.profileId, version);
  }
  for (const entry of Array.isArray(input.worldProfileVersions)
    ? input.worldProfileVersions
    : []) {
    const item = record(entry);
    const version = positiveInteger(item?.version);
    if (
      typeof item?.profileId === "string" &&
      version &&
      (item.kind === "location" || item.kind === "prop")
    )
      worldVersions.set(item.profileId, { version, kind: item.kind });
  }
  const style = record(input.styleBibleVersion);
  const styleVersion =
    typeof style?.bibleId === "string" && positiveInteger(style.version)
      ? { bibleId: style.bibleId, version: positiveInteger(style.version)! }
      : null;
  const referenceAssetIds = new Set(
    (Array.isArray(input.referenceAssetIds) ? input.referenceAssetIds : []).filter(
      (item): item is string => typeof item === "string",
    ),
  );
  return { characterVersions, worldVersions, styleVersion, referenceAssetIds };
}

function subjectVersion(input: ParsedJobInput, subject: ContinuitySubject) {
  return subject.kind === "character"
    ? input.characterVersions.get(subject.id)
    : input.worldVersions.get(subject.id)?.version;
}

export function evaluateCloudContinuity(input: {
  placements: ContinuityPlacement[];
  assignments: ContinuityAssignment[];
  subjects: ContinuitySubject[];
  style: ContinuityStyle;
}): ContinuityReview {
  const issues: ContinuityIssue[] = [];
  const visualCandidates: VisualContinuityCandidate[] = [];
  const subjects = new Map(input.subjects.map((subject) => [subject.id, subject]));
  const assignments = new Map<string, ContinuityAssignment[]>();
  const usedVersions = new Map<string, Set<number>>();
  for (const assignment of input.assignments) {
    const key = `${assignment.pageId}:${assignment.panelId}`;
    assignments.set(key, [...(assignments.get(key) ?? []), assignment]);
  }
  for (const placement of input.placements) {
    const location = {
      pageId: placement.pageId,
      pageNumber: placement.pageNumber,
      panelId: placement.panelId,
    };
    const job = parseJobInput(placement.jobInput);
    if (!job) {
      issues.push({
        code: "generation_record_missing",
        severity: "warning",
        ...location,
        subjectId: null,
        message: `${placement.pageNumber}ページの生成履歴を確認できません。画像を再生成するか、採用し直してください。`,
      });
      continue;
    }
    const panelAssignments = assignments.get(
      `${placement.pageId}:${placement.panelId}`,
    ) ?? [];
    if (
      panelAssignments.length === 0 &&
      job.characterVersions.size === 0 &&
      job.worldVersions.size === 0
    ) {
      issues.push({
        code: "subject_assignment_missing",
        severity: "info",
        ...location,
        subjectId: null,
        message: `${placement.pageNumber}ページのコマには固定する人物・場所・小物がありません。継続登場する対象がある場合は参照画像画面で割り当ててください。`,
      });
    }
    const panelSubjects = new Map<string, ContinuitySubjectKind>();
    for (const assignment of panelAssignments)
      panelSubjects.set(assignment.subjectId, assignment.kind);
    for (const subjectId of job.characterVersions.keys())
      panelSubjects.set(subjectId, "character");
    for (const [subjectId, version] of job.worldVersions)
      panelSubjects.set(subjectId, version.kind);
    for (const [subjectId] of panelSubjects) {
      const subject = subjects.get(subjectId);
      if (!subject) {
        issues.push({
          code: "subject_profile_missing",
          severity: "warning",
          ...location,
          subjectId,
          message: `${placement.pageNumber}ページの割当先設定が見つかりません。参照画像画面で割当を更新してください。`,
        });
        continue;
      }
      const version = subjectVersion(job, subject);
      if (!version) {
        issues.push({
          code: "subject_version_missing",
          severity: "warning",
          ...location,
          subjectId: subject.id,
          message: `${placement.pageNumber}ページの「${subject.name}」は固定設定を使わずに生成されています。設定を反映して再生成してください。`,
        });
      } else {
        const versions = usedVersions.get(subject.id) ?? new Set<number>();
        versions.add(version);
        usedVersions.set(subject.id, versions);
        if (version !== subject.currentVersion)
          issues.push({
            code: "subject_version_outdated",
            severity: "warning",
            ...location,
            subjectId: subject.id,
            message: `${placement.pageNumber}ページの「${subject.name}」は設定v${version}で生成されています。現在のv${subject.currentVersion}を反映して再生成してください。`,
          });
      }
      if (
        subject.referenceAssetIds.length > 0 &&
        !subject.referenceAssetIds.some((id) => job.referenceAssetIds.has(id))
      )
        issues.push({
          code: "subject_reference_missing",
          severity: "warning",
          ...location,
          subjectId: subject.id,
          message: `${placement.pageNumber}ページの「${subject.name}」は登録済み参照画像を使わずに生成されています。参照画像を反映して再生成してください。`,
        });
    }
    if (input.style) {
      if (!job.styleVersion || job.styleVersion.bibleId !== input.style.id)
        issues.push({
          code: "style_version_missing",
          severity: "warning",
          ...location,
          subjectId: input.style.id,
          message: `${placement.pageNumber}ページは作品の画風設定を使わずに生成されています。画風設定を反映して再生成してください。`,
        });
      else if (job.styleVersion.version !== input.style.currentVersion)
        issues.push({
          code: "style_version_outdated",
          severity: "warning",
          ...location,
          subjectId: input.style.id,
          message: `${placement.pageNumber}ページは画風設定v${job.styleVersion.version}で生成されています。現在のv${input.style.currentVersion}を反映して再生成してください。`,
        });
      if (
        input.style.referenceAssetIds.length > 0 &&
        !input.style.referenceAssetIds.some((id) => job.referenceAssetIds.has(id))
      )
        issues.push({
          code: "style_reference_missing",
          severity: "warning",
          ...location,
          subjectId: input.style.id,
          message: `${placement.pageNumber}ページは登録済み画風参照画像を使わずに生成されています。参照画像を反映して再生成してください。`,
        });
    }
  }
  for (const [subjectId, versions] of usedVersions) {
    if (versions.size < 2) continue;
    const subject = subjects.get(subjectId);
    issues.push({
      code: "mixed_subject_versions",
      severity: "warning",
      pageId: null,
      pageNumber: null,
      panelId: null,
      subjectId,
      message: `「${subject?.name ?? "固定対象"}」が複数の設定版（${[...versions].sort((a, b) => a - b).map((version) => `v${version}`).join("・")}）で生成されています。作品内で使用版を統一してください。`,
    });
  }
  for (let firstIndex = 0; firstIndex < input.placements.length; firstIndex += 1) {
    const first = input.placements[firstIndex];
    if (!first.assetId) continue;
    for (let secondIndex = firstIndex + 1; secondIndex < input.placements.length; secondIndex += 1) {
      const second = input.placements[secondIndex];
      if (!second.assetId || Math.abs(first.pageNumber - second.pageNumber) > 1)
        continue;
      const sameAsset = first.assetId === second.assetId;
      const sameDigest = Boolean(
        !sameAsset &&
          first.assetSha256 &&
          second.assetSha256 &&
          first.assetSha256 === second.assetSha256,
      );
      if (!sameAsset && !sameDigest) continue;
      visualCandidates.push({
        code: sameAsset ? "duplicate_asset" : "duplicate_digest",
        first: {
          pageId: first.pageId,
          pageNumber: first.pageNumber,
          panelId: first.panelId,
          assetId: first.assetId,
        },
        second: {
          pageId: second.pageId,
          pageNumber: second.pageNumber,
          panelId: second.panelId,
          assetId: second.assetId,
        },
        message: `${first.pageNumber}ページと${second.pageNumber}ページの採用画像が完全一致しています。意図した再利用か、人物・場面・構図の連続性を目視確認してください。`,
      });
    }
  }
  return {
    generatedPanelCount: input.placements.length,
    reviewedPanelCount: input.placements.filter((placement) =>
      Boolean(parseJobInput(placement.jobInput)),
    ).length,
    warningCount: issues.filter((issue) => issue.severity === "warning").length,
    infoCount: issues.filter((issue) => issue.severity === "info").length,
    issues,
    visualCandidateCount: visualCandidates.length,
    visualCandidates,
  };
}
