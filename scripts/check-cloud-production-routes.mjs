const PRODUCTION_ORIGIN = "https://app.mang-ai.com";
const CONFIRMATION = "READ_ONLY_PRODUCTION_HTTP";

export const PUBLIC_ROUTE_CHECKS = [
  { path: "/", expectation: "public" },
  { path: "/login", expectation: "public" },
  { path: "/signup", expectation: "public" },
  { path: "/forgot-password", expectation: "public" },
  { path: "/works", expectation: "public" },
  { path: "/dashboard", expectation: "protected" },
  { path: "/creator", expectation: "protected" },
  { path: "/dashboard/monitor/welcome", expectation: "protected" },
  { path: "/admin", expectation: "protected" },
];

export function validateProductionRouteEnvironment(environment = process.env) {
  const configured = environment.MANGAI_ROUTE_SMOKE_CONFIRM === CONFIRMATION;
  return {
    passed: configured,
    errors: configured ? [] : ["confirmation:missing"],
  };
}

function safeRedirectLocation(location, requestUrl) {
  if (!location) return null;
  try {
    const redirectUrl = new URL(location, requestUrl);
    return redirectUrl.origin === PRODUCTION_ORIGIN ? redirectUrl : null;
  } catch {
    return null;
  }
}

export function evaluateRouteResponse(check, response) {
  const status = Number(response.status);
  const location = response.location ?? null;
  if (!Number.isInteger(status) || status < 100 || status > 599)
    return { ...check, passed: false, reason: "invalid-status", status: null };
  if (status >= 500)
    return { ...check, passed: false, reason: "server-error", status };
  if (check.expectation === "public") {
    return status >= 200 && status < 300
      ? { ...check, passed: true, reason: "public-page-ready", status }
      : { ...check, passed: false, reason: "public-page-unavailable", status };
  }

  if (status < 300 || status >= 400)
    return { ...check, passed: false, reason: "authentication-redirect-missing", status };
  const requestUrl = new URL(check.path, PRODUCTION_ORIGIN);
  const redirectUrl = safeRedirectLocation(location, requestUrl);
  if (!redirectUrl)
    return { ...check, passed: false, reason: "unsafe-redirect", status };
  const passed = redirectUrl.pathname === "/login";
  return {
    ...check,
    passed,
    reason: passed ? "login-redirect-ready" : "unexpected-redirect",
    status,
  };
}

export async function runProductionRouteSmoke({
  fetchImpl = fetch,
  checks = PUBLIC_ROUTE_CHECKS,
  timeoutMs = 15_000,
} = {}) {
  const results = [];
  for (const check of checks) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const requestUrl = new URL(check.path, PRODUCTION_ORIGIN);
      const response = await fetchImpl(requestUrl, {
        method: "GET",
        redirect: "manual",
        cache: "no-store",
        headers: { "user-agent": "MANGAI-read-only-route-smoke/1.0" },
        signal: controller.signal,
      });
      results.push(
        evaluateRouteResponse(check, {
          status: response.status,
          location: response.headers.get("location"),
        }),
      );
    } catch {
      results.push({ ...check, passed: false, reason: "request-failed", status: null });
    } finally {
      clearTimeout(timeout);
    }
  }
  return { passed: results.every((result) => result.passed), results };
}

async function main() {
  const validation = validateProductionRouteEnvironment(process.env);
  console.log("MANGAI Cloud production route smoke (read only)");
  console.log(validation.passed ? "CONFIGURED confirmation" : "MISSING confirmation");
  if (!validation.passed) {
    console.error("Production route smoke: PREFLIGHT FAILED");
    process.exitCode = 1;
    return;
  }
  if (process.argv.includes("--preflight")) {
    console.log("Production route smoke: PREFLIGHT PASS");
    return;
  }

  const report = await runProductionRouteSmoke();
  for (const result of report.results)
    console.log(`${result.passed ? "PASS" : "FAIL"} ${result.path}: ${result.reason}`);
  console.log(report.passed ? "Production route smoke: PASS" : "Production route smoke: FAIL");
  if (!report.passed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll("\\", "/")}`).href)
  await main();
