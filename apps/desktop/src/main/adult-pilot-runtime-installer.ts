import fs from "node:fs";
import path from "node:path";

export type AdultPilotArchiveEntry = {
  path: string;
  type: "file" | "directory" | "symlink" | "hardlink" | "other";
};

export type AdultPilotRuntimeInstallResult = {
  runtimePath: string;
  entryCount: number;
};

const expectedRoot = "ComfyUI_windows_portable";
const maximumEntries = 200_000;

const normalizeEntry = (value: string) => value.replaceAll("\\", "/").replace(/\/$/, "");

export const validateAdultPilotArchiveEntries = (
  entries: readonly AdultPilotArchiveEntry[],
) => {
  if (entries.length === 0 || entries.length > maximumEntries)
    throw new Error("ComfyUI archiveの内容件数を安全に確認できません。");
  const seen = new Set<string>();
  for (const entry of entries) {
    const normalized = normalizeEntry(entry.path);
    if (
      !normalized ||
      normalized.includes("\0") ||
      normalized.startsWith("/") ||
      /^[a-zA-Z]:/.test(normalized) ||
      normalized.split("/").some((part) => !part || part === "." || part === "..")
    )
      throw new Error("ComfyUI archiveに保存先外を参照するpathが含まれています。");
    if (normalized.split("/")[0] !== expectedRoot)
      throw new Error("ComfyUI archiveのroot directoryが固定値と一致しません。");
    if (entry.type !== "file" && entry.type !== "directory")
      throw new Error("ComfyUI archiveにlinkまたは未対応entryが含まれています。");
    const windowsKey = normalized.toLocaleLowerCase("en-US");
    if (seen.has(windowsKey))
      throw new Error("ComfyUI archiveにWindows上で重複するpathが含まれています。");
    seen.add(windowsKey);
  }
  return entries.map((entry) => ({ ...entry, path: normalizeEntry(entry.path) }));
};

const assertExtractedTree = (directory: string, allowedEntries: ReadonlySet<string>) => {
  const visit = (current: string) => {
    for (const item of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, item.name);
      const relative = path.relative(path.dirname(directory), target).replaceAll("\\", "/");
      if (!allowedEntries.has(relative.toLocaleLowerCase("en-US")))
        throw new Error("展開後のComfyUI Runtimeに一覧外のentryが含まれています。");
      const stats = fs.lstatSync(target);
      if (stats.isSymbolicLink())
        throw new Error("展開後のComfyUI Runtimeにlinkが含まれています。");
      if (stats.isDirectory()) visit(target);
      else if (!stats.isFile())
        throw new Error("展開後のComfyUI Runtimeに未対応entryが含まれています。");
    }
  };
  visit(directory);
};

export class AdultPilotRuntimeInstaller {
  async install(
    root: string,
    entries: readonly AdultPilotArchiveEntry[],
    extract: (stagingDirectory: string) => Promise<void>,
    configure?: (extractedRuntimeRoot: string) => Promise<void> | void,
  ): Promise<AdultPilotRuntimeInstallResult> {
    const validated = validateAdultPilotArchiveEntries(entries);
    if (!path.isAbsolute(root) || path.parse(root).root.startsWith("\\\\"))
      throw new Error("保存先は端末内driveの絶対pathで指定してください。");
    fs.mkdirSync(root, { recursive: true });
    const realRoot = fs.realpathSync(root);
    const runtimeRoot = path.join(realRoot, "runtime");
    fs.mkdirSync(runtimeRoot, { recursive: true });
    const realRuntimeRoot = fs.realpathSync(runtimeRoot);
    if (!realRuntimeRoot.startsWith(`${realRoot}${path.sep}`))
      throw new Error("Runtime保存先がローカルAI領域の外を参照しています。");
    const destination = path.join(realRuntimeRoot, expectedRoot);
    if (fs.existsSync(destination))
      throw new Error("既存のComfyUI Runtimeは自動上書きしません。");
    const staging = path.join(realRuntimeRoot, ".installing");
    if (fs.existsSync(staging))
      throw new Error("未完了のRuntime展開領域があります。内容を確認してください。");
    fs.mkdirSync(staging, { mode: 0o700 });
    try {
      await extract(staging);
      const extractedRoot = path.join(staging, expectedRoot);
      if (!fs.statSync(extractedRoot, { throwIfNoEntry: false })?.isDirectory())
        throw new Error("展開後のComfyUI root directoryを確認できません。");
      if (fs.readdirSync(staging).length !== 1)
        throw new Error("ComfyUI archiveの外側に余分なentryがあります。");
      assertExtractedTree(
        extractedRoot,
        new Set(validated.map((entry) => entry.path.toLocaleLowerCase("en-US"))),
      );
      await configure?.(extractedRoot);
      fs.renameSync(extractedRoot, destination);
      fs.rmdirSync(staging);
      return { runtimePath: destination, entryCount: validated.length };
    } catch (cause) {
      fs.rmSync(staging, { recursive: true, force: true });
      throw cause;
    }
  }
}
