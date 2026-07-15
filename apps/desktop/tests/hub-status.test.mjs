import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import {
  fetchHubStatus,
  normalizeHubBaseUrl,
  pollHubDeviceAuthorization,
  revokeHubDeviceAuthorization,
  startHubDeviceAuthorization,
  updateHubDraft,
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
          description: "作品説明",
          status: "published",
          isPublic: true,
          updatedAt: "2026-07-14T12:00:00.000Z",
          path: `/works/${workId}`,
          canWriteDraft: false,
        },
        sales: {
          activeProductCount: 2,
          pausedProductCount: 0,
          available: true,
        },
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

test("Hub端末認証の開始・承認確認・解除", async () => {
  const token = "A".repeat(43);
  let revoked = false;
  const mock = await server((request, response) => {
    response.setHeader("content-type", "application/json");
    if (
      request.url === "/api/desktop/device/authorize" &&
      request.method === "POST"
    ) {
      let body = "";
      request.on("data", (chunk) => (body += chunk));
      request.on("end", () => {
        assert.deepEqual(JSON.parse(body).scopes, [
          "works:read",
          "works:write:draft",
        ]);
        response.end(
          JSON.stringify({
            status: "pending",
            deviceToken: token,
            userCode: "ABCD-2345",
            verificationPath: "/dashboard/devices/authorize?code=ABCD-2345",
            expiresAt: "2026-07-14T13:00:00.000Z",
            intervalSeconds: 5,
          }),
        );
      });
      return;
    }
    assert.equal(request.headers.authorization, `Bearer ${token}`);
    if (request.method === "GET")
      return response.end(
        JSON.stringify({
          status: "approved",
          approvedAt: "2026-07-14T12:00:00.000Z",
          tokenExpiresAt: "2026-10-12T12:00:00.000Z",
          scopes: ["works:read", "works:write:draft"],
        }),
      );
    if (request.method === "DELETE") {
      revoked = true;
      return response.end(JSON.stringify({ revoked: true }));
    }
    response.statusCode = 404;
    response.end("{}");
  });
  try {
    const started = await startHubDeviceAuthorization(
      mock.url,
      "MANGAI Desktop",
    );
    assert.equal(started.userCode, "ABCD-2345");
    const polled = await pollHubDeviceAuthorization(
      mock.url,
      started.deviceToken,
    );
    assert.equal(polled.status, "approved");
    assert.equal(
      await revokeHubDeviceAuthorization(mock.url, started.deviceToken),
      true,
    );
    assert.equal(revoked, true);
  } finally {
    await mock.close();
  }
});

test("本人確認済み端末から非公開下書きの作品名と説明を更新する", async () => {
  const projectId = randomUUID();
  const workId = randomUUID();
  const token = "B".repeat(43);
  const mock = await server((request, response) => {
    assert.equal(request.method, "PATCH");
    assert.equal(request.headers.authorization, `Bearer ${token}`);
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      assert.deepEqual(JSON.parse(body), {
        title: "Desktop作品",
        description: "Desktop説明",
        expectedUpdatedAt: "2026-07-15T01:00:00.000Z",
      });
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          updated: true,
          work: {
            id: workId,
            title: "Desktop作品",
            description: "Desktop説明",
            updatedAt: "2026-07-15T02:00:00.000Z",
          },
        }),
      );
    });
  });
  try {
    const result = await updateHubDraft(
      projectId,
      mock.url,
      {
        title: "Desktop作品",
        description: "Desktop説明",
        expectedUpdatedAt: "2026-07-15T01:00:00.000Z",
      },
      token,
    );
    assert.equal(result.updated, true);
    assert.equal(result.work.id, workId);
  } finally {
    await mock.close();
  }
});

test("Hub側の更新競合メッセージを利用者へ返す", async () => {
  const mock = await server((_request, response) => {
    response.statusCode = 409;
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        message:
          "Hub側で作品が更新されています。再確認してからやり直してください。",
      }),
    );
  });
  try {
    await assert.rejects(
      updateHubDraft(
        randomUUID(),
        mock.url,
        {
          title: "作品",
          description: "説明",
          expectedUpdatedAt: "2026-07-15T01:00:00.000Z",
        },
        "C".repeat(43),
      ),
      /Hub側で作品が更新/,
    );
  } finally {
    await mock.close();
  }
});

test("Hub端末認証のrate limitを利用者へ通知する", async () => {
  const mock = await server((_request, response) => {
    response.statusCode = 429;
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        message:
          "端末認証の開始回数が上限に達しました。15分後に再試行してください。",
      }),
    );
  });
  try {
    await assert.rejects(
      startHubDeviceAuthorization(mock.url, "MANGAI Desktop"),
      /15分後に再試行/,
    );
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
