import crypto from "node:crypto";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { createServerClient } from "@supabase/ssr";

const execFileAsync = promisify(execFile);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROJECT_REF_PATTERN = /^[a-z0-9-]{8,64}$/;
const VERCEL_DEPLOYMENT_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

const required = (environment, name) => {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`Missing staging environment: ${name}`);
  return value;
};

const checkedHttpsUrl = (value, label) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error(`${label} must be an HTTPS URL without credentials.`);
  return url;
};

export function resolveOtherBuyerDownloadEnvironment(environment) {
  if (required(environment, "MANGAI_DB_ENV") !== "staging")
    throw new Error("MANGAI_DB_ENV must be staging.");
  if (required(environment, "MANGAI_MARKETPLACE_CHECKOUT_MODE") !== "test")
    throw new Error("Marketplace checkout mode must be test.");

  const stagingRef = required(environment, "MANGAI_STAGING_PROJECT_REF").toLowerCase();
  const parentRef = required(
    environment,
    "MANGAI_STAGING_PARENT_PROJECT_REF",
  ).toLowerCase();
  if (
    !PROJECT_REF_PATTERN.test(stagingRef) ||
    !PROJECT_REF_PATTERN.test(parentRef) ||
    stagingRef === parentRef
  )
    throw new Error("Staging and parent project refs must be valid and distinct.");

  const supabaseUrl = checkedHttpsUrl(
    required(environment, "NEXT_PUBLIC_SUPABASE_URL"),
    "NEXT_PUBLIC_SUPABASE_URL",
  );
  if (supabaseUrl.hostname !== `${stagingRef}.supabase.co`)
    throw new Error("Supabase URL does not match the declared staging ref.");

  const previewUrl = checkedHttpsUrl(
    required(environment, "MANGAI_STAGING_PREVIEW_URL"),
    "MANGAI_STAGING_PREVIEW_URL",
  );
  if (
    !previewUrl.hostname.endsWith(".vercel.app") ||
    !previewUrl.hostname.includes("-git-")
  )
    throw new Error("Preview URL must target a branch Vercel deployment.");

  const serviceRoleKey = required(environment, "SUPABASE_SERVICE_ROLE_KEY");
  if (
    serviceRoleKey.length < 20 ||
    /(example|placeholder|redacted|replace|change[-_]?me|x{4,})/i.test(
      serviceRoleKey,
    )
  )
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");

  const anonKey = required(environment, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (anonKey.length < 20)
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured.");

  const paidOrderId = environment.MANGAI_STAGING_PAID_ORDER_ID?.trim() || null;
  if (paidOrderId && !UUID_PATTERN.test(paidOrderId))
    throw new Error("Staging paid order ID must be a UUID.");

  const deploymentId = required(
    environment,
    "MANGAI_STAGING_VERCEL_DEPLOYMENT_ID",
  );
  if (!VERCEL_DEPLOYMENT_ID_PATTERN.test(deploymentId))
    throw new Error("Vercel deployment ID is invalid.");

  return {
    anonKey,
    deploymentId,
    paidOrderId,
    parentRef,
    previewUrl,
    serviceRoleKey,
    stagingRef,
    supabaseUrl,
  };
}

const authorizedHeaders = (serviceRoleKey) => ({
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
});

const responseJson = async (response, label) => {
  if (!response.ok) throw new Error(`${label} failed with HTTP ${response.status}.`);
  try {
    return await response.json();
  } catch {
    throw new Error(`${label} returned invalid JSON.`);
  }
};

const readRows = async ({ fetchFn, label, pathname, searchParams, target }) => {
  const url = new URL(pathname, target.supabaseUrl);
  for (const [name, value] of Object.entries(searchParams))
    url.searchParams.set(name, value);
  return responseJson(
    await fetchFn(url, {
      headers: authorizedHeaders(target.serviceRoleKey),
      method: "GET",
    }),
    label,
  );
};

const readSingle = async (input) => {
  const rows = await readRows(input);
  if (!Array.isArray(rows) || rows.length !== 1)
    throw new Error(`${input.label} expected exactly one row.`);
  return rows[0];
};

const fixtureEmail = (role, stagingRef) =>
  `mangai-e2e-${role}-${stagingRef}@example.com`;

const fixturePassword = (email, serviceRoleKey) =>
  `${crypto
    .createHmac("sha256", serviceRoleKey)
    .update(`mangai-marketplace-e2e:${email}`)
    .digest("base64url")}!Aa1`;

const readFixture = async (target, fetchFn) => {
  const orderFilters = target.paidOrderId
    ? { id: `eq.${target.paidOrderId}` }
    : { payment_mode: "eq.test", status: "eq.paid" };
  const order = await readSingle({
    fetchFn,
    label: "Staging paid order lookup",
    pathname: "/rest/v1/orders",
    searchParams: {
      limit: "2",
      select: "id,buyer_profile_id,product_id,status,payment_mode,download_count",
      ...orderFilters,
    },
    target,
  });
  if (
    order.status !== "paid" ||
    order.payment_mode !== "test" ||
    !UUID_PATTERN.test(order.buyer_profile_id) ||
    !UUID_PATTERN.test(order.product_id)
  )
    throw new Error("Target must be a paid test order with a buyer and product.");

  const email = fixtureEmail("unpurchased", target.stagingRef);
  const authUrl = new URL("/auth/v1/admin/users", target.supabaseUrl);
  authUrl.searchParams.set("page", "1");
  authUrl.searchParams.set("per_page", "1000");
  const usersResult = await responseJson(
    await fetchFn(authUrl, {
      headers: authorizedHeaders(target.serviceRoleKey),
      method: "GET",
    }),
    "List staging auth users",
  );
  const matches = Array.isArray(usersResult?.users)
    ? usersResult.users.filter((user) => user?.email === email)
    : [];
  if (matches.length !== 1 || !UUID_PATTERN.test(matches[0].id))
    throw new Error("Synthetic unpurchased auth user was not found exactly once.");

  const profile = await readSingle({
    fetchFn,
    label: "Synthetic unpurchased profile lookup",
    pathname: "/rest/v1/profiles",
    searchParams: {
      limit: "2",
      select: "id,user_id,role",
      user_id: `eq.${matches[0].id}`,
    },
    target,
  });
  if (
    profile.role !== "buyer" ||
    profile.user_id !== matches[0].id ||
    profile.id === order.buyer_profile_id
  )
    throw new Error("Synthetic other buyer identity is not isolated from Buyer A.");

  const purchases = await readRows({
    fetchFn,
    label: "Synthetic other buyer purchase lookup",
    pathname: "/rest/v1/orders",
    searchParams: {
      buyer_profile_id: `eq.${profile.id}`,
      product_id: `eq.${order.product_id}`,
      select: "id",
      status: "eq.paid",
    },
    target,
  });
  if (!Array.isArray(purchases) || purchases.length !== 0)
    throw new Error("Synthetic other buyer already owns the target product.");

  return { email, order, profile };
};

const authenticateOtherBuyer = async ({ email, target }) => {
  let cookieValues = [];
  const client = createServerClient(target.supabaseUrl.toString(), target.anonKey, {
    cookies: {
      getAll: () => cookieValues,
      setAll: (cookies) => {
        cookieValues = cookies.map(({ name, options, value }) => ({
          name,
          options,
          value,
        }));
      },
    },
  });
  const password = fixturePassword(email, target.serviceRoleKey);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user || cookieValues.length === 0)
    throw new Error("Synthetic other buyer authentication failed.");
  return { client, cookieValues };
};

