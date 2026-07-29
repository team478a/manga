import { pathToFileURL } from "node:url";

const PASS = "PASS";
const FAIL = "FAIL";
const SKIP = "SKIP";

function configured(value) {
  const normalized = String(value ?? "").trim();
  return Boolean(normalized) &&
    !/(?:your-|replace-|_xxx$|example\.com)/iu.test(normalized);
}

function flag(name, env, checks) {
  const value = String(env[name] ?? "").trim().toLowerCase();
  if (!value) return false;
  if (value === "true") return true;
  if (value === "false") return false;
  checks.push({
    name,
    status: FAIL,
    message: "trueまたはfalseで設定してください。",
  });
  return false;
}

function validHttpsUrl(value) {
  try {
    const url = new URL(String(value ?? ""));
    return url.protocol === "https:" && configured(url.hostname);
  } catch {
    return false;
  }
}

function validHostList(value) {
  const hosts = String(value ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  return (
    hosts.length > 0 &&
    hosts.every(
      (host) =>
        /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/u.test(host) &&
        !host.includes("..") &&
        configured(host),
    )
  );
}

function addRequired(checks, name, passed, message) {
  checks.push({
    name,
    status: passed ? PASS : FAIL,
    message: passed ? "設定済み" : message,
  });
}

export function checkCloudRelease1Environment(env = process.env) {
  const checks = [];
  const researchEnabled = flag("CLOUD_RESEARCH_MVP_ENABLED", env, checks);
  addRequired(
    checks,
    "CLOUD_RESEARCH_MVP_ENABLED",
    researchEnabled,
    "限定公開時はtrueが必要です。",
  );
  addRequired(
    checks,
    "NEXT_PUBLIC_SUPABASE_URL",
    validHttpsUrl(env.NEXT_PUBLIC_SUPABASE_URL),
    "実SupabaseのHTTPS URLが必要です。",
  );
  addRequired(
    checks,
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    configured(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    "Publishable KeyまたはAnon Keyが必要です。",
  );
  addRequired(
    checks,
    "NEXT_PUBLIC_SITE_URL",
    validHttpsUrl(env.NEXT_PUBLIC_SITE_URL),
    "限定公開先のHTTPS URLが必要です。",
  );

  const verificationEnabled = flag(
    "CLOUD_RESEARCH_SOURCE_VERIFICATION_ENABLED",
    env,
    checks,
  );
  const searchEnabled = flag("CLOUD_RESEARCH_SEARCH_ENABLED", env, checks);
  const adultResearchEnabled = flag(
    "CLOUD_ADULT_RESEARCH_ENABLED",
    env,
    checks,
  );
  if (verificationEnabled) {
    addRequired(
      checks,
      "CLOUD_RESEARCH_SOURCE_ALLOWED_HOSTS",
      validHostList(env.CLOUD_RESEARCH_SOURCE_ALLOWED_HOSTS),
      "検証を許可する完全一致hostが必要です。",
    );
  } else {
    checks.push({
      name: "CLOUD_RESEARCH_SOURCE_ALLOWED_HOSTS",
      status: SKIP,
      message: "出典Server検証は無効です。手動出典入力を利用します。",
    });
  }

  if (searchEnabled) {
    addRequired(
      checks,
      "BRAVE_SEARCH_API_KEY",
      configured(env.BRAVE_SEARCH_API_KEY),
      "検索を有効化する場合だけAPI Keyが必要です。",
    );
  } else {
    checks.push({
      name: "BRAVE_SEARCH_API_KEY",
      status: SKIP,
      message: "候補検索は無効です。手動出典入力を利用できます。",
    });
  }

  if (verificationEnabled || searchEnabled || adultResearchEnabled) {
    addRequired(
      checks,
      "SUPABASE_SERVICE_ROLE_KEY",
      configured(env.SUPABASE_SERVICE_ROLE_KEY),
      "Server側rate limitまたは成人向け利用許可の管理操作に必要です。",
    );
  } else {
    checks.push({
      name: "SUPABASE_SERVICE_ROLE_KEY",
      status: SKIP,
      message:
        "検索・Server検証・成人向けオプションが無効なためRelease 1追加用途では未使用です。",
    });
  }
  if (verificationEnabled || searchEnabled) {
    const rateLimitSecret =
      env.CLOUD_RESEARCH_SEARCH_RATE_LIMIT_SECRET ??
      env.CLOUD_AI_RATE_LIMIT_SECRET ??
      env.SUPABASE_SERVICE_ROLE_KEY;
    addRequired(
      checks,
      "CLOUD_RESEARCH_SEARCH_RATE_LIMIT_SECRET",
      configured(rateLimitSecret) &&
        Buffer.byteLength(String(rateLimitSecret), "utf8") >= 32,
      "32byte以上のServer専用秘密値が必要です。",
    );
  } else {
    checks.push({
      name: "CLOUD_RESEARCH_SEARCH_RATE_LIMIT_SECRET",
      status: SKIP,
      message: "検索・事実候補抽出が無効なため未使用です。",
    });
  }

  return {
    passed: checks.every((check) => check.status !== FAIL),
    checks,
  };
}

function printReport(report) {
  for (const check of report.checks)
    console.log(`${check.status.padEnd(4)} ${check.name}: ${check.message}`);
  console.log(
    report.passed
      ? "Release 1 environment preflight: PASS"
      : "Release 1 environment preflight: FAIL",
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const report = checkCloudRelease1Environment();
  printReport(report);
  if (!report.passed) process.exitCode = 1;
}
