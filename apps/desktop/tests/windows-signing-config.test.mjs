import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

import { resolveWindowsSigningConfig } from "../scripts/windows-signing-config.mjs";

const readinessScript = path.resolve(
  import.meta.dirname,
  "../scripts/check-windows-signing-readiness.mjs",
);

test("Windows signing config accepts a complete PFX configuration", () => {
  assert.deepEqual(
    resolveWindowsSigningConfig(
      {
        WIN_CSC_LINK: "C:\\secure\\mangai.pfx",
        WIN_CSC_KEY_PASSWORD: "hidden",
      },
      "win32",
    ),
    { mode: "pfx", builderArguments: [] },
  );
});

test("Windows signing config accepts a certificate store thumbprint", () => {
  const result = resolveWindowsSigningConfig(
    { MANGAI_WIN_CERTIFICATE_SHA1: "abcdef0123456789abcdef0123456789abcdef01" },
    "win32",
  );
  assert.equal(result.mode, "certificate-store");
  assert.deepEqual(result.builderArguments, [
    "--config.win.signtoolOptions.certificateSha1=ABCDEF0123456789ABCDEF0123456789ABCDEF01",
  ]);
});

test("Windows signing config fails closed for incomplete or ambiguous configuration", () => {
  assert.throws(
    () =>
      resolveWindowsSigningConfig(
        {
          WIN_CSC_LINK: "C:\\secure\\mangai.pfx",
          CSC_LINK: "C:\\secure\\other.pfx",
          WIN_CSC_KEY_PASSWORD: "hidden",
        },
        "win32",
      ),
    /複数の異なる値/,
  );
  assert.throws(
    () =>
      resolveWindowsSigningConfig(
        { WIN_CSC_LINK: "C:\\secure\\mangai.pfx" },
        "win32",
      ),
    /証明書とパスワードの両方/,
  );
  assert.throws(
    () =>
      resolveWindowsSigningConfig(
        {
          WIN_CSC_LINK: "C:\\secure\\mangai.pfx",
          WIN_CSC_KEY_PASSWORD: "hidden",
          MANGAI_WIN_CERTIFICATE_SHA1:
            "abcdef0123456789abcdef0123456789abcdef01",
        },
        "win32",
      ),
    /同時には使用できません/,
  );
  assert.throws(
    () => resolveWindowsSigningConfig({}, "win32"),
    /署名証明書が未設定/,
  );
});

test("Windows certificate store signing rejects invalid thumbprints and non-Windows hosts", () => {
  assert.throws(
    () =>
      resolveWindowsSigningConfig(
        { MANGAI_WIN_CERTIFICATE_SHA1: "not-a-thumbprint" },
        "win32",
      ),
    /40桁の16進数/,
  );
  assert.throws(
    () =>
      resolveWindowsSigningConfig(
        {
          MANGAI_WIN_CERTIFICATE_SHA1:
            "abcdef0123456789abcdef0123456789abcdef01",
        },
        "linux",
      ),
    /Windowsビルド端末/,
  );
});

test("Windows signing readiness never prints PFX credentials", () => {
  const link = "C:\\private\\do-not-print.pfx";
  const password = "do-not-print-password";
  const result = spawnSync(process.execPath, [readinessScript], {
    env: {
      ...process.env,
      WIN_CSC_LINK: link,
      WIN_CSC_KEY_PASSWORD: password,
      CSC_LINK: "",
      CSC_KEY_PASSWORD: "",
      MANGAI_WIN_CERTIFICATE_SHA1: "",
    },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Mode: pfx/);
  assert.match(result.stdout, /Result: READY/);
  assert.doesNotMatch(result.stdout, new RegExp(link.replaceAll("\\", "\\\\")));
  assert.doesNotMatch(result.stdout, new RegExp(password));
});
