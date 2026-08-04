import type { CloudResearchReport } from "../contracts/research-output.ts";

export function toResearchReportSummary(report: CloudResearchReport) {
  return {
    id: report.id,
    createdAt: report.created_at,
    completedAt: report.completed_at,
    genre: report.input.genre,
    platform: report.input.platform,
    contentClass: report.input.contentClass,
    status: report.status,
  } as const;
}
