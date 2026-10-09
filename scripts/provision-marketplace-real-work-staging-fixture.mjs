import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { runMarketplaceRealWorkStagingFixtureAudit } from "./check-marketplace-real-work-staging-fixture.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE_TITLE = "MANGAI Marketplace E2E 2-page Fixture";
const CHECKPOINT_LABEL = "Marketplace E2E release";

const required = (environment, name) => {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`Missing staging environment: ${name}`);
  return value;
};

const stagingTarget = (environment) => {
  if (required(environment, "MANGAI_DB_ENV") !== "staging")
    throw new Error("MANGAI_DB_ENV must be staging.");
  if (required(environment, "MANGAI_MARKETPLACE_CHECKOUT_MODE") !== "test")
    throw new Error("Marketplace checkout mode must be test.");
  const stagingRef = required(environment, "MANGAI_STAGING_PROJECT_REF");
  const parentRef = required(environment, "MANGAI_STAGING_PARENT_PROJECT_REF");
  const supabaseUrl = new URL(required(environment, "NEXT_PUBLIC_SUPABASE_URL"));
  if (
    stagingRef === parentRef ||
    supabaseUrl.hostname !== `${stagingRef}.supabase.co`
  )
    throw new Error("Refusing to provision a non-isolated Supabase target.");
  const serviceRoleKey = required(environment, "SUPABASE_SERVICE_ROLE_KEY");
  if (serviceRoleKey.length < 20)
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  return { parentRef, serviceRoleKey, stagingRef, supabaseUrl };
};

const authHeaders = (serviceRoleKey, contentType = "application/json") => ({
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "Content-Type": contentType,
});

