import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import * as yazl from "yazl";
import {
  assertBulkOperationActive,
  bulkOperationAbortError,
  type BulkOperationOptions,
} from "./backup-operation.js";

const maxBackupBytes = 2 * 1024 * 1024 * 1024;
const maxBackupManifestBytes = 50 * 1024 * 1024;
const maxBackupEntries = 20_000;

type BackupAsset = {
  id: string;
  fileName: string;
  relativePath: string;
  byteSize: number;
  sha256: string;
};

async function sha256File(filePath: string, signal?: AbortSignal) {
  const hash = crypto.createHash("sha256");
  let byteSize = 0;
  for await (const chunk of fs.createReadStream(filePath)) {
    assertBulkOperationActive(signal);
    const bytes = chunk as Buffer;
    byteSize += bytes.length;
    hash.update(bytes);
  }
  return { byteSize, sha256: hash.digest("hex") };
}

export class BackupWriter {
  async write(input: {
    manifest: unknown;
    assets: BackupAsset[];
    storagePath: string;
    destination: string;
    resolveProjectPath: (storagePath: string, relativePath: string) => string;
    options?: BulkOperationOptions;
  }) {
    const manifestBytes = Buffer.from(JSON.stringify(input.manifest));
    if (manifestBytes.length > maxBackupManifestBytes)
      throw new Error("バックアップ情報が大きすぎます。");
    if (input.assets.length + 1 > maxBackupEntries)
      throw new Error("バックアップのファイル数が上限を超えています。");

    let expandedBytes = manifestBytes.length;
    for (const [index, asset] of input.assets.entries()) {
      assertBulkOperationActive(input.options?.signal);
      const source = input.resolveProjectPath(
        input.storagePath,
        asset.relativePath,
      );
      if (!fs.existsSync(source))
        throw new Error(`素材「${asset.fileName}」が見つかりません。`);
      const verified = await sha256File(source, input.options?.signal);
      expandedBytes += verified.byteSize;
      if (expandedBytes > maxBackupBytes)
        throw new Error("バックアップ対象の合計サイズが上限を超えています。");
      if (
        verified.byteSize !== asset.byteSize ||
        verified.sha256 !== asset.sha256
      )
        throw new Error(`素材「${asset.fileName}」の整合性を確認できません。`);
      input.options?.onProgress?.({
        phase: "validating",
        completed: index + 1,
        total: input.assets.length,
      });
    }

    fs.mkdirSync(path.dirname(input.destination), { recursive: true });
    const temporary = `${input.destination}.${process.pid}.partial`;
    const zip = new yazl.ZipFile();
    zip.addBuffer(manifestBytes, "manifest.json", { compressionLevel: 6 });
    for (const asset of input.assets)
      zip.addFile(
        input.resolveProjectPath(input.storagePath, asset.relativePath),
        `assets/${asset.id}`,
        { compressionLevel: 6 },
      );
    const output = fs.createWriteStream(temporary, {
      flags: "wx",
      mode: 0o600,
    });
    const abort = () => {
      const error = bulkOperationAbortError();
      (
        zip.outputStream as NodeJS.ReadableStream & {
          destroy(error: Error): void;
        }
      ).destroy(error);
      output.destroy(error);
    };
    input.options?.signal?.addEventListener("abort", abort, { once: true });
    try {
      const completed = new Promise<void>((resolve, reject) => {
        zip.outputStream.once("error", reject);
        output.once("error", reject);
        output.once("close", resolve);
      });
      zip.outputStream.pipe(output);
      zip.end();
      await completed;
      assertBulkOperationActive(input.options?.signal);
      if (fs.existsSync(input.destination)) fs.rmSync(input.destination);
      fs.renameSync(temporary, input.destination);
    } finally {
      input.options?.signal?.removeEventListener("abort", abort);
      output.destroy();
      if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
    }
    input.options?.onProgress?.({
      phase: "writing",
      completed: input.assets.length,
      total: input.assets.length,
    });
    return {
      filePath: input.destination,
      byteSize: fs.statSync(input.destination).size,
    };
  }
}
