import assert from "node:assert/strict";
import test from "node:test";
import { resolveDezgoFeatureFlags } from "../dist-main/main/ai/dezgo-feature-flags.js";

test("Dezgo Phase 1 features are disabled by default", () => {
  assert.deepEqual(
    resolveDezgoFeatureFlags({ isPackaged: false, environment: {} }),
    {
      dezgoProviderEnabled: false,
      dezgoDirectByokEnabled: false,
      dezgoAdultGenerationEnabled: false,
      dezgoBatchGenerationEnabled: false,
    },
  );
});

test("development requires separate provider and BYOK opt-ins", () => {
  assert.deepEqual(
    resolveDezgoFeatureFlags({
      isPackaged: false,
      environment: {
        MANGAI_ENABLE_DEZGO_PROVIDER: "true",
        MANGAI_ENABLE_DEZGO_DIRECT_BYOK: "true",
        MANGAI_ENABLE_DEZGO_ADULT: "true",
        MANGAI_ENABLE_DEZGO_BATCH: "true",
      },
    }),
    {
      dezgoProviderEnabled: true,
      dezgoDirectByokEnabled: true,
      dezgoAdultGenerationEnabled: false,
      dezgoBatchGenerationEnabled: false,
    },
  );
  assert.equal(
    resolveDezgoFeatureFlags({
      isPackaged: false,
      environment: { MANGAI_ENABLE_DEZGO_DIRECT_BYOK: "true" },
    }).dezgoDirectByokEnabled,
    false,
  );
});

test("packaged builds ignore all Phase 1 environment opt-ins", () => {
  assert.deepEqual(
    resolveDezgoFeatureFlags({
      isPackaged: true,
      environment: {
        MANGAI_ENABLE_DEZGO_PROVIDER: "true",
        MANGAI_ENABLE_DEZGO_DIRECT_BYOK: "true",
      },
    }),
    {
      dezgoProviderEnabled: false,
      dezgoDirectByokEnabled: false,
      dezgoAdultGenerationEnabled: false,
      dezgoBatchGenerationEnabled: false,
    },
  );
});
