import {
  CONTENT_POLICY_VERSION,
  assertGeneralCloudContent,
  contentExecutionPolicySchema,
  type ContentExecutionPolicy,
} from "@mangai/shared";
import type { SalesPackageManifest } from "@mangai/export-core";

export const GENERAL_CLOUD_POLICY: ContentExecutionPolicy =
  contentExecutionPolicySchema.parse({
    version: CONTENT_POLICY_VERSION,
    contentClass: "general",
    productSurface: "cloud",
    allowedTargets: ["cloud_provider"],
    externalConfirmationRequired: false,
  });

export function assertGeneralSalesPackage(manifest: SalesPackageManifest) {
  assertGeneralCloudContent(manifest.work);
  if (manifest.policyVersion !== CONTENT_POLICY_VERSION)
    throw new Error("販売パッケージの作品区分policyに対応していません。");
  return manifest;
}

export function generalCloudStoragePath(...segments: string[]) {
  const safe = segments.map((segment) =>
    segment.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 180),
  );
  if (safe.some((segment) => !segment))
    throw new Error("Cloud保存先を作成できません。");
  return ["general", ...safe].join("/");
}

const uuidSegmentPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function ownedMarketplaceStoragePath(
  authUserId: string,
  resourceId: string,
  ...segments: string[]
) {
  if (
    !uuidSegmentPattern.test(authUserId) ||
    !uuidSegmentPattern.test(resourceId)
  )
    throw new Error("所有者別のCloud保存先を作成できません。");
  if (
    segments.some(
      (segment) =>
        segment.includes("..") ||
        segment.includes("/") ||
        segment.includes("\\"),
    )
  )
    throw new Error("所有者別のCloud保存先を作成できません。");
  const safe = segments.map((segment) =>
    segment.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 180),
  );
  if (!safe.length || safe.some((segment) => !segment))
    throw new Error("所有者別のCloud保存先を作成できません。");
  return [authUserId.toLowerCase(), resourceId.toLowerCase(), ...safe].join(
    "/",
  );
}