const responseJson = async (response, label) => {
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw new Error(`${label} failed with HTTP ${response.status}.`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

const dataUrl = (target, table, filters = {}, select = "*") => {
  const url = new URL(`/rest/v1/${table}`, target.supabaseUrl);
  url.searchParams.set("select", select);
  for (const [key, value] of Object.entries(filters))
    url.searchParams.set(key, value);
  return url;
};

const selectRows = async (target, table, filters = {}, select = "*") =>
  responseJson(
    await fetch(dataUrl(target, table, filters, select), {
      headers: authHeaders(target.serviceRoleKey),
    }),
    `Read ${table}`,
  );

const insertRow = async (target, table, row) => {
  const response = await fetch(dataUrl(target, table), {
    body: JSON.stringify(row),
    headers: {
      ...authHeaders(target.serviceRoleKey),
      Prefer: "return=representation",
    },
    method: "POST",
  });
  const rows = await responseJson(response, `Insert ${table}`);
  if (!Array.isArray(rows) || rows.length !== 1)
    throw new Error(`Insert ${table} returned an invalid shape.`);
  return rows[0];
};

const patchRows = async (target, table, filters, values) => {
  const response = await fetch(dataUrl(target, table, filters), {
    body: JSON.stringify(values),
    headers: {
      ...authHeaders(target.serviceRoleKey),
      Prefer: "return=minimal",
    },
    method: "PATCH",
  });
  await responseJson(response, `Update ${table}`);
};

const fixtureEmail = (role, stagingRef) =>
  `mangai-e2e-${role}-${stagingRef}@example.com`;

const fixturePassword = (email, serviceRoleKey) =>
  `${crypto
    .createHmac("sha256", serviceRoleKey)
    .update(`mangai-marketplace-e2e:${email}`)
    .digest("base64url")}!Aa1`;

const listAuthUsers = async (target) => {
  const url = new URL("/auth/v1/admin/users", target.supabaseUrl);
  url.searchParams.set("page", "1");
  url.searchParams.set("per_page", "1000");
  const result = await responseJson(
    await fetch(url, { headers: authHeaders(target.serviceRoleKey) }),
    "List staging auth users",
  );
  return Array.isArray(result?.users) ? result.users : [];
};

const ensureAuthUser = async (target, users, role) => {
  const email = fixtureEmail(role, target.stagingRef);
  const password = fixturePassword(email, target.serviceRoleKey);
  let user = users.find((candidate) => candidate.email === email);
  if (!user) {
    user = await responseJson(
      await fetch(new URL("/auth/v1/admin/users", target.supabaseUrl), {
        body: JSON.stringify({
          email,
          email_confirm: true,
          password,
          user_metadata: { display_name: `MANGAI E2E ${role}` },
        }),
        headers: authHeaders(target.serviceRoleKey),
        method: "POST",
      }),
      `Create ${role} staging auth user`,
    );
  } else {
    user = await responseJson(
      await fetch(
        new URL(`/auth/v1/admin/users/${user.id}`, target.supabaseUrl),
        {
          body: JSON.stringify({ password }),
          headers: authHeaders(target.serviceRoleKey),
          method: "PUT",
        },
      ),
      `Refresh ${role} staging auth password`,
    );
  }
  return { email, password, userId: user.id };
};

const ensureProfile = async (target, identity, profileRole) => {
  let rows = await selectRows(
    target,
    "profiles",
    { user_id: `eq.${identity.userId}` },
    "id,user_id,role",
  );
  if (rows.length === 0) {
    const profile = await insertRow(target, "profiles", {
      display_name: `MANGAI E2E ${identity.email.split("@")[0]}`,
      role: profileRole,
      user_id: identity.userId,
    });
    rows = [profile];
  }
  if (rows.length !== 1)
    throw new Error("The staging auth user does not map to exactly one profile.");
  if (rows[0].role !== profileRole)
    await patchRows(target, "profiles", { id: `eq.${rows[0].id}` }, { role: profileRole });
  return { ...identity, profileId: rows[0].id };
};

const uploadObject = async (target, bucket, objectPath, bytes, contentType) => {
  const encodedPath = objectPath.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(
    new URL(`/storage/v1/object/${bucket}/${encodedPath}`, target.supabaseUrl),
    {
      body: bytes,
      headers: {
        ...authHeaders(target.serviceRoleKey, contentType),
        "x-upsert": "true",
      },
      method: "POST",
    },
  );
  await responseJson(response, `Upload ${bucket} fixture object`);
};

const makeFixtureMedia = async () => {
  const source = fs.readFileSync(
    path.join(root, "docs/evidence/R4_2C_FOUR_PAGE_PREVIEW.png"),
  );
  const pageOne = await sharp(source)
    .resize({ width: 800, height: 1200, fit: "contain", background: "#ffffff" })
    .png()
    .toBuffer();
  const pageTwo = await sharp(source)
    .flop()
    .resize({ width: 800, height: 1200, fit: "contain", background: "#ffffff" })
    .png()
    .toBuffer();
  const pdf = await PDFDocument.create();
  for (const bytes of [pageOne, pageTwo]) {
    const image = await pdf.embedPng(bytes);
    const page = pdf.addPage([800, 1200]);
    page.drawImage(image, { x: 0, y: 0, width: 800, height: 1200 });
  }
  return { pageOne, pageTwo, pdf: Buffer.from(await pdf.save()) };
};

const firstOrCreate = async (target, table, filters, row, select = "*") => {
  const rows = await selectRows(target, table, filters, select);
  if (rows.length > 1) throw new Error(`Multiple ${table} fixture rows exist.`);
  return rows[0] || insertRow(target, table, row);
};

export async function provisionMarketplaceRealWorkStagingFixture(environment) {
  const target = stagingTarget(environment);
  const existingUsers = await listAuthUsers(target);
  const fixtureEmails = new Set(
    ["seller", "buyer", "unpurchased"].map((role) =>
      fixtureEmail(role, target.stagingRef),
    ),
  );
  const unrelatedUsers = existingUsers.filter(
    (user) => user.email && !fixtureEmails.has(user.email),
  );
  if (unrelatedUsers.length)
    throw new Error("Refusing to provision a staging branch containing unrelated users.");

  const seller = await ensureProfile(
    target,
    await ensureAuthUser(target, existingUsers, "seller"),
    "creator",
  );
  const buyer = await ensureProfile(
    target,
    await ensureAuthUser(target, existingUsers, "buyer"),
    "buyer",
  );
  const unpurchased = await ensureProfile(
    target,
    await ensureAuthUser(target, existingUsers, "unpurchased"),
    "buyer",
  );

  const project = await firstOrCreate(
    target,
    "cloud_projects",
    { owner_profile_id: `eq.${seller.profileId}`, title: `eq.${FIXTURE_TITLE}` },
    {
      age_rating: "全年齢",
      content_class: "general",
      description: "隔離Previewだけで使用する2ページMarketplace E2E fixtureです。",
      owner_profile_id: seller.profileId,
      title: FIXTURE_TITLE,
      visibility: "private",
    },
  );

  const media = await makeFixtureMedia();
  const prefix = `marketplace-e2e/${project.id}`;
  const coverPath = `${prefix}/cover.png`;
  const pageOnePath = `${prefix}/page-1.png`;
  const pageTwoPath = `${prefix}/page-2.png`;
  const productPath = `${prefix}/mangai-marketplace-e2e.pdf`;
  await Promise.all([
    uploadObject(target, "works", coverPath, media.pageOne, "image/png"),
    uploadObject(target, "digital-products", pageOnePath, media.pageOne, "image/png"),
    uploadObject(target, "digital-products", pageTwoPath, media.pageTwo, "image/png"),
    uploadObject(target, "digital-products", productPath, media.pdf, "application/pdf"),
  ]);
  const coverUrl = new URL(
    `/storage/v1/object/public/works/${coverPath}`,
    target.supabaseUrl,
  ).toString();
  const manifest = {
    schemaVersion: 1,
    pages: [
      { height: 1200, pageNumber: 1, storagePath: pageOnePath, width: 800 },
      { height: 1200, pageNumber: 2, storagePath: pageTwoPath, width: 800 },
    ],
  };
  const manifestSha256 = crypto
    .createHash("sha256")
    .update(JSON.stringify(manifest))
    .digest("hex");
  const checkpoint = await firstOrCreate(
    target,
    "cloud_project_checkpoints",
    { project_id: `eq.${project.id}`, label: `eq.${CHECKPOINT_LABEL}` },
    {
      created_by_profile_id: seller.profileId,
      kind: "release",
      label: CHECKPOINT_LABEL,
      manifest,
      manifest_sha256: manifestSha256,
      page_count: 2,
      production_context_revision: 0,
      project_id: project.id,
      project_revision: 0,
    },
  );
  const work = await firstOrCreate(
    target,
    "works",
    { creator_id: `eq.${seller.profileId}`, source_project_id: `eq.${project.id}` },
    {
      content_class: "general",
      creator_id: seller.profileId,
      description: project.description,
      image_url: coverUrl,
      is_public: false,
      sample_image_urls: [],
      source_project_id: project.id,
      status: "draft",
      tags: ["漫画", "全年齢", "E2E"],
      title: project.title,
    },
  );
  const publication = await firstOrCreate(
    target,
    "cloud_work_publications",
    { work_id: `eq.${work.id}`, checkpoint_id: `eq.${checkpoint.id}` },
    {
      checkpoint_id: checkpoint.id,
      cover_url: coverUrl,
      created_by_profile_id: seller.profileId,
      manifest_sha256: manifestSha256,
      page_count: 2,
      pdf_storage_path: productPath,
      project_id: project.id,
      version: 1,
      work_id: work.id,
    },
  );
  const existingPages = await selectRows(
    target,
    "cloud_work_publication_pages",
    { publication_id: `eq.${publication.id}` },
    "publication_id,page_number",
  );
  if (existingPages.length === 0) {
    for (const page of manifest.pages)
      await insertRow(target, "cloud_work_publication_pages", {
        height: page.height,
        is_sample: page.pageNumber === 1,
        page_number: page.pageNumber,
        publication_id: publication.id,
        storage_path: page.storagePath,
        width: page.width,
      });
  } else if (existingPages.length !== 2) {
    throw new Error("The existing staging publication page count is invalid.");
  }
  await patchRows(
    target,
    "works",
    { id: `eq.${work.id}` },
    {
      current_publication_id: publication.id,
      image_url: coverUrl,
      is_public: false,
      published_at: null,
      published_version: 1,
      status: "draft",
    },
  );
  const product = await firstOrCreate(
    target,
    "digital_products",
    { creator_id: `eq.${seller.profileId}`, work_id: `eq.${work.id}` },
    {
      creator_id: seller.profileId,
      description: "隔離Preview専用。実決済には使用しません。",
      file_url: productPath,
      price: 100,
      status: "paused",
      title: `${project.title} デジタル版`,
      work_id: work.id,
    },
  );
  await patchRows(
    target,
    "digital_products",
    { id: `eq.${product.id}` },
    { file_url: productPath, price: 100, status: "paused" },
  );

  const auditEnvironment = {
    ...environment,
    MANGAI_STAGING_BUYER_PROFILE_ID: buyer.profileId,
    MANGAI_STAGING_E2E_PRODUCT_ID: product.id,
    MANGAI_STAGING_E2E_WORK_ID: work.id,
    MANGAI_STAGING_SELLER_PROFILE_ID: seller.profileId,
    MANGAI_STAGING_UNPURCHASED_PROFILE_ID: unpurchased.profileId,
  };
  const audit = await runMarketplaceRealWorkStagingFixtureAudit({
    environment: auditEnvironment,
  });
  return { audit };
};

const isEntrypoint =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isEntrypoint) {
  if (!process.argv.includes("--apply")) {
    console.error("Pass --apply to provision the isolated Staging fixture.");
    process.exitCode = 1;
  } else {
    try {
      const result = await provisionMarketplaceRealWorkStagingFixture(process.env);
      console.log("MANGAI Marketplace Staging fixture provisioning");
      console.log("================================================");
      for (const item of result.audit.checks)
        console.log(`${item.ready ? "[READY]" : "[PENDING]"} ${item.label}`);
      console.log(`Checked profiles: ${result.audit.counts.checkedProfiles}`);
      console.log(`Publication pages: ${result.audit.counts.publicationPages}`);
      console.log(`Existing target orders: ${result.audit.counts.existingOrders}`);
      console.log("Credentials and identifiers: hidden");
      console.log("Production, Stripe, Provider, credit, publication, and sales: unchanged");
      if (!result.audit.passed) process.exitCode = 1;
    } catch (error) {
      console.error(
        error instanceof Error
          ? error.message
          : "Unable to provision the Staging fixture.",
      );
      process.exitCode = 1;
    }
  }
}
