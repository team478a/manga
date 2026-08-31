import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

export type AdultPilotArtifact = {
  id: "checkpoint" | "vae" | "controlnet";
  fileName: string;
  directory: "checkpoints" | "vae" | "controlnet";
  sourceUrl: string;
  bytes: number;
  sha256: string;
};

export const ADULT_PILOT_ARTIFACTS: readonly AdultPilotArtifact[] = [
  {
    id: "checkpoint",
    fileName: "sd_xl_base_1.0.safetensors",
    directory: "checkpoints",
    sourceUrl: "https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/462165984030d82259a11f4367a4eed129e94a7b/sd_xl_base_1.0.safetensors",
    bytes: 6_938_078_334,
    sha256: "31e35c80fc4829d14f90153f4c74cd59c90b779f6afe05a74cd6120b893f7e5b",
  },
  {
    id: "vae",
    fileName: "sdxl.vae.safetensors",
    directory: "vae",
    sourceUrl: "https://huggingface.co/madebyollin/sdxl-vae-fp16-fix/resolve/207b116dae70ace3637169f1ddd2434b91b3a8cd/sdxl.vae.safetensors",
    bytes: 334_641_162,
    sha256: "235745af8d86bf4a4c1b5b4f529868b37019a10f7c0b2e79ad0abca3a22bc6e1",
  },
  {
    id: "controlnet",
    fileName: "diffusion_pytorch_model.safetensors",
    directory: "controlnet",
    sourceUrl: "https://huggingface.co/diffusers/controlnet-canny-sdxl-1.0/resolve/eb115a19a10d14909256db740ed109532ab1483c/diffusion_pytorch_model.safetensors",
    bytes: 5_004_167_864,
    sha256: "ea99040544a999f814fd854575a3aee069a005d026864c8d321b82576706a221",
  },
];

const redirectHosts = new Set([
  "huggingface.co",
  "cdn-lfs.huggingface.co",
  "cas-bridge.xethub.hf.co",
]);
const reserveBytes = 8 * 1024 ** 3;

export type AdultPilotDownloadResult = {
  artifactId: AdultPilotArtifact["id"];
  filePath: string;
  bytes: number;
  sha256: string;
  resumedFrom: number;
};

type DownloaderOptions = {
  fetcher?: typeof fetch;
  freeBytes?: (directory: string) => number;
  artifacts?: readonly AdultPilotArtifact[];
};

const hashFile = async (file: string) => {
  const hash = crypto.createHash("sha256");
  await pipeline(fs.createReadStream(file), hash);
  return hash.digest("hex");
};

const assertAllowedDownloadUrl = (value: string) => {
  const url = new URL(value);
  if (url.protocol !== "https:" || !redirectHosts.has(url.hostname))
    throw new Error("成人向けPilotの取得先は許可された公式HTTPS配布元に限定されています。");
  return url;
};

const defaultFreeBytes = (directory: string) => {
  const stats = fs.statfsSync(directory);
  return stats.bavail * stats.bsize;
};

export class AdultPilotDownloader {
  private readonly fetcher: typeof fetch;
  private readonly freeBytes: (directory: string) => number;
  private readonly artifacts: readonly AdultPilotArtifact[];

  constructor(options: DownloaderOptions = {}) {
    this.fetcher = options.fetcher ?? fetch;
    this.freeBytes = options.freeBytes ?? defaultFreeBytes;
    this.artifacts = options.artifacts ?? ADULT_PILOT_ARTIFACTS;
  }

  private artifact(id: AdultPilotArtifact["id"]) {
    const artifact = this.artifacts.find((item) => item.id === id);
    if (!artifact) throw new Error("固定済みでないartifactは取得できません。");
    assertAllowedDownloadUrl(artifact.sourceUrl);
    return artifact;
  }

  private destination(root: string, artifact: AdultPilotArtifact) {
    if (!path.isAbsolute(root)) throw new Error("保存先は絶対pathで指定してください。");
    fs.mkdirSync(root, { recursive: true });
    const realRoot = fs.realpathSync(root);
    const directory = path.join(realRoot, "models", artifact.directory);
    fs.mkdirSync(directory, { recursive: true });
    const realDirectory = fs.realpathSync(directory);
    if (!realDirectory.startsWith(`${realRoot}${path.sep}`))
      throw new Error("保存先がローカルAI領域の外を参照しています。");
    return path.join(realDirectory, artifact.fileName);
  }

  private async fetchWithSafeRedirects(url: string, start: number, signal?: AbortSignal) {
    let current = assertAllowedDownloadUrl(url);
    for (let redirects = 0; redirects <= 5; redirects += 1) {
      const response = await this.fetcher(current, {
        headers: start ? { Range: `bytes=${start}-` } : undefined,
        redirect: "manual",
        signal,
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) return response;
      const location = response.headers.get("location");
      if (!location) throw new Error("公式配布元のredirect先を確認できません。");
      current = assertAllowedDownloadUrl(new URL(location, current).toString());
    }
    throw new Error("公式配布元のredirect回数が上限を超えました。");
  }

  async download(
    root: string,
    id: AdultPilotArtifact["id"],
    signal?: AbortSignal,
  ): Promise<AdultPilotDownloadResult> {
    const artifact = this.artifact(id);
    const destination = this.destination(root, artifact);
    const partial = `${destination}.partial`;
    const existing = fs.statSync(partial, { throwIfNoEntry: false })?.size ?? 0;
    if (existing > artifact.bytes) fs.truncateSync(partial, 0);
    let resumedFrom = existing > artifact.bytes ? 0 : existing;
    if (resumedFrom === artifact.bytes) {
      const sha256 = await hashFile(partial);
      if (sha256 === artifact.sha256) {
        fs.renameSync(partial, destination);
        return { artifactId: id, filePath: destination, bytes: artifact.bytes, sha256, resumedFrom };
      }
      fs.truncateSync(partial, 0);
      resumedFrom = 0;
    }
    const required = artifact.bytes - resumedFrom + reserveBytes;
    if (this.freeBytes(path.dirname(destination)) < required)
      throw new Error("保存先の空き容量が不足しています。別ドライブを選択してください。");
    const response = await this.fetchWithSafeRedirects(
      artifact.sourceUrl,
      resumedFrom,
      signal,
    );
    if (!response.ok || !response.body)
      throw new Error("公式配布元からartifactを取得できませんでした。");
    const append = resumedFrom > 0 && response.status === 206;
    if (resumedFrom > 0 && !append) {
      if (this.freeBytes(path.dirname(destination)) < artifact.bytes + reserveBytes)
        throw new Error("保存先の空き容量が不足しています。別ドライブを選択してください。");
      fs.truncateSync(partial, 0);
    }
    await pipeline(
      Readable.fromWeb(response.body as never),
      fs.createWriteStream(partial, { flags: append ? "a" : "w", mode: 0o600 }),
    );
    const actualBytes = fs.statSync(partial).size;
    if (actualBytes !== artifact.bytes)
      throw new Error("取得したartifactの容量が固定値と一致しません。");
    const sha256 = await hashFile(partial);
    if (sha256 !== artifact.sha256)
      throw new Error("取得したartifactのSHA-256が固定値と一致しません。");
    fs.renameSync(partial, destination);
    return { artifactId: id, filePath: destination, bytes: actualBytes, sha256, resumedFrom: append ? resumedFrom : 0 };
  }
}
