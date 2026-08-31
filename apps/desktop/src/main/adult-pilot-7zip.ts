import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AdultPilotArchiveEntry } from "./adult-pilot-runtime-installer.js";

const execFileAsync = promisify(execFile);
const minimumVersion = [25, 1] as const;

type CommandResult = { stdout: string; stderr: string };
type CommandRunner = (
  executable: string,
  args: readonly string[],
) => Promise<CommandResult>;

const defaultRunner: CommandRunner = async (executable, args) => {
  const result = await execFileAsync(executable, [...args], {
    windowsHide: true,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return { stdout: result.stdout, stderr: result.stderr };
};

export const findSupported7Zip = (
  environment: NodeJS.ProcessEnv = process.env,
) => {
  const roots = [environment.ProgramW6432, environment.ProgramFiles]
    .filter((value): value is string => Boolean(value));
  for (const root of [...new Set(roots)]) {
    const candidate = path.resolve(root, "7-Zip", "7z.exe");
    if (fs.statSync(candidate, { throwIfNoEntry: false })?.isFile()) return candidate;
  }
  return null;
};

export const parse7ZipVersion = (output: string) => {
  const match = output.match(/7-Zip\s+(\d+)\.(\d+)/i);
  if (!match) throw new Error("7-Zipのversionを確認できません。");
  const version = [Number(match[1]), Number(match[2])] as const;
  if (
    version[0] < minimumVersion[0] ||
    (version[0] === minimumVersion[0] && version[1] < minimumVersion[1])
  ) throw new Error("安全な展開には7-Zip 25.01以上が必要です。");
  return `${version[0]}.${String(version[1]).padStart(2, "0")}`;
};

export const parse7ZipTechnicalList = (output: string): AdultPilotArchiveEntry[] => {
  const records = output
    .split(/\r?\n\r?\n/)
    .map((block) => Object.fromEntries(block.split(/\r?\n/).flatMap((line) => {
      const separator = line.indexOf(" = ");
      return separator < 0 ? [] : [[line.slice(0, separator), line.slice(separator + 3)]];
    })))
    .filter((record) => typeof record.Path === "string" && record.Path.length > 0);
  if (records.length === 0) throw new Error("7-Zipからarchive entry一覧を取得できませんでした。");
  return records.map((record) => ({
    path: record.Path,
    type: record["Symbolic Link"] !== undefined
      ? "symlink"
      : record["Hard Link"] !== undefined
        ? "hardlink"
        : record.Folder === "+" || /^D/.test(record.Attributes ?? "")
          ? "directory"
          : "file",
  }));
};

export class AdultPilot7ZipAdapter {
  constructor(
    private readonly executable: string,
    private readonly runner: CommandRunner = defaultRunner,
  ) {
    if (!path.isAbsolute(executable) || path.basename(executable).toLocaleLowerCase("en-US") !== "7z.exe")
      throw new Error("7-Zipは正式インストール先の実行fileを指定してください。");
  }

  async verifyVersion() {
    const result = await this.runner(this.executable, ["i"]);
    return parse7ZipVersion(`${result.stdout}\n${result.stderr}`);
  }

  async list(archive: string) {
    await this.verifyVersion();
    if (!path.isAbsolute(archive) || path.extname(archive).toLocaleLowerCase("en-US") !== ".7z")
      throw new Error("固定済みComfyUI .7z archiveを指定してください。");
    const result = await this.runner(this.executable, ["l", "-slt", "-ba", "--", archive]);
    return parse7ZipTechnicalList(result.stdout);
  }

  async extract(archive: string, stagingDirectory: string) {
    await this.verifyVersion();
    if (!path.isAbsolute(archive) || !path.isAbsolute(stagingDirectory))
      throw new Error("archiveとstagingは絶対pathで指定してください。");
    if (fs.readdirSync(stagingDirectory).length !== 0)
      throw new Error("展開先staging directoryは空である必要があります。");
    await this.runner(this.executable, ["x", "-y", "-aoa", `-o${stagingDirectory}`, "--", archive]);
  }
}
