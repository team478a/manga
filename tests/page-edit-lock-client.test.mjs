import assert from "node:assert/strict";
import test from "node:test";

import { getOrCreatePageEditLockToken } from "../src/app/creator/[projectId]/pages/[pageId]/services/page-edit-lock-client.ts";

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

test("same tab and page reuse the edit lock token", () => {
  const storage = createMemoryStorage();
  let calls = 0;
  const tokens = [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
  ];
  const createToken = () => tokens[calls++];

  assert.equal(
    getOrCreatePageEditLockToken("page-1", storage, createToken),
    tokens[0],
  );
  assert.equal(
    getOrCreatePageEditLockToken("page-1", storage, createToken),
    tokens[0],
  );
  assert.equal(calls, 1);
});

test("different tabs and pages do not share edit lock tokens", () => {
  const firstTab = createMemoryStorage();
  const secondTab = createMemoryStorage();
  let calls = 0;
  const tokens = [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
    "33333333-3333-4333-8333-333333333333",
  ];
  const createToken = () => tokens[calls++];

  assert.equal(
    getOrCreatePageEditLockToken("page-1", firstTab, createToken),
    tokens[0],
  );
  assert.equal(
    getOrCreatePageEditLockToken("page-2", firstTab, createToken),
    tokens[1],
  );
  assert.equal(
    getOrCreatePageEditLockToken("page-1", secondTab, createToken),
    tokens[2],
  );
});

test("invalid stored tokens are replaced before lease acquisition", () => {
  const storage = createMemoryStorage();
  storage.setItem("mangai:cloud-page-edit-lock:page-1", "not-a-uuid");

  assert.equal(
    getOrCreatePageEditLockToken(
      "page-1",
      storage,
      () => "44444444-4444-4444-8444-444444444444",
    ),
    "44444444-4444-4444-8444-444444444444",
  );
});

test("storage failures fall back to an ephemeral edit lock token", () => {
  const unavailableStorage = {
    getItem() {
      throw new Error("storage unavailable");
    },
    setItem() {
      throw new Error("storage unavailable");
    },
  };

  assert.equal(
    getOrCreatePageEditLockToken(
      "page-1",
      unavailableStorage,
      () => "55555555-5555-4555-8555-555555555555",
    ),
    "55555555-5555-4555-8555-555555555555",
  );
});
