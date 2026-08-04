import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateRouteResponse,
  runProductionRouteSmoke,
  validateProductionRouteEnvironment,
} from "../scripts/check-cloud-production-routes.mjs";

test("production route smoke fails closed without explicit read-only confirmation", () => {
  assert.equal(validateProductionRouteEnvironment({}).passed, false);
  assert.equal(
    validateProductionRouteEnvironment({
      MANGAI_ROUTE_SMOKE_CONFIRM: "READ_ONLY_PRODUCTION_HTTP",
    }).passed,
    true,
  );
});

test("public routes accept only a successful page response", () => {
  assert.equal(evaluateRouteResponse({ path: "/", expectation: "public" }, { status: 200 }).passed, true);
  assert.equal(evaluateRouteResponse({ path: "/", expectation: "public" }, { status: 302 }).passed, false);
  assert.equal(evaluateRouteResponse({ path: "/", expectation: "public" }, { status: 500 }).reason, "server-error");
});

test("protected routes require a same-origin login redirect", () => {
  const check = { path: "/dashboard", expectation: "protected" };
  assert.equal(evaluateRouteResponse(check, { status: 307, location: "/login" }).passed, true);
  assert.equal(
    evaluateRouteResponse(check, { status: 307, location: "https://example.com/login" }).reason,
    "unsafe-redirect",
  );
  assert.equal(evaluateRouteResponse(check, { status: 200 }).reason, "authentication-redirect-missing");
});

test("runner checks every route without following redirects", async () => {
  const requests = [];
  const report = await runProductionRouteSmoke({
    checks: [
      { path: "/", expectation: "public" },
      { path: "/dashboard", expectation: "protected" },
    ],
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), init });
      return url.pathname === "/"
        ? new Response("ok", { status: 200 })
        : new Response(null, { status: 307, headers: { location: "/login" } });
    },
  });
  assert.equal(report.passed, true);
  assert.equal(requests.length, 2);
  assert.ok(requests.every(({ init }) => init.method === "GET" && init.redirect === "manual"));
});
