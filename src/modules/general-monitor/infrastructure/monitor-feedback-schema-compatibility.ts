type DatabaseErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

export function isMissingMonitorFeedbackSchema(
  error: DatabaseErrorLike | null | undefined,
) {
  if (!error) return false;
  if (error.code === "PGRST204" || error.code === "42703") return true;
  const summary = [error.message, error.details, error.hint]
    .filter(Boolean)
    .join(" ");
  return /column .* does not exist|could not find .* column/i.test(summary);
}

export function legacyMonitorFeedbackComment(input: {
  requestType: "feedback" | "bug" | "improvement" | "feature_request";
  title: string;
  severity: "none" | "minor" | "major" | "blocked";
  comment: string;
  attachmentOmitted?: boolean;
}) {
  const header = `[${input.requestType}/${input.severity}] ${input.title}`;
  const attachment = input.attachmentOmitted
    ? "\n（添付画像は保存されませんでした）"
    : "";
  return `${header}\n${input.comment}${attachment}`.slice(0, 2000);
}

export function legacyQualityFeedbackComment(input: {
  verdict: "accepted" | "needs_revision" | "unusable";
  issueType: string;
  severity: "none" | "minor" | "major" | "blocked";
  pageNumber: number;
  panelName: string | null;
  comment: string;
}) {
  const target = input.panelName
    ? `${input.pageNumber}ページ/${input.panelName}`
    : `${input.pageNumber}ページ全体`;
  return `[品質評価 ${target} ${input.verdict}/${input.issueType}/${input.severity}]\n${input.comment}`.slice(
    0,
    2000,
  );
}
