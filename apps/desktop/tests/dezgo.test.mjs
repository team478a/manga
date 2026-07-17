import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { resolveDezgoFeatureFlags } from "../dist-main/main/ai/dezgo-feature-flags.js";
import {
  ProviderCredentialError,
  ProviderCredentialStore,
} from "../dist-main/main/ai/provider-credential-store.js";
import {
  DezgoClient,
  DezgoProvider,
} from "../dist-main/main/ai/providers/dezgo.js";
import { MangaiDatabase } from "../dist-main/main/database.js";

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

const dezgoInfo = {
  name: "Dezgo",
  version: "test",
  models: [
    {
      id: "model-from-api",
      name: "Model from API",
      family: "sd1",
      description: "Test model",
      license: "test-license",
      categories: ["art"],
      functions: ["text2image", "image2image", "unknown-future-function"],
      nativeResolution: { width: 512, height: 512 },
      triggers: ["test trigger"],
      futureField: true,
    },
  ],
  futureTopLevelField: true,
};

function dezgoFetch(options = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (options.waitForAbort)
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener(
          "abort",
          () => reject(new Error("aborted")),
          {
            once: true,
          },
        );
      });
    if (options.status)
      return new Response(options.errorBody ?? "provider error", {
        status: options.status,
      });
    const body = url.endsWith("/info") ? dezgoInfo : { balance: 4.25 };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  return { calls, fetchImpl };
}

test("Dezgo provider validates credentials and normalizes model metadata", async () => {
  const mock = dezgoFetch();
  const provider = new DezgoProvider(async () => "test-dezgo-api-key", {
    fetchImpl: mock.fetchImpl,
  });
  const connection = await provider.checkConnection();
  assert.equal(connection.ok, true);
  assert.equal(mock.calls.length, 2);
  for (const call of mock.calls) {
    assert.equal(new URL(call.url).origin, "https://api.dezgo.com");
    assert.equal(call.init.redirect, "error");
    assert.equal(call.init.headers["X-Dezgo-Key"], "test-dezgo-api-key");
  }

  const models = await provider.listModels();
  assert.deepEqual(models[0], {
    id: "model-from-api",
    name: "Model from API",
    family: "sd1",
    description: "Test model",
    license: "test-license",
    categories: ["art"],
    supportedFunctions: ["text_to_image", "image_to_image"],
    nativeResolution: { width: 512, height: 512 },
    triggers: ["test trigger"],
    fetchedAt: models[0].fetchedAt,
  });
  assert.match(models[0].fetchedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(await provider.getBalance(), 4.25);
});

test("Dezgo HTTP errors are classified without exposing keys or response bodies", async () => {
  const secret = "test-dezgo-api-key-must-not-leak";
  const mock = dezgoFetch({
    status: 401,
    errorBody: `invalid key ${secret}`,
  });
  const client = new DezgoClient(async () => secret, mock.fetchImpl);
  await assert.rejects(client.balance(), (error) => {
    assert.equal(error.code, "DEZGO_API_KEY_INVALID");
    assert.doesNotMatch(error.message, new RegExp(secret));
    assert.doesNotMatch(error.message, /invalid key/);
    assert.equal(error.retryable, false);
    return true;
  });
});

test("Dezgo connection timeout aborts the request with a fixed message", async () => {
  const mock = dezgoFetch({ waitForAbort: true });
  const client = new DezgoClient(
    async () => "test-dezgo-api-key",
    mock.fetchImpl,
    10,
  );
  await assert.rejects(client.info(), (error) => {
    assert.equal(error.code, "DEZGO_TIMEOUT");
    assert.equal(error.retryable, true);
    return true;
  });
  assert.equal(mock.calls[0].init.signal.aborted, true);
});

test("Dezgo generation remains disabled while read-only Phase 1 setup is built", async () => {
  const provider = new DezgoProvider(async () => "test-dezgo-api-key", {
    fetchImpl: dezgoFetch().fetchImpl,
  });
  await assert.rejects(provider.generateImage({}), (error) => {
    assert.equal(error.code, "DEZGO_GENERATION_DISABLED");
    return true;
  });
});

test("Dezgo model metadata survives the SQLite cache", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-dezgo-cache-"));
  const database = new MangaiDatabase({
    root,
    database: path.join(root, "db.sqlite"),
    projects: path.join(root, "projects"),
    assets: path.join(root, "assets"),
    exports: path.join(root, "exports"),
    logs: path.join(root, "logs"),
  });
  try {
    database.saveAIModels("dezgo", [
      {
        id: "cached-model",
        name: "Cached model",
        family: "sdxl",
        categories: ["anime"],
        supportedFunctions: ["text_to_image"],
        nativeResolution: { width: 1024, height: 1024 },
        triggers: null,
        fetchedAt: "2026-07-17T00:00:00.000Z",
      },
    ]);
    const cached = database.listAIModels("dezgo")[0];
    assert.equal(cached.family, "sdxl");
    assert.deepEqual(cached.categories, ["anime"]);
    assert.deepEqual(cached.supportedFunctions, ["text_to_image"]);
    assert.deepEqual(cached.nativeResolution, { width: 1024, height: 1024 });
    assert.equal(cached.cached, true);
  } finally {
    database.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
