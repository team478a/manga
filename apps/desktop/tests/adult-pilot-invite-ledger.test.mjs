import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const script = path.resolve(import.meta.dirname, "../scripts/check-adult-pilot-invite-ledger.mjs");
const run = (ledger) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-pilot-ledger-"));
  const file = path.join(root, "ledger.json");
  fs.writeFileSync(file, JSON.stringify(ledger));
  const result = spawnSync(process.execPath, [script], {
    encoding: "utf8",
    env: { ...process.env, MANGAI_ADULT_PILOT_INVITE_LEDGER_PATH: file },
  });
  fs.rmSync(root, { recursive: true, force: true });
  return result;
};
const entry = (overrides = {}) => ({
  monitorId: "monitor-012345abcdef",
  stage: 1,
  status: "ACTIVE",
  desktopVersion: "0.1.0-beta.1",
  environment: { windows: "windows_11", vramBand: "12gb" },
  distributedAt: "2026-09-01T00:00:00.000Z",
  consentedAt: "2026-09-01T00:10:00.000Z",
  stoppedAt: null,
  ...overrides,
});
const ledger = (entries) => ({
  format: "mangai.desktop-adult-pilot-invite-ledger",
  version: 1,
  entries,
});

test("Adult Pilot招待台帳は内容非保持の有効entryを受け入れる", () => {
  const result = run(ledger([entry()]));
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /entries=1, privateData=none/);
});

test("Adult Pilot招待台帳は個人情報・作品内容・local pathを拒否する", () => {
  for (const value of [
    entry({ email: "person@example.com" }),
    entry({ prompt: "creative text" }),
    entry({ supportCode: "C:\\Users\\person\\project" }),
  ]) assert.notEqual(run(ledger([value])).status, 0);
});

test("Adult Pilot招待台帳は重複IDと同意なしACTIVEを拒否する", () => {
  assert.notEqual(run(ledger([entry(), entry()])).status, 0);
  assert.notEqual(run(ledger([entry({ consentedAt: null })])).status, 0);
});

test("Adult Pilot招待台帳はSTOPPED日時と対応環境を必須にする", () => {
  assert.notEqual(run(ledger([entry({ status: "STOPPED", stoppedAt: null })])).status, 0);
  assert.notEqual(run(ledger([entry({ environment: { windows: "windows_10", vramBand: "8gb" } })])).status, 0);
});
