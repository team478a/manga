import fs from "node:fs";

export const acceptanceStatuses = new Set([
  "pending",
  "passed",
  "blocked",
  "waived",
]);

const isDate = (value) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

export const readAcceptanceRecord = (filePath) => {
  const document = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const errors = [];

  if (document.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (typeof document.releaseVersion !== "string" || !document.releaseVersion)
    errors.push("releaseVersion is required");
  if (!isDate(document.updatedAt)) errors.push("updatedAt must use YYYY-MM-DD");
  if (
    !Array.isArray(document.requirements) ||
    document.requirements.length === 0
  )
    errors.push("requirements must be a non-empty array");

  const ids = new Set();
  for (const [index, requirement] of (document.requirements ?? []).entries()) {
    const prefix = `requirements[${index}]`;
    if (typeof requirement.id !== "string" || !requirement.id)
      errors.push(`${prefix}.id is required`);
    else if (ids.has(requirement.id))
      errors.push(`${prefix}.id is duplicated: ${requirement.id}`);
    else ids.add(requirement.id);

    if (typeof requirement.label !== "string" || !requirement.label)
      errors.push(`${prefix}.label is required`);
    if (!acceptanceStatuses.has(requirement.status))
      errors.push(`${prefix}.status is invalid`);

    if (requirement.status === "passed") {
      if (!isDate(requirement.completedAt))
        errors.push(`${prefix}.completedAt is required for passed status`);
      if (typeof requirement.verifier !== "string" || !requirement.verifier)
        errors.push(`${prefix}.verifier is required for passed status`);
      if (
        !Array.isArray(requirement.evidence) ||
        requirement.evidence.length === 0
      )
        errors.push(`${prefix}.evidence is required for passed status`);
      else if (
        requirement.evidence.some(
          (item) => typeof item !== "string" || item.trim().length === 0,
        )
      )
        errors.push(`${prefix}.evidence must contain non-empty strings`);
    }

    if (
      requirement.status === "blocked" &&
      (typeof requirement.reason !== "string" || !requirement.reason)
    )
      errors.push(`${prefix}.reason is required for blocked status`);
    if (requirement.status === "waived") {
      if (typeof requirement.reason !== "string" || !requirement.reason)
        errors.push(`${prefix}.reason is required for waived status`);
      if (typeof requirement.approvedBy !== "string" || !requirement.approvedBy)
        errors.push(`${prefix}.approvedBy is required for waived status`);
      if (!isDate(requirement.completedAt))
        errors.push(`${prefix}.completedAt is required for waived status`);
    }
  }

  return { document, errors };
};

export const summarizeAcceptance = (document) => {
  const counts = { pending: 0, passed: 0, blocked: 0, waived: 0 };
  for (const requirement of document.requirements ?? [])
    if (acceptanceStatuses.has(requirement.status))
      counts[requirement.status] += 1;
  return {
    counts,
    complete: counts.pending === 0 && counts.blocked === 0,
    total: Object.values(counts).reduce((sum, count) => sum + count, 0),
  };
};
