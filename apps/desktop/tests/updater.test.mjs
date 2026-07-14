import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  parseUpdateChannel,
  resolveUpdateSource,
  UpdatePreferences,
} from "../dist-main/main/update-preferences.js";

test("更新チャンネルは端末設定へ安全に保存される", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-update-"));
  try {
    const preferences = new UpdatePreferences(root);
    assert.equal(preferences.read(), "stable");
    assert.equal(preferences.write("beta"), "beta");
    assert.equal(new UpdatePreferences(root).read(), "beta");
    assert.equal(preferences.write("stable"), "stable");
    assert.equal(new UpdatePreferences(root).read(), "stable");
    assert.throws(() => parseUpdateChannel("preview"), /不正/);
    fs.writeFileSync(
      path.join(root, "settings", "update.json"),
      "invalid-json",
    );
    assert.equal(preferences.read(), "stable");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("GitHub配布設定とHTTPS overrideを安全に解決する", () => {
  const github = resolveUpdateSource({
    updateUrl: "https://downloads.example.com/mangai/",
    githubRepository: "mangai/desktop",
  });
  assert.deepEqual(github, {
    provider: "github",
    owner: "mangai",
    repo: "desktop",
    tagNamePrefix: "desktop-v",
  });
  assert.deepEqual(
    resolveUpdateSource(
      { githubRepository: "mangai/desktop" },
      "https://staging.example.com/updates/",
    ),
    { provider: "generic", url: "https://staging.example.com/updates/" },
  );
  assert.throws(
    () => resolveUpdateSource({ updateUrl: "http://unsafe.example.com" }),
    /HTTPS/,
  );
  assert.throws(
    () => resolveUpdateSource({ githubRepository: "invalid" }),
    /repository/,
  );
});
