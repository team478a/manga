import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { once } from "node:events";
import * as yauzl from "yauzl";
import {
  assertBulkOperationActive,
  type BulkOperationOptions,
} from "./backup-operation.js";

const maxBackupBytes = 2 * 1024 * 1024 * 1024;
const maxBackupManifestBytes = 50 * 1024 * 1024;
const maxBackupEntries = 20_000;
const maxBackupCompressionRatio = 200;

type RestorableManifest = {
  bundle: {
    assets: Array<{
      id: string;
      fileName: string;
      byteSize: number;
      sha256: string;
    }>;
  };
};

async function readZipEntry(
  zip: yauzl.ZipFile,
  entry: yauzl.Entry,
  maximumBytes: number,
  signal?: AbortSignal,
) {
  if (entry.uncompressedSize > maximumBytes)
    throw new Error("バックアップ情報が大きすぎます。");
  const stream = await zip.openReadStreamPromise(entry);
  const chunks: Buffer[] = [];
  let byteSize = 0;
  for await (const chunk of stream) {
    assertBulkOperationActive(signal);
    const bytes = chunk as Buffer;
    byteSize += bytes.length;
    if (byteSize > maximumBytes) {
      stream.destroy();
      throw new Error("バックアップ情報が大きすぎます。");
    }
    chunks.push(bytes);
  }
  return Buffer.concat(chunks, byteSize);
}

async function extractZipEntry(
  zip: yauzl.ZipFile,
  entry: yauzl.Entry,
  destination: string,
  expected: { byteSize: number; sha256: string },
  signal?: AbortSignal,
) {
  const input = await zip.openReadStreamPromise(entry);
  const output = fs.createWriteStream(destination, {
    flags: "wx",
    mode: 0o600,
  });
  const hash = crypto.createHash("sha256");
  let byteSize = 0;
  try {
    for await (const chunk of input) {
      assertBulkOperationActive(signal);
      const bytes = chunk as Buffer;
      byteSize += bytes.length;
      if (byteSize > expected.byteSize) {
        input.destroy();
        throw new Error("素材の展開サイズが不正です。");
      }
      hash.update(bytes);
      if (!output.write(bytes)) await once(output, "drain");
    }
    output.end();
    await once(output, "close");
  } catch (error) {
    input.destroy();
    output.destroy();
    if (fs.existsSync(destination)) fs.rmSync(destination, { force: true });
    throw error;
  }
  if (
    byteSize !== expected.byteSize ||
    hash.digest("hex") !== expected.sha256
  ) {
    fs.rmSync(destination, { force: true });
    throw new Error("素材が破損しています。");
  }
}

export class BackupReader {
  async read<T extends RestorableManifest>(input: {
    source: string;
    projectsRoot: string;
    parseManifest: (value: unknown) => T;
    options?: BulkOperationOptions;
  }) {
    const stat = fs.statSync(input.source);
    if (!stat.isFile() || stat.size <= 0 || stat.size > maxBackupBytes)
      throw new Error("バックアップファイルのサイズが不正です。");
    assertBulkOperationActive(input.options?.signal);
    fs.mkdirSync(input.projectsRoot, { recursive: true });
    const stagingDirectory = fs.mkdtempSync(
      path.join(input.projectsRoot, ".restore-"),
    );
    const stagedAssetsDirectory = path.join(stagingDirectory, "assets");
    fs.mkdirSync(stagedAssetsDirectory);
    let zip: yauzl.ZipFile | undefined;
    try {
      zip = await yauzl.openPromise(input.source, {
        lazyEntries: true,
        autoClose: false,
        validateEntrySizes: true,
        strictFileNames: true,
      });
      if (zip.entryCount > maxBackupEntries)
        throw new Error("バックアップのファイル数が上限を超えています。");
      const entries = new Map<string, yauzl.Entry>();
      let expandedBytes = 0;
      for await (const entry of zip.eachEntry()) {
        assertBulkOperationActive(input.options?.signal);
        const fileName = entry.fileName;
        if (
          fileName.includes("\\") ||
          fileName.startsWith("/") ||
          fileName.split("/").includes("..") ||
          entries.has(fileName)
        )
          throw new Error("バックアップ内のファイル名が不正です。");
        expandedBytes += entry.uncompressedSize;
        if (
          !Number.isSafeInteger(expandedBytes) ||
          expandedBytes > maxBackupBytes
        )
          throw new Error("展開後の合計サイズが上限を超えています。");
        if (
          entry.uncompressedSize > 1024 * 1024 &&
          entry.uncompressedSize / Math.max(1, entry.compressedSize) >
            maxBackupCompressionRatio
        )
          throw new Error("異常な圧縮率のバックアップは復元できません。");
        entries.set(fileName, entry);
      }
      const manifestEntry = entries.get("manifest.json");
      if (!manifestEntry) throw new Error("バックアップ情報がありません。");
      const manifestBytes = await readZipEntry(
        zip,
        manifestEntry,
        maxBackupManifestBytes,
        input.options?.signal,
      );
      let manifest: T;
      try {
        manifest = input.parseManifest(
          JSON.parse(manifestBytes.toString("utf8")),
        );
      } catch (error) {
        if (
          error instanceof Error &&
          error.message !== "Unexpected end of JSON input" &&
          error.name !== "SyntaxError"
        )
          throw error;
        throw new Error("バックアップ情報を読み取れません。");
      }
      const expectedAssetBytes = manifest.bundle.assets.reduce(
        (total, asset) => total + asset.byteSize,
        0,
      );
      if (
        !Number.isSafeInteger(expectedAssetBytes) ||
        expectedAssetBytes + manifestBytes.length > maxBackupBytes
      )
        throw new Error("展開後の素材サイズが上限を超えています。");
      for (const [index, asset] of manifest.bundle.assets.entries()) {
        assertBulkOperationActive(input.options?.signal);
        const entry = entries.get(`assets/${asset.id}`);
        if (!entry) throw new Error(`素材「${asset.fileName}」がありません。`);
        if (entry.uncompressedSize !== asset.byteSize)
          throw new Error(`素材「${asset.fileName}」が破損しています。`);
        try {
          await extractZipEntry(
            zip,
            entry,
            path.join(stagedAssetsDirectory, asset.id),
            asset,
            input.options?.signal,
          );
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError")
            throw error;
          throw new Error(`素材「${asset.fileName}」が破損しています。`);
        }
        input.options?.onProgress?.({
          phase: "extracting",
          completed: index + 1,
          total: manifest.bundle.assets.length,
        });
      }
      zip.close();
      return { manifest, stagingDirectory, stagedAssetsDirectory };
    } catch (error) {
      zip?.close();
      fs.rmSync(stagingDirectory, { recursive: true, force: true });
      throw error;
    }
  }
}
