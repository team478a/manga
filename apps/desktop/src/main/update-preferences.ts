import fs from "node:fs";
import path from "node:path";

export type UpdateChannel = "stable" | "beta";
export type UpdateSource =
  | { provider: "generic"; url: string }
  | {
      provider: "github";
      owner: string;
      repo: string;
      tagNamePrefix: "desktop-v";
    };

export function parseUpdateChannel(value: unknown): UpdateChannel {
  if (value === "stable" || value === "beta") return value;
  throw new Error("更新チャンネルが不正です。");
}

export function resolveUpdateSource(
  config: unknown,
  overrideUrl?: string,
): UpdateSource | null {
  const value = config && typeof config === "object" ? config : {};
  const record = value as Record<string, unknown>;
  const configuredUrl = overrideUrl?.trim();
  if (configuredUrl) {
    let url: URL;
    try {
      url = new URL(configuredUrl.trim());
    } catch {
      throw new Error("更新配布先URLが正しくありません。");
    }
    if (url.protocol !== "https:")
      throw new Error("更新配布先はHTTPSで指定してください。");
    return { provider: "generic", url: url.href };
  }
  const repository = record.githubRepository;
  if (typeof repository === "string") {
    const parts = repository.trim().split("/");
    if (parts.length === 2 && parts.every((part) => /^[-\w.]+$/.test(part)))
      return {
        provider: "github",
        owner: parts[0],
        repo: parts[1],
        tagNamePrefix: "desktop-v",
      };
    throw new Error("更新用GitHub repository設定が不正です。");
  }
  const packagedUrl = record.updateUrl;
  if (typeof packagedUrl === "string" && packagedUrl.trim()) {
    let url: URL;
    try {
      url = new URL(packagedUrl.trim());
    } catch {
      throw new Error("更新配布先URLが正しくありません。");
    }
    if (url.protocol !== "https:")
      throw new Error("更新配布先はHTTPSで指定してください。");
    return { provider: "generic", url: url.href };
  }
  return null;
}

export class UpdatePreferences {
  private readonly filePath: string;

  constructor(root: string) {
    this.filePath = path.join(root, "settings", "update.json");
  }

  read(): UpdateChannel {
    try {
      const value = JSON.parse(fs.readFileSync(this.filePath, "utf8")) as {
        channel?: unknown;
      };
      return parseUpdateChannel(value.channel);
    } catch {
      return "stable";
    }
  }

  write(channel: UpdateChannel) {
    const value = parseUpdateChannel(channel);
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.tmp`;
    fs.writeFileSync(
      temporary,
      `${JSON.stringify({ channel: value }, null, 2)}\n`,
      { mode: 0o600 },
    );
    fs.renameSync(temporary, this.filePath);
    return value;
  }
}
