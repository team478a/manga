import { inspectionRunSchema, type InspectionFinding, type InspectionRun } from "../domain/inspection-finding.ts";

type ManuscriptIssue = { code: string; message: string; panelId: string | null };
type ContinuityIssue = { code: string; message: string; panelId: string | null };

const rule = (category: InspectionFinding["category"], reason: string): InspectionFinding => ({ status: "PASS", category, reason, region: null, confidence: 1, suggestion: "review", evidence: { source: "rule" } });
const notEvaluated = (category: InspectionFinding["category"], reason: string, suggestion: InspectionFinding["suggestion"]): InspectionFinding => ({ status: "NOT_EVALUATED", category, reason, region: null, confidence: null, suggestion, evidence: { source: "rule", evaluated: false } });

const manuscriptMappings: Record<string, Pick<InspectionFinding, "status" | "category" | "suggestion">> = {
  empty_panel: { status: "FAIL", category: "image_availability", suggestion: "regenerate_panel" },
  missing_asset: { status: "FAIL", category: "image_availability", suggestion: "regenerate_panel" },
  low_resolution: { status: "WARNING", category: "image_resolution", suggestion: "regenerate_panel" },
  text_overflow: { status: "FAIL", category: "text_layout", suggestion: "edit_text" },
  text_layout: { status: "FAIL", category: "text_layout", suggestion: "edit_text" },
};

export function buildDeterministicInspection(input: {
  projectId: string; pageId: string; panelId: string; assetId: string | null; generationJobId: string | null;
  panelDesignRevision: number | null; manuscriptIssues: ManuscriptIssue[]; continuityIssues: ContinuityIssue[];
}): InspectionRun {
  const findings = new Map<InspectionFinding["category"], InspectionFinding>([
    ["image_availability", rule("image_availability", "採用画像を参照できます。")],
    ["image_resolution", rule("image_resolution", "画像解像度のrule検査を通過しました。")],
    ["text_layout", rule("text_layout", "文字切れと短い縦書きのrule検査を通過しました。")],
  ]);
  for (const issue of input.manuscriptIssues) {
    if (issue.panelId && issue.panelId !== input.panelId) continue;
    const mapping = manuscriptMappings[issue.code];
    if (mapping) findings.set(mapping.category, { ...mapping, reason: issue.message, region: null, confidence: 1, evidence: { source: "manuscript_preflight", code: issue.code } });
  }
  const relevantContinuity = input.continuityIssues.filter((issue) => !issue.panelId || issue.panelId === input.panelId);
  findings.set("continuity", relevantContinuity.length
    ? { status: "WARNING", category: "continuity", reason: relevantContinuity.map((issue) => issue.message).join(" / ").slice(0, 500), region: null, confidence: 1, suggestion: relevantContinuity.some((issue) => issue.code.includes("reference")) ? "update_reference" : "update_design", evidence: { source: "continuity_review", codes: relevantContinuity.map((issue) => issue.code) } }
    : rule("continuity", "保存済み設定と生成追跡の連続性rule検査を通過しました。"));
  for (const category of ["character_count", "character_identity", "hair", "costume", "body_build", "anatomy", "background", "prop", "orientation", "gaze", "dialogue_speaker", "reading_order", "composition_duplicate"] as const)
    findings.set(category, notEvaluated(category, "画像または意味照合のruntime evaluatorを実行していません。", category === "dialogue_speaker" || category === "reading_order" ? "edit_text" : "review"));
  return inspectionRunSchema.parse({ schemaVersion: 1, evaluator: { id: "mangai-deterministic-rules", version: "1", kind: "rule", dataHandling: "none" }, provenance: { projectId: input.projectId, pageId: input.pageId, panelId: input.panelId, assetId: input.assetId, generationJobId: input.generationJobId, panelDesignRevision: input.panelDesignRevision }, findings: [...findings.values()] });
}
