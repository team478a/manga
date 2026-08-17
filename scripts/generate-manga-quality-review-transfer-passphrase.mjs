import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
};
const outputArgument = argument("--output") ?? process.argv[2];
if (!outputArgument) throw new Error("review_transfer_passphrase_output_required");
const outputPath = path.resolve(outputArgument);
const repositoryRoot = path.resolve(import.meta.dirname, "..");
if (outputPath === repositoryRoot || outputPath.startsWith(`${repositoryRoot}${path.sep}`))
  throw new Error("review_transfer_passphrase_must_be_outside_repository");

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${randomBytes(32).toString("base64url")}\n`, { flag: "wx", mode: 0o600 });
process.stdout.write(`${JSON.stringify({ status: "REVIEW_TRANSFER_PASSPHRASE_CREATED", path: outputPath, secretPrinted: false }, null, 2)}\n`);
