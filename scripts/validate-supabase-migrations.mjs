import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDirectory = path.join(root, "supabase", "migrations");
const rollbacksDirectory = path.join(root, "supabase", "rollbacks");
const manifestPath = path.join(migrationsDirectory, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const digest = (file) =>
  crypto
    .createHash("sha256")
    .update(fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n"))
    .digest("hex");

assert.equal(manifest.version, 1, "migration manifest version must be 1");
assert.ok(
  Array.isArray(manifest.migrations),
  "manifest migrations must be an array",
);
assert.ok(manifest.migrations.length > 0, "at least one migration is required");

const ids = manifest.migrations.map((migration) => migration.id);
assert.deepEqual(
  ids,
  [...ids].sort(),
  "manifest migrations must be sorted by id",
);
assert.equal(new Set(ids).size, ids.length, "migration ids must be unique");

const fileIds = fs
  .readdirSync(migrationsDirectory)
  .filter((name) => name.endsWith(".sql"))
  .map((name) => name.slice(0, -4))
  .sort();
const rollbackIds = fs
  .readdirSync(rollbacksDirectory)
  .filter((name) => name.endsWith(".sql"))
  .map((name) => name.slice(0, -4))
  .sort();

assert.deepEqual(
  fileIds,
  ids,
  "manifest and forward migration files must match",
);
assert.deepEqual(rollbackIds, ids, "every migration must have a rollback file");

const destructiveForward = /\b(drop\s+(table|column)|truncate\s+table)\b/i;
for (const migration of manifest.migrations) {
  assert.match(
    migration.id,
    /^\d{12}_[a-z0-9_]+$/,
    `invalid migration id: ${migration.id}`,
  );
  assert.ok(
    typeof migration.description === "string" && migration.description.trim(),
    `migration ${migration.id} needs a description`,
  );
  for (const [kind, directory] of [
    ["forward", migrationsDirectory],
    ["rollback", rollbacksDirectory],
  ]) {
    const sql = fs.readFileSync(
      path.join(directory, `${migration.id}.sql`),
      "utf8",
    );
    assert.equal(
      migration[`${kind}Sha256`],
      digest(path.join(directory, `${migration.id}.sql`)),
      `${kind} ${migration.id} checksum mismatch; review the SQL and run db:migrations:checksums:update`,
    );
    assert.match(
      sql,
      /^begin;\s/i,
      `${kind} ${migration.id} must start with begin`,
    );
    assert.match(
      sql,
      /\scommit;\s*$/i,
      `${kind} ${migration.id} must end with commit`,
    );
    assert.doesNotMatch(
      sql,
      /\b(begin|commit)\s*;[\s\S]*\b\1\s*;/i,
      `${kind} ${migration.id} must contain one transaction`,
    );
    if (kind === "forward" && !sql.includes("allow-destructive:"))
      assert.doesNotMatch(
        sql,
        destructiveForward,
        `forward ${migration.id} contains an unapproved destructive statement`,
      );
  }
}

const schema = fs.readFileSync(
  path.join(root, "supabase", "schema.sql"),
  "utf8",
);
assert.equal(
  manifest.schemaSha256,
  digest(path.join(root, "supabase", "schema.sql")),
  "schema.sql checksum mismatch; review it and run db:migrations:checksums:update",
);
for (const required of [
  "sample_image_urls",
  "source_project_id",
  "desktop_device_authorizations",
  "desktop_device_rate_limits",
  "consume_desktop_device_rate_limit",
  "cleanup_desktop_device_authorizations",
  "cloud_projects",
  "cloud_canvas_snapshots",
  "save_cloud_page_snapshot",
  "cloud-assets",
  "cloud_generation_jobs",
  "enqueue_cloud_generation_job",
  "claim_cloud_generation_job",
  "cloud_ai_entitlements",
  "cloud_ai_cost_ledger",
  "enqueue_cloud_generation_job_with_quota",
  "consume_cloud_ai_rate_limit",
  "stripe_webhook_events",
  "apply_cloud_ai_subscription_event",
  "buyer_profile_id",
  "orders_buyer_read",
  "record_order_download",
  "sync_cloud_marketplace_draft",
  "cloud_ai_admin_audit_logs",
  "cloud_ai_notifications",
  "refresh_cloud_ai_notifications",
])
  assert.ok(schema.includes(required), `schema.sql is missing ${required}`);

console.log(`Validated ${ids.length} Supabase migrations and rollbacks.`);
