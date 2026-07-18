import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
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

manifest.schemaSha256 = digest(path.join(root, "supabase", "schema.sql"));
manifest.migrations = manifest.migrations.map((migration) => ({
  ...migration,
  forwardSha256: digest(
    path.join(migrationsDirectory, `${migration.id}.sql`),
  ),
  rollbackSha256: digest(
    path.join(rollbacksDirectory, `${migration.id}.sql`),
  ),
}));

if (!process.argv.includes("--write")) {
  console.log(JSON.stringify(manifest, null, 2));
  process.exit(0);
}

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `Updated checksums for ${manifest.migrations.length} Supabase migrations.`,
);
