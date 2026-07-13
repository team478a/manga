import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "src/preload/package.json");
const destination = resolve(root, "dist-main/preload/package.json");

await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);
