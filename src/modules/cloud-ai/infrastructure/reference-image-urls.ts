import { AIProviderError } from "@mangai/ai-core";

/** DB rows are already restricted to the Job's owner and project by the caller. */
export async function resolveReferenceImageUrls(
  assetIds: readonly string[],
  assets: readonly { id: string; storage_path: string }[],
  sign: (storagePath: string) => Promise<string | null>,
) {
  const byId = new Map(assets.map((asset) => [asset.id, asset.storage_path]));
  if (new Set(assetIds).size !== assetIds.length || byId.size !== assetIds.length || assets.length !== assetIds.length)
    throw new AIProviderError("provider_rejected", "参照画像を確認できませんでした。", false);
  const urls: string[] = [];
  for (const id of assetIds) {
    const path = byId.get(id);
    if (!path) throw new AIProviderError("provider_rejected", "参照画像を準備できませんでした。", false);
    const url = await sign(path);
    if (!url) throw new AIProviderError("provider_rejected", "参照画像を準備できませんでした。", false);
    urls.push(url);
  }
  return urls;
}
