import assert from "node:assert/strict";
import test from "node:test";
import { requestOriginFromHeaders } from "../src/lib/request-origin.ts";

test("Vercel proxyの公開ホストを優先してoriginを作る", () => {
  const headers = new Headers({
    host: "internal-deployment.example.vercel.app",
    "x-forwarded-host": "branch-alias.example.vercel.app",
    "x-forwarded-proto": "https",
  });

  assert.equal(
    requestOriginFromHeaders(headers),
    "https://branch-alias.example.vercel.app",
  );
});

test("localhostはforwarded protocolがなければhttpを使う", () => {
  assert.equal(
    requestOriginFromHeaders(new Headers({ host: "localhost:3000" })),
    "http://localhost:3000",
  );
});

test("不正なHost headerを拒否する", () => {
  assert.equal(
    requestOriginFromHeaders(
      new Headers({
        host: "safe.example.com",
        "x-forwarded-host": "safe.example.com/path",
      }),
    ),
    null,
  );
});