const netscapeCookieJar = ({ cookies, hostname }) => {
  const rows = ["# Netscape HTTP Cookie File"];
  for (const cookie of cookies) {
    const expires = cookie.options?.maxAge
      ? Math.floor(Date.now() / 1000) + Number(cookie.options.maxAge)
      : cookie.options?.expires instanceof Date
        ? Math.floor(cookie.options.expires.getTime() / 1000)
        : 0;
    rows.push(
      [
        hostname,
        "FALSE",
        cookie.options?.path || "/",
        "TRUE",
        Number.isFinite(expires) ? expires : 0,
        cookie.name,
        cookie.value,
      ].join("\t"),
    );
  }
  return `${rows.join("\n")}\n`;
};

const requestAuthenticatedPreview = async ({ cookies, pathname, target }) => {
  const temporaryDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "mangai-e06-"),
  );
  const cookiePath = path.join(temporaryDirectory, "cookies.txt");
  const command = process.platform === "win32" ? "vercel.cmd" : "vercel";
  try {
    await fs.writeFile(
      cookiePath,
      netscapeCookieJar({
        cookies,
        hostname: target.previewUrl.hostname,
      }),
      { encoding: "utf8", mode: 0o600 },
    );
    const { stdout } = await execFileAsync(
      command,
      [
        "curl",
        pathname,
        "--deployment",
        target.deploymentId,
        "--",
        "--silent",
        "--show-error",
        "--max-redirs",
        "0",
        "--cookie",
        cookiePath,
        "--header",
        "Accept: application/json",
        "--write-out",
        "\\n__MANGAI_HTTP_STATUS__:%{http_code}\\n",
      ],
      {
        encoding: "utf8",
        maxBuffer: 4 * 1024 * 1024,
        shell: process.platform === "win32",
        windowsHide: true,
      },
    );
    const marker = "__MANGAI_HTTP_STATUS__:";
    const markerIndex = stdout.lastIndexOf(marker);
    if (markerIndex < 0) throw new Error("missing response status");
    const status = Number.parseInt(
      stdout.slice(markerIndex + marker.length).trim(),
      10,
    );
    if (!Number.isInteger(status)) throw new Error("invalid response status");
    return { body: stdout.slice(0, markerIndex), status };
  } catch {
    throw new Error("Authenticated protected Preview request failed.");
  } finally {
    await fs.rm(temporaryDirectory, { force: true, recursive: true });
  }
};

