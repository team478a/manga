import crypto from "node:crypto";

export function hasValidInternalWorkerAuthorization(
  request: Request,
  expected: string | undefined,
) {
  const supplied = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (
    !expected ||
    !supplied ||
    expected.length < 32 ||
    supplied.length !== expected.length
  )
    return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
}
