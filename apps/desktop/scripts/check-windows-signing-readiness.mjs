import { resolveWindowsSigningConfig } from "./windows-signing-config.mjs";

try {
  const signing = resolveWindowsSigningConfig();
  console.log("MANGAI Windows signing readiness");
  console.log(`  Mode: ${signing.mode}`);
  console.log("  Credentials: configured (values hidden)");
  console.log("  Result: READY");
} catch (error) {
  console.error("MANGAI Windows signing readiness");
  console.error(`  Result: BLOCKED - ${error.message}`);
  process.exit(1);
}