export async function runOtherBuyerDownloadAcceptance({
  authenticate = authenticateOtherBuyer,
  environment = process.env,
  fetchFn = fetch,
  previewRequest = requestAuthenticatedPreview,
}) {
  const target = resolveOtherBuyerDownloadEnvironment(environment);
  const fixture = await readFixture(target, fetchFn);
  const before = fixture.order.download_count;
  const session = await authenticate({ email: fixture.email, target });
  try {
    const response = await previewRequest({
      cookies: session.cookieValues,
      pathname: `/api/purchases/${fixture.order.id}/download`,
      target,
    });
    if (![401, 403, 404].includes(response.status))
      throw new Error("Other buyer download was not rejected by Preview.");

    const after = await readSingle({
      fetchFn,
      label: "Staging paid order recheck",
      pathname: "/rest/v1/orders",
      searchParams: {
        id: `eq.${fixture.order.id}`,
        limit: "2",
        select: "id,buyer_profile_id,product_id,status,payment_mode,download_count",
      },
      target,
    });
    if (
      after.status !== fixture.order.status ||
      after.payment_mode !== fixture.order.payment_mode ||
      after.buyer_profile_id !== fixture.order.buyer_profile_id ||
      after.product_id !== fixture.order.product_id ||
      after.download_count !== before
    )
      throw new Error("Other buyer rejection changed the paid order.");

    return {
      checks: {
        buyerIdentitiesDistinct: true,
        otherBuyerHasNoPaidOrder: true,
        otherBuyerRejected: true,
        paidOrderUnchanged: true,
      },
      safety: {
        credentialsPrinted: false,
        paymentCreated: false,
        productionMutation: false,
        providerRequest: false,
        stripeRequest: false,
      },
    };
  } finally {
    await session.client?.auth.signOut({ scope: "local" }).catch(() => {});
  }
}

const help = `MANGAI Marketplace isolated Preview other-buyer download acceptance

Authenticates the synthetic unpurchased Buyer B, requests Buyer A's paid test
order download once, and requires an authorization rejection with an unchanged
download_count. Credentials are derived in memory and sent only to the isolated
Preview Supabase Auth. A temporary cookie file is deleted in a finally block.
Production, Stripe, payment, Provider, and credit are not changed.`;

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(help);
  } else {
    try {
      const report = await runOtherBuyerDownloadAcceptance({});
      for (const [name, passed] of Object.entries(report.checks))
        console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
      console.log("Marketplace isolated Preview other-buyer download passed.");
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Acceptance failed.");
      process.exitCode = 1;
    }
  }
}
