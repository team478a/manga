import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checks = [
  ["migration", "supabase/migrations/202607310001_cloud_adult_grok_provider.sql"],
  ["rollback", "supabase/rollbacks/202607310001_cloud_adult_grok_provider.sql"],
  ["settings", "src/lib/cloud-adult-grok-settings.ts"],
  ["admin", "src/app/admin/adult-grok/page.tsx"],
];
let failed = false;
for (const [label, relative] of checks) {
  const ok = fs.existsSync(path.join(root, relative));
  console.log(`${ok ? "OK" : "NG"} ${label}`);
  failed ||= !ok;
}
const enabled = process.env.CLOUD_ADULT_GROK_ENABLED === "true";
console.log(`${enabled ? "OK" : "INFO"} CLOUD_ADULT_GROK_ENABLED`);
console.log("INFO xAI API key value is never read or printed by this preflight.");
console.log("INFO Verify configured/enabled status in /admin/adult-grok after migration.");
if (failed) process.exitCode = 1;
