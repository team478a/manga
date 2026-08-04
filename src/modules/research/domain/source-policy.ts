export const isHttpsResearchSource = (value: string) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

export const areDistinctResearchSources = (left: string, right: string) => {
  if (!isHttpsResearchSource(left) || !isHttpsResearchSource(right))
    return false;
  const first = new URL(left);
  const second = new URL(right);
  first.hash = "";
  second.hash = "";
  return first.toString() !== second.toString();
};
