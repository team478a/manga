/** Pinned local provider contract; changes require a separately reviewed model update. */
export function cloudImageReferenceCapacity(model: string) {
  if (model === "flux-pro-1.0-fill") return 1;
  return model === "flux-2-klein-9b" ? 4 : 8;
}
