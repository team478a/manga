import path from "node:path";
import { fileURLToPath } from "node:url";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROJECT_REF_PATTERN = /^[a-z0-9-]{8,64}$/;
const EXPIRY_SECONDS = 300;

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

export function resolveMarketplaceAuthExpiryEnvironment(environment) {
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

  const pendingOrderId = required(
    environment,
    "MANGAI_STAGING_PENDING_ORDER_ID",
  );
  const paidOrderId = required(environment, "MANGAI_STAGING_PAID_ORDER_ID");
  if (!UUID_PATTERN.test(pendingOrderId) || !UUID_PATTERN.test(paidOrderId))
    throw new Error("Staging order IDs must be UUIDs.");
  if (pendingOrderId === paidOrderId)
    throw new Error("Pending and paid order IDs must be distinct.");

  return {
    paidOrderId,
    parentRef,
    pendingOrderId,
    previewUrl,
    serviceRoleKey,
    stagingRef,
    supabaseUrl,
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

const readOrder = async ({
  fetchFn,
  orderId,
  serviceRoleKey,
  supabaseUrl,
  withProduct = false,
}) => {
  const url = new URL("/rest/v1/orders", supabaseUrl);
  url.searchParams.set(
    "select",
    withProduct
      ? "id,status,payment_mode,digital_products:product_id(file_url)"
      : "id,status,payment_mode",
  );
  url.searchParams.set("id", `eq.${orderId}`);
  url.searchParams.set("limit", "2");
  const rows = await responseJson(
    await fetchFn(url, {
      headers: authorizedHeaders(serviceRoleKey),
      method: "GET",
    }),
    "Staging order lookup",
  );
  if (!Array.isArray(rows) || rows.length !== 1)
    throw new Error("Expected exactly one staging order.");
  return rows[0];
};

const encodedStoragePath = (value) =>
  value
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const signedUrlExpiry = (signedUrl) => {
  const token = signedUrl.searchParams.get("token");
  const payload = token?.split(".")[1];
  if (!payload) throw new Error("Storage signed URL does not contain a JWT token.");
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!Number.isSafeInteger(parsed.exp))
      throw new Error("missing exp");
    return parsed.exp;
  } catch {
    throw new Error("Storage signed URL has an invalid expiry token.");
  }
};

const createStorageSignedUrl = async ({
  fetchFn,
  path: storagePath,
  serviceRoleKey,
  supabaseUrl,
}) => {
  const url = new URL(
    `/storage/v1/object/sign/digital-products/${encodedStoragePath(storagePath)}`,
    supabaseUrl,
  );
  const result = await responseJson(
    await fetchFn(url, {
      body: JSON.stringify({ expiresIn: EXPIRY_SECONDS }),
      headers: authorizedHeaders(serviceRoleKey, {
        "Content-Type": "application/json",
      }),
      method: "POST",
    }),
    "Storage signed URL creation",
  );
  const value = result.signedURL ?? result.signedUrl;
  if (typeof value !== "string" || !value)
    throw new Error("Storage did not return a signed URL.");
  return new URL(value, supabaseUrl);
};

