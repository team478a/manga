import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import {
  fetchHubStatus,
  normalizeHubBaseUrl,
} from "../dist-main/main/hub-status.js";

async function server(handler) {
  const instance = http.createServer(handler);
  await new Promise((resolve) => instance.listen(0, "127.0.0.1", resolve));
  const address = instance.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => instance.close(resolve)),
  };
}

test("Hub URLはHTTPSとlocalhost HTTPだけを許可する", () => {
  assert.equal(
    normalizeHubBaseUrl("https://hub.example.com/"),
    "https://hub.example.com",
  );
  assert.equal(
    normalizeHubBaseUrl("http://localhost:3000/"),
    "http://localhost:3000",
  );
  assert.throws(() => normalizeHubBaseUrl("http://hub.example.com"), /HTTPS/);
  assert.throws(
    () => normalizeHubBaseUrl("https://user:pass@hub.example.com"),
    /認証情報/,
  );
  assert.throws(
    () => normalizeHubBaseUrl("https://hub.example.com?x=1"),
    /クエリ/,
  );
});

test("公開作品と販売状況をHubから取得する", async () => {
  const projectId = randomUUID();
  const workId = randomUUID();
  const mock = await server((request, response) => {
    assert.equal(request.url, `/api/desktop/projects/${projectId}/status`);
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        linked: true,
        projectId,
        work: {
          id: workId,
          title: "公開作品",
          updatedAt: "2026-07-14T12:00:00.000Z",
          path: `/works/${workId}`,
        },
        sales: { activeProductCount: 2, available: true },
      }),
    );
  });
  try {
    const result = await fetchHubStatus(projectId, mock.url);
    assert.equal(result.linked, true);
    assert.equal(result.sales.activeProductCount, 2);
  } finally {
    await mock.close();
  }
});

test("非公開Projectは未連携として扱う", async () => {
  const projectId = randomUUID();
  const mock = await server((_request, response) => {
    response.statusCode = 404;
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({ linked: false, message: "公開作品は見つかりません。" }),
    );
  });
  try {
    assert.deepEqual(await fetchHubStatus(projectId, mock.url), {
      linked: false,
      message: "公開作品は見つかりません。",
    });
  } finally {
    await mock.close();
  }
});
