import assert from "node:assert/strict";
import test from "node:test";
import { resolveDezgoFeatureFlags } from "../dist-main/main/ai/dezgo-feature-flags.js";
import {
  ProviderCredentialError,
  ProviderCredentialStore,
} from "../dist-main/main/ai/provider-credential-store.js";

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

function memoryKeyring(options = {}) {
  let password;
  return {
    factory: async (service, account) => {
      assert.equal(service, "MANGAI Desktop");
      assert.equal(account, "image-provider.dezgo.api-key");
      if (options.factoryError) throw options.factoryError;
      return {
        async setPassword(value) {
          if (options.writeError) throw options.writeError;
          password = value;
        },
        async getPassword() {
          if (options.readError) throw options.readError;
          return password;
        },
        async deleteCredential() {
          if (options.deleteError) throw options.deleteError;
          const existed = Boolean(password);
          password = undefined;
          return existed;
        },
      };
    },
    current: () => password,
  };
}

test("provider credentials use a fixed OS keyring account and can be deleted", async () => {
  const keyring = memoryKeyring();
  const store = new ProviderCredentialStore(keyring.factory);
  assert.equal(await store.has("dezgo"), false);
  await store.set("dezgo", "  dezgo-secret-value  ");
  assert.equal(keyring.current(), "dezgo-secret-value");
  assert.equal(await store.has("dezgo"), true);
  assert.equal(await store.get("dezgo"), "dezgo-secret-value");
  assert.equal(await store.delete("dezgo"), true);
  assert.equal(await store.has("dezgo"), false);
});

test("provider credential errors fail closed without exposing the secret", async () => {
  const secret = "dezgo-secret-must-not-leak";
  const keyring = memoryKeyring({ writeError: new Error(`failed ${secret}`) });
  const store = new ProviderCredentialStore(keyring.factory);
  await assert.rejects(store.set("dezgo", secret), (error) => {
    assert.ok(error instanceof ProviderCredentialError);
    assert.equal(error.code, "CREDENTIAL_WRITE_FAILED");
    assert.doesNotMatch(error.message, new RegExp(secret));
    return true;
  });
});

test("provider credentials never fall back when the OS keyring is unavailable", async () => {
  const store = new ProviderCredentialStore(
    memoryKeyring({ factoryError: new Error("native module unavailable") })
      .factory,
  );
  await assert.rejects(store.get("dezgo"), (error) => {
    assert.ok(error instanceof ProviderCredentialError);
    assert.equal(error.code, "CREDENTIAL_STORE_UNAVAILABLE");
    return true;
  });
});