export async function runMarketplaceAuthExpiryAcceptance({
  environment = process.env,
  fetchFn = fetch,
  now = () => Date.now(),
  wait = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
}) {
  const target = resolveMarketplaceAuthExpiryEnvironment(environment);
  const pendingBefore = await readOrder({
    fetchFn,
    orderId: target.pendingOrderId,
    serviceRoleKey: target.serviceRoleKey,
    supabaseUrl: target.supabaseUrl,
  });
  if (pendingBefore.status !== "pending" || pendingBefore.payment_mode !== "test")
    throw new Error("Tamper canary must be a pending test order.");

  const cancelUrl = new URL("/checkout/cancel", target.previewUrl);
  cancelUrl.searchParams.set("order_id", target.pendingOrderId);
  cancelUrl.searchParams.set("cancel_token", "0".repeat(64));
  const cancelResponse = await fetchFn(cancelUrl, {
    cache: "no-store",
    method: "GET",
    redirect: "follow",
  });
  const cancelBody = await cancelResponse.text();
  if (
    !cancelResponse.ok ||
    !cancelBody.includes("注文状態は変更していません")
  )
    throw new Error("Tampered cancel token was not rejected by Preview.");

  const pendingAfter = await readOrder({
    fetchFn,
    orderId: target.pendingOrderId,
    serviceRoleKey: target.serviceRoleKey,
    supabaseUrl: target.supabaseUrl,
  });
  if (
    pendingAfter.id !== pendingBefore.id ||
    pendingAfter.status !== pendingBefore.status ||
    pendingAfter.payment_mode !== pendingBefore.payment_mode
  )
    throw new Error("Tampered cancel token changed the staging order.");

  const paidOrder = await readOrder({
    fetchFn,
    orderId: target.paidOrderId,
    serviceRoleKey: target.serviceRoleKey,
    supabaseUrl: target.supabaseUrl,
    withProduct: true,
  });
  const storagePath = paidOrder.digital_products?.file_url;
  if (
    paidOrder.status !== "paid" ||
    paidOrder.payment_mode !== "test" ||
    typeof storagePath !== "string" ||
    !storagePath
  )
    throw new Error("Expiry canary must be a paid test order with a product file.");

  const signedUrl = await createStorageSignedUrl({
    fetchFn,
    path: storagePath,
    serviceRoleKey: target.serviceRoleKey,
    supabaseUrl: target.supabaseUrl,
  });
  const expirySeconds = signedUrlExpiry(signedUrl);
  const secondsRemaining = expirySeconds - Math.floor(now() / 1000);
  if (secondsRemaining < 240 || secondsRemaining > 360)
    throw new Error("Storage signed URL is not using the expected five-minute TTL.");

  const immediate = await fetchFn(signedUrl, {
    cache: "no-store",
    headers: { Range: "bytes=0-0" },
    method: "GET",
  });
  if (!immediate.ok)
    throw new Error("Fresh Storage signed URL could not download the product.");

  const waitMilliseconds = Math.max(0, expirySeconds * 1000 - now() + 2_000);
  if (waitMilliseconds > 362_000)
    throw new Error("Storage signed URL expiry wait exceeded the safety limit.");
  await wait(waitMilliseconds);
  const expired = await fetchFn(signedUrl, {
    cache: "no-store",
    headers: { Range: "bytes=0-0" },
    method: "GET",
  });
  if (expired.ok)
    throw new Error("Expired Storage signed URL still downloaded the product.");

  return {
    checks: {
      expiredSignedUrlRejected: true,
      freshSignedUrlDownloaded: true,
      tamperedCancelRejected: true,
      tamperedOrderUnchanged: true,
    },
    safety: {
      environmentValuesPrinted: false,
      paymentCreated: false,
      productionMutation: false,
      stripeRequest: false,
    },
  };
}

const help = `MANGAI Marketplace staging authorization / expiry acceptance

Required environment (use an external, untracked environment source):
  MANGAI_DB_ENV=staging
  MANGAI_MARKETPLACE_CHECKOUT_MODE=test
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  MANGAI_STAGING_PROJECT_REF
  MANGAI_STAGING_PARENT_PROJECT_REF
  MANGAI_STAGING_PREVIEW_URL
  MANGAI_STAGING_PENDING_ORDER_ID
  MANGAI_STAGING_PAID_ORDER_ID

The command reads two synthetic test orders, submits one invalid cancel token,
creates a five-minute Storage signed URL, and confirms it fails after expiry.
It does not call Stripe, create a payment, or mutate Production.`;

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(help);
  } else {
    try {
      const report = await runMarketplaceAuthExpiryAcceptance({});
      for (const [name, passed] of Object.entries(report.checks))
        console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
      console.log("Marketplace staging authorization / expiry acceptance passed.");
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Acceptance failed.");
      process.exitCode = 1;
    }
  }
}
