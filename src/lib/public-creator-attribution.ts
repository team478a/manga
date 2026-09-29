export type PublicWorkCreatorAttribution = {
  work_id: string;
  display_name: string;
};

export function mapPublicWorkCreatorAttributions(
  rows: PublicWorkCreatorAttribution[] | null | undefined,
) {
  return new Map(
    (rows ?? [])
      .filter(
        (row) =>
          typeof row.work_id === "string" &&
          typeof row.display_name === "string" &&
          row.display_name.trim().length > 0,
      )
      .map((row) => [row.work_id, row.display_name.trim()]),
  );
}

export function publicCreatorName(
  rows: PublicWorkCreatorAttribution[] | null | undefined,
  workId: string | null | undefined,
) {
  if (!workId) return "クリエイター";
  return mapPublicWorkCreatorAttributions(rows).get(workId) ?? "クリエイター";
}
