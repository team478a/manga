const uuid = (value) => `30000000-0000-4000-8000-${String(value).padStart(12, "0")}`;

const finding = (category, status, panelIndex, suggestion, region = null) => ({
  status,
  category,
  reason: `${category} fixture ${status}`,
  region,
  confidence: status === "NOT_EVALUATED" ? null : 0.99,
  suggestion,
  evidence: { source: "fixed_acceptance_fixture" },
});

export function makeQualityInspectionAcceptanceFixture() {
  const panels = Array.from({ length: 6 }, (_, offset) => {
    const index = offset + 1;
    return {
      panelId: uuid(10 + index),
      assetIds: [uuid(100 + index * 2), uuid(101 + index * 2)],
      selectedAssetId: uuid(101 + index * 2),
      candidateIds: [uuid(200 + index * 2), uuid(201 + index * 2)],
    };
  });
  const intentional = new Map([
    [1, finding("character_count", "FAIL", 1, "regenerate_panel", { kind: "rectangle", x: 0.05, y: 0.05, width: 0.9, height: 0.9 })],
    [3, finding("costume", "FAIL", 3, "update_reference", { kind: "rectangle", x: 0.2, y: 0.15, width: 0.6, height: 0.75 })],
    [5, finding("text_layout", "FAIL", 5, "edit_text", { kind: "rectangle", x: 0.68, y: 0.08, width: 0.25, height: 0.84 })],
  ]);
  const runs = panels.map((panel, offset) => ({
    schemaVersion: 1,
    evaluator: { id: "mangai-p3f-fixed-fixture", version: "1", kind: "hybrid", dataHandling: "none" },
    provenance: { projectId: uuid(1), pageId: uuid(2), panelId: panel.panelId, assetId: panel.selectedAssetId, generationJobId: uuid(300 + offset), panelDesignRevision: 2 },
    findings: [
      intentional.get(offset + 1) ?? finding("continuity", "PASS", offset + 1, "review"),
      finding("anatomy", "NOT_EVALUATED", offset + 1, "review"),
    ],
  }));
  const qualityRows = panels.map((panel, offset) => ({
    projectId: uuid(1), pageId: uuid(2), panelId: panel.panelId, generationJobId: uuid(300 + offset), candidateId: panel.candidateIds[1],
    providerId: "fixture-provider", modelId: "fixture-model", generationMode: "text_to_image",
    candidateDisplayed: offset !== 5, candidateSelected: offset < 3, selectedAt: offset < 3 ? "2026-08-25T00:00:00.000Z" : null,
    rejectedAt: offset >= 3 ? "2026-08-25T00:01:00.000Z" : null, rejectedReason: offset === 5 ? "generation_failed" : null,
    repaired: offset === 2, repairType: offset === 2 ? "costume" : null, retryCount: offset === 2 ? 1 : 0,
    qualityScoreOverall: null, qualityScoreCharacter: null, qualityScoreComposition: null, qualityScoreExpression: null, qualityScoreBackground: null, qualityScoreContinuity: null,
    failureCategories: offset === 0 ? ["wrong_character_count"] : offset === 2 ? ["continuity_break"] : offset === 4 ? ["text_area_collision"] : [],
    reservedCredits: 2, finalizedCredits: offset === 5 ? null : 2, generationLatencyMs: offset === 5 ? null : 1000 + offset * 100,
    evaluationLatencyMs: offset === 5 ? null : 200, actualCostMicros: offset === 5 ? null : 30000 + offset * 1000,
  }));
  return { panels, runs, qualityRows };
}

export function preparePanelRepair(fixture, panelId) {
  const before = structuredClone(fixture);
  const run = fixture.runs.find((item) => item.provenance.panelId === panelId);
  const repairable = run?.findings.filter((item) => item.status === "FAIL" || item.status === "WARNING") ?? [];
  return { before, after: structuredClone(fixture), panelId, repairable };
}
