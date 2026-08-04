import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(target));
    else if (/\.tsx?$/.test(entry.name)) files.push(target);
  }
  return files;
}

test("日本語の遷移メッセージはURLエンコードしてから利用する", async () => {
  const files = await sourceFiles("src");
  const unsafe = [];
  const queryMessage = /[?&](?:message|error)=[^$`"'\r\n]*[^\x00-\x7f]/u;

  for (const file of files) {
    const lines = (await readFile(file, "utf8")).split(/\r?\n/u);
    lines.forEach((line, index) => {
      if (queryMessage.test(line) && !/encodeURI(?:Component)?\(/u.test(line)) {
        unsafe.push(`${file}:${index + 1}`);
      }
    });
  }

  assert.deepEqual(
    unsafe,
    [],
    `未エンコードの日本語遷移メッセージがあります:\n${unsafe.join("\n")}`,
  );
});
