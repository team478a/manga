import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const args = new Set(process.argv.slice(2));
const strict = args.has("--strict");
const probe = args.has("--probe");
const json = args.has("--json");

const configured = (value) => Boolean(value?.trim());

export const commandAvailable = (command, platform = process.platform) => {
  const finder = platform === "win32" ? "where.exe" : "which";
  return spawnSync(finder, [command], {
    stdio: "ignore",
    windowsHide: true,
  }).status === 0;
};

export const assessExternalEnvironments = ({
  environment = process.env,
  commands = {},
} = {}) => {
  const hasCommand = (name) =>
    commands[name] ?? commandAvailable(name);
  const stagingVariables = [
    "PGHOST",
    "PGPORT",
    "PGDATABASE",
    "PGUSER",
    "PGPASSWORD",
    "PGSSLMODE",
    "MANGAI_STAGING_PROJECT_REF",
    "MANGAI_STAGING_PARENT_PROJECT_REF",
  ];
  const stagingProjectRef = environment.MANGAI_STAGING_PROJECT_REF?.trim();
  const stagingParentProjectRef =
    environment.MANGAI_STAGING_PARENT_PROJECT_REF?.trim();
  const hasIsolatedStagingIdentity =
    configured(stagingProjectRef) &&
    configured(stagingParentProjectRef) &&
    stagingProjectRef.toLowerCase() !== stagingParentProjectRef.toLowerCase();

  return [
    {
      id: "ollama",
      label: "Ollama実環境E2E",
      ready:
        hasCommand("ollama") || configured(environment.OLLAMA_HOST),
      missing:
        hasCommand("ollama") || configured(environment.OLLAMA_HOST)
          ? []
          : ["ollama command or OLLAMA_HOST"],
      probeUrl: environment.OLLAMA_HOST?.trim() || "http://127.0.0.1:11434",
      probePath: "/api/tags",
    },
    {
      id: "comfyui",
      label: "ComfyUI実環境E2E",
      ready: configured(environment.COMFYUI_URL),
      missing: configured(environment.COMFYUI_URL) ? [] : ["COMFYUI_URL"],
      probeUrl: environment.COMFYUI_URL?.trim() || null,
      probePath: "/system_stats",
    },
    {
      id: "supabase-staging",
      label: "Supabase staging DB",
      ready:
        environment.MANGAI_DB_ENV === "staging" &&
        hasCommand("psql") &&
        stagingVariables.every((name) => configured(environment[name])) &&
        hasIsolatedStagingIdentity,
      missing: [
        ...(environment.MANGAI_DB_ENV === "staging"
          ? []
          : ["MANGAI_DB_ENV=staging"]),
        ...(hasCommand("psql") ? [] : ["psql command"]),
        ...stagingVariables.filter((name) => !configured(environment[name])),
        ...(configured(stagingProjectRef) &&
        configured(stagingParentProjectRef) &&
        !hasIsolatedStagingIdentity
          ? ["isolated staging branch ref differs from parent project ref"]
          : []),
      ],
      probeUrl: null,
      probePath: null,
    },
  ];
};

export const probeReadOnlyEndpoint = async (
  baseUrl,
  path,
  { fetchImpl = fetch, timeoutMs = 3000 } = {},
) => {
  if (!baseUrl) return { ok: false, reason: "not-configured" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(new URL(path, baseUrl), {
      method: "GET",
      signal: controller.signal,
    });
    return { ok: response.ok, status: response.status };
  } catch {
    return { ok: false, reason: "unreachable" };
  } finally {
    clearTimeout(timer);
  }
};

const isEntrypoint =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isEntrypoint) {
  const checks = assessExternalEnvironments();
  if (probe) {
    for (const check of checks) {
      if (check.id === "supabase-staging" || !check.ready) continue;
      check.probe = await probeReadOnlyEndpoint(
        check.probeUrl,
        check.probePath,
      );
    }
  }

  const report = {
    passed: checks.every(
      (check) => check.ready && (!probe || check.probe?.ok !== false),
    ),
    mode: probe ? "read-only-probe" : "configuration-only",
    safety: {
      providerGeneration: false,
      queueMutation: false,
      creditReservation: false,
      secretValuesPrinted: false,
    },
    checks: checks.map(({ probeUrl, probePath, ...check }) => check),
  };

  if (json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log("MANGAI RC external environment preflight");
    console.log("=========================================");
    console.log(`Mode: ${report.mode}`);
    console.log("Secret values: hidden");
    for (const check of report.checks) {
      const probePassed = !probe || check.probe?.ok === true;
      console.log(
        `${check.ready && probePassed ? "[READY]" : "[PENDING]"} ${check.label}`,
      );
      for (const item of check.missing) console.log(`  [missing] ${item}`);
      if (probe && check.ready)
        console.log(`  [probe] ${check.probe?.ok ? "reachable" : "unreachable"}`);
    }
    console.log("\nNo generation, queue mutation, or credit reservation was performed.");
  }

  if (strict && !report.passed) process.exitCode = 1;
}
