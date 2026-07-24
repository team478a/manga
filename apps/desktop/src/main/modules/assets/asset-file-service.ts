import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { imageSize } from "image-size";

const supportedMimeTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export type AssetFileIdentity = {
  id: string;
  relativePath: string;
  byteSize: number;
  sha256: string;
};

export class AssetFileService {
  inspectImport(source: string) {
    const extension = path.extname(source).toLowerCase();
    const mimeType = supportedMimeTypes[extension];
    if (!mimeType) return null;
    const bytes = fs.readFileSync(source);
    const dimensions = imageSize(bytes);
    return {
      source,
      extension,
      fileName: path.basename(source),
      mimeType,
      width: dimensions.width || 0,
      height: dimensions.height || 0,
      byteSize: bytes.length,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    };
  }

  copyIntoProject(
    storagePath: string,
    source: string,
    assetId: string,
    extension: string,
  ) {
    const directory = path.join(storagePath, "assets");
    fs.mkdirSync(directory, { recursive: true });
    const destination = path.join(directory, `${assetId}${extension}`);
    fs.copyFileSync(source, destination);
    return {
      destination,
      relativePath: path.relative(storagePath, destination),
    };
  }

  removeCopiedFile(filePath: string) {
    fs.rmSync(filePath, { force: true });
  }

  moveToHistoryTrash(storagePath: string, asset: AssetFileIdentity) {
    const source = this.safeProjectPath(storagePath, asset.relativePath);
    const trash = path.join(
      storagePath,
      ".trash",
      `asset-${asset.id}-${path.basename(asset.relativePath)}`,
    );
    if (!fs.existsSync(source))
      throw new Error("削除する素材ファイルが見つかりません。");
    this.verify(source, asset);
    if (fs.existsSync(trash))
      throw new Error("素材の履歴用ゴミ箱に同名ファイルがあります。");
    fs.mkdirSync(path.dirname(trash), { recursive: true });
    fs.renameSync(source, trash);
    return {
      rollback: () => fs.renameSync(trash, source),
    };
  }

  readDataUrl(storagePath: string, relativePath: string, mimeType: string) {
    const file = this.safeProjectPath(storagePath, relativePath);
    return `data:${mimeType};base64,${fs.readFileSync(file).toString("base64")}`;
  }

  private verify(
    filePath: string,
    expected: { byteSize: number; sha256: string },
  ) {
    const bytes = fs.readFileSync(filePath);
    if (
      bytes.length !== expected.byteSize ||
      crypto.createHash("sha256").update(bytes).digest("hex") !==
        expected.sha256
    )
      throw new Error("素材ファイルの整合性を確認できませんでした。");
  }

  private safeProjectPath(root: string, relative: string) {
    const full = path.resolve(root, relative);
    const base = path.resolve(root) + path.sep;
    if (!full.startsWith(base))
      throw new Error("プロジェクト外のファイルにはアクセスできません。");
    return full;
  }
}
