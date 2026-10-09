import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROJECT_REF_PATTERN = /^[a-z0-9-]{8,64}$/;
const VERCEL_DEPLOYMENT_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const execFileAsync = promisify(execFile);

const required = (environment, name) => {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`Missing staging environment: ${name}`);
  return value;
};

const checkedUrl = (value, label) => {
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

export function resolveMarketplaceAccessGuardEnvironment(environment) {
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

  const supabaseUrl = checkedUrl(
    required(environment, "NEXT_PUBLIC_SUPABASE_URL"),
    "NEXT_PUBLIC_SUPABASE_URL",
  );
  if (supabaseUrl.hostname !== `${stagingRef}.supabase.co`)
    throw new Error("Supabase URL does not match the declared staging ref.");

  const previewUrl = checkedUrl(
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

  const paidOrderId = required(environment, "MANGAI_STAGING_PAID_ORDER_ID");
  if (!UUID_PATTERN.test(paidOrderId))
    throw new Error("Staging paid order ID must be a UUID.");

  const vercelDeploymentId = required(
    environment,
    "MANGAI_STAGING_VERCEL_DEPLOYMENT_ID",
  );
  if (!VERCEL_DEPLOYMENT_ID_PATTERN.test(vercelDeploymentId))
    throw new Error("Vercel deployment ID is invalid.");

  return {
    paidOrderId,
    parentRef,
    previewUrl,
    serviceRoleKey,
    stagingRef,
    supabaseUrl,
    vercelDeploymentId,
  };
}

const authorizedHeaders = (serviceRoleKey, extra = {}) => ({
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  ...extra,
});

const responseJson = async (response, label) => {
  if (!response.ok) throw new Error(`${label} failed with HTTP ${response.status}.`);
  try {
    return await response.json();
  } catch {
    throw new Error(`${label} returned invalid JSON.`);
  }
};

const readSingle = async ({
  fetchFn,
  label,
  pathname,
  searchParams,
  serviceRoleKey,
  supabaseUrl,
}) => {
  const url = new URL(pathname, supabaseUrl);
  for (const [name, value] of Object.entries(searchParams))
    url.searchParams.set(name, value);
  url.searchParams.set("limit", "2");
  const rows = await responseJson(
    await fetchFn(url, {
      headers: authorizedHeaders(serviceRoleKey),
      method: "GET",
    }),
    label,
  );
  if (!Array.isArray(rows) || rows.length !== 1)
    throw new Error(`${label} expected exactly one row.`);
  return rows[0];
};

const readTarget = async (target, fetchFn) => {
  const order = await readSingle({
    fetchFn,
    label: "Staging paid order lookup",
    pathname: "/rest/v1/orders",
    searchParams: {
      id: `eq.${target.paidOrderId}`,
      select:
        "id,status,payment_mode,download_count,digital_products:product_id(id,status,work_id)",
    },
    serviceRoleKey: target.serviceRoleKey,
    supabaseUrl: target.supabaseUrl,
  });
  const product = order.digital_products;
  if (
    order.status !== "paid" ||
    order.payment_mode !== "test" ||
    !product ||
    !UUID_PATTERN.test(product.id) ||
    !UUID_PATTERN.test(product.work_id)
  )
    throw new Error("Access guard target must be a paid test order with one product.");

  const work = await readSingle({
    fetchFn,
    label: "Staging work lookup",
    pathname: "/rest/v1/works",
    searchParams: {
      id: `eq.${product.work_id}`,
      select: "id,title,is_public,content_class",
    },
    serviceRoleKey: target.serviceRoleKey,
    supabaseUrl: target.supabaseUrl,
  });
  if (
    product.status !== "active" ||
    typeof work.title !== "string" ||
    !work.title ||
    work.is_public !== true ||
    work.content_class !== "general"
  )
    throw new Error("Access guard target must be an active public general work.");
  return { order, product, work };
};

const patchSingle = async ({
  expected,
  fetchFn,
  id,
  label,
  pathname,
  serviceRoleKey,
  supabaseUrl,
  values,
}) => {
  const url = new URL(pathname, supabaseUrl);
  url.searchParams.set("id", `eq.${id}`);
  for (const [name, value] of Object.entries(expected))
    url.searchParams.set(name, `eq.${String(value)}`);
  const rows = await responseJson(
    await fetchFn(url, {
      body: JSON.stringify(values),
      headers: authorizedHeaders(serviceRoleKey, {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      }),
      method: "PATCH",
    }),
    label,
  );
  if (!Array.isArray(rows) || rows.length !== 1)
    throw new Error(`${label} did not change exactly one expected row.`);
};

const requestThroughVercelCli = async ({ deploymentId, pathname }) => {
  const command = process.platform === "win32" ? "vercel.cmd" : "vercel";
  try {
    const { stdout } = await execFileAsync(
      command,
      [
        "curl",
        pathname,
        "--deployment",
        deploymentId,
        "--",
        "--silent",
        "--show-error",
        "--max-redirs",
        "0",
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
    if (markerIndex < 0)
      throw new Error("missing response status");
    const status = Number.parseInt(
      stdout.slice(markerIndex + marker.length).trim(),
      10,
    );
    if (!Number.isInteger(status)) throw new Error("invalid response status");
    return { body: stdout.slice(0, markerIndex), status };
  } catch {
    throw new Error("Protected Preview request through Vercel CLI failed.");
  }
};

export async function runMarketplaceAccessGuardAcceptance({
  environment = process.env,
  fetchFn = fetch,
  previewRequest = requestThroughVercelCli,
}) {
  const target = resolveMarketplaceAccessGuardEnvironment(environment);
  const fixture = await readTarget(target, fetchFn);
  let productPaused = false;
  let workPrivate = false;

  try {
    await patchSingle({
      expected: { status: "active" },
      fetchFn,
      id: fixture.product.id,
      label: "Pause staging product",
      pathname: "/rest/v1/digital_products",
      serviceRoleKey: target.serviceRoleKey,
      supabaseUrl: target.supabaseUrl,
      values: { status: "paused" },
    });
    productPaused = true;

    const checkout = await previewRequest({
      deploymentId: target.vercelDeploymentId,
      pathname: `/checkout/${fixture.product.id}?guard=${Date.now()}`,
    });
    const checkoutRejected =
      checkout.status === 404 ||
      (checkout.status === 200 &&
        checkout.body.includes("この商品は現在購入できません") &&
        checkout.body.includes("disabled"));
    if (!checkoutRejected)
      throw new Error("Paused product checkout was not disabled by Preview.");

    const listing = await previewRequest({
      deploymentId: target.vercelDeploymentId,
      pathname: `/works/${fixture.work.id}?guard=${Date.now()}`,
    });
    if (
      listing.status !== 200 ||
      !listing.body.includes("販売中の商品はまだありません") ||
      listing.body.includes(`/checkout/${fixture.product.id}`)
    )
      throw new Error("Paused product remained purchasable on the work page.");

    await patchSingle({
      expected: { status: "paused" },
      fetchFn,
      id: fixture.product.id,
      label: "Restore staging product",
      pathname: "/rest/v1/digital_products",
      serviceRoleKey: target.serviceRoleKey,
      supabaseUrl: target.supabaseUrl,
      values: { status: "active" },
    });
    productPaused = false;

    await patchSingle({
      expected: { is_public: true },
      fetchFn,
      id: fixture.work.id,
      label: "Hide staging work",
      pathname: "/rest/v1/works",
      serviceRoleKey: target.serviceRoleKey,
      supabaseUrl: target.supabaseUrl,
      values: { is_public: false },
    });
    workPrivate = true;

    const hiddenWork = await previewRequest({
      deploymentId: target.vercelDeploymentId,
      pathname: `/works/${fixture.work.id}?guard=${Date.now()}`,
    });
    const privateWorkRejected =
      hiddenWork.status === 404 ||
      (hiddenWork.status === 200 &&
        hiddenWork.body.includes('name="robots" content="noindex"') &&
        !hiddenWork.body.includes(fixture.work.title));
    if (!privateWorkRejected)
      throw new Error("Private work direct access was not rejected by Preview.");

    await patchSingle({
      expected: { is_public: false },
      fetchFn,
      id: fixture.work.id,
      label: "Restore staging work",
      pathname: "/rest/v1/works",
      serviceRoleKey: target.serviceRoleKey,
      supabaseUrl: target.supabaseUrl,
      values: { is_public: true },
    });
    workPrivate = false;

    const download = await previewRequest({
      deploymentId: target.vercelDeploymentId,
      pathname: `/api/purchases/${fixture.order.id}/download`,
    });
    if (![307, 401, 403, 404].includes(download.status))
      throw new Error("Anonymous purchase download was not safely rejected.");

    const after = await readTarget(target, fetchFn);
    if (
      after.order.status !== fixture.order.status ||
      after.order.payment_mode !== fixture.order.payment_mode ||
      after.order.download_count !== fixture.order.download_count
    )
      throw new Error("Access guard acceptance changed the paid order.");

    return {
      checks: {
        anonymousPurchaseDownloadRejected: true,
        nonPublicDirectAccessRejected: true,
        orderUnchanged: true,
        pausedCheckoutDisabled: true,
        pausedListingHidden: true,
        stagingFixtureRestored: true,
      },
      safety: {
        environmentValuesPrinted: false,
        paymentCreated: false,
        productionMutation: false,
        stripeRequest: false,
      },
    };
  } finally {
    if (workPrivate) {
      await patchSingle({
        expected: { is_public: false },
        fetchFn,
        id: fixture.work.id,
        label: "Emergency restore staging work",
        pathname: "/rest/v1/works",
        serviceRoleKey: target.serviceRoleKey,
        supabaseUrl: target.supabaseUrl,
        values: { is_public: true },
      });
    }
    if (productPaused) {
      await patchSingle({
        expected: { status: "paused" },
        fetchFn,
        id: fixture.product.id,
        label: "Emergency restore staging product",
        pathname: "/rest/v1/digital_products",
        serviceRoleKey: target.serviceRoleKey,
        supabaseUrl: target.supabaseUrl,
        values: { status: "active" },
      });
    }
  }
}

const help = `MANGAI Marketplace staging access guard acceptance

Required environment (use an external, untracked environment source):
  MANGAI_DB_ENV=staging
  MANGAI_MARKETPLACE_CHECKOUT_MODE=test
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  MANGAI_STAGING_PROJECT_REF
  MANGAI_STAGING_PARENT_PROJECT_REF
  MANGAI_STAGING_PREVIEW_URL
  MANGAI_STAGING_PAID_ORDER_ID
  MANGAI_STAGING_VERCEL_DEPLOYMENT_ID

The command temporarily pauses one synthetic Preview product and hides its work,
checks the public guards, then restores both rows even when a check fails. It also
confirms an anonymous request cannot download the paid order. It does not call
Stripe, create a payment, or mutate Production.`;

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(help);
  } else {
    try {
      const report = await runMarketplaceAccessGuardAcceptance({});
      for (const [name, passed] of Object.entries(report.checks))
        console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
      console.log("Marketplace staging access guard acceptance passed.");
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Acceptance failed.");
      process.exitCode = 1;
    }
  }
}
