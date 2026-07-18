import assert from "node:assert/strict";
import test from "node:test";
import { configuredCapabilities } from "../src/lib/cloud-ai-registry.ts";

test("real Cloud Provider fails closed until its pricing version is configured", () => {
  const previousEnabled = process.env.MANGAI_CLOUD_IMAGE_ENABLED;
  const previousPricing = process.env.MANGAI_CLOUD_IMAGE_PRICING_VERSION;
  try {
    process.env.MANGAI_CLOUD_IMAGE_ENABLED = "true";
    delete process.env.MANGAI_CLOUD_IMAGE_PRICING_VERSION;
    let image = configuredCapabilities().find(
      (capability) => capability.providerId === "mangai-cloud-image",
    );
    assert.equal(image.enabled, false);
    assert.equal(image.pricingVersion, "unconfigured");

    process.env.MANGAI_CLOUD_IMAGE_PRICING_VERSION = "provider-price-test-v1";
    image = configuredCapabilities().find(
      (capability) => capability.providerId === "mangai-cloud-image",
    );
    assert.equal(image.enabled, true);
    assert.equal(image.pricingVersion, "provider-price-test-v1");
  } finally {
    if (previousEnabled === undefined)
      delete process.env.MANGAI_CLOUD_IMAGE_ENABLED;
    else process.env.MANGAI_CLOUD_IMAGE_ENABLED = previousEnabled;
    if (previousPricing === undefined)
      delete process.env.MANGAI_CLOUD_IMAGE_PRICING_VERSION;
    else process.env.MANGAI_CLOUD_IMAGE_PRICING_VERSION = previousPricing;
  }
});
