import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const ledgerPath = path.resolve(
  process.env.MANGAI_ADULT_PILOT_INVITE_LEDGER_PATH ??
    path.join(root, "docs", "desktop", "DESKTOP_ADULT_PILOT_INVITE_LEDGER.example.json"),
);
const allowedStatuses = new Set(["INVITED", "ACTIVE", "STOPPED", "COMPLETED", "WITHDRAWN"]);
const allowedVramBands = new Set(["12gb", "16gb_or_more"]);
const forbiddenKeys = /^(name|email|address|phone|prompt|negativePrompt|image|mask|projectName|deviceName|absolutePath|content|notes?)$/i;
const emailPattern = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/;
const absolutePathPattern = /(?:[a-z]:\\|\\\\[^\\]+\\|file:\/\/|\/(?:home|users|var|tmp)\/)/i;

const fail = (message) => {
  console.error(`Desktop Adult pilot invite ledger invalid: ${message}`);
  process.exit(1);
};
const timestamp = (value) =>
  typeof value === "string" && !Number.isNaN(Date.parse(value)) && value === new Date(value).toISOString();
const scanPrivateData = (value, location = "ledger") => {
  if (Array.isArray(value)) return value.forEach((item, index) => scanPrivateData(item, `${location}[${index}]`));
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (forbiddenKeys.test(key)) fail(`${location}.${key} is a prohibited field`);
      scanPrivateData(item, `${location}.${key}`);
    }
  } else if (typeof value === "string" && (emailPattern.test(value) || absolutePathPattern.test(value))) {
    fail(`${location} contains prohibited personal data or a local path`);
  }
};

let ledger;
try {
  ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
} catch {
  fail("file could not be read");
}
scanPrivateData(ledger);
if (ledger.format !== "mangai.desktop-adult-pilot-invite-ledger" || ledger.version !== 1)
  fail("format or version is unsupported");
if (!Array.isArray(ledger.entries)) fail("entries must be an array");
const ids = new Set();
for (const [index, entry] of ledger.entries.entries()) {
  const label = `entries[${index}]`;
  if (!/^monitor-[0-9a-f]{12}$/.test(entry.monitorId ?? "")) fail(`${label}.monitorId is invalid`);
  if (ids.has(entry.monitorId)) fail(`${label}.monitorId is duplicated`);
  ids.add(entry.monitorId);
  if (![1, 2, 3].includes(entry.stage)) fail(`${label}.stage is invalid`);
  if (!allowedStatuses.has(entry.status)) fail(`${label}.status is invalid`);
  if (!/^\d+\.\d+\.\d+(?:-beta\.\d+)?$/.test(entry.desktopVersion ?? ""))
    fail(`${label}.desktopVersion is invalid`);
  if (!allowedVramBands.has(entry.environment?.vramBand) || entry.environment?.windows !== "windows_11")
    fail(`${label}.environment is outside the pilot scope`);
  if (!timestamp(entry.distributedAt)) fail(`${label}.distributedAt is invalid`);
  if (["ACTIVE", "COMPLETED"].includes(entry.status) && !timestamp(entry.consentedAt))
    fail(`${label}.consentedAt is required`);
  if (entry.consentedAt !== null && !timestamp(entry.consentedAt)) fail(`${label}.consentedAt is invalid`);
  if (entry.status === "STOPPED" && !timestamp(entry.stoppedAt)) fail(`${label}.stoppedAt is required`);
  if (entry.stoppedAt !== null && !timestamp(entry.stoppedAt)) fail(`${label}.stoppedAt is invalid`);
}
console.log(`Desktop Adult pilot invite ledger: entries=${ledger.entries.length}, privateData=none`);
