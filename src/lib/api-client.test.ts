import test from "node:test";
import assert from "node:assert/strict";
import { isRetryableStatus } from "./api-client";

test("4xx status codes are never retried", () => {
  assert.equal(isRetryableStatus(400), false);
  assert.equal(isRetryableStatus(401), false);
  assert.equal(isRetryableStatus(403), false);
  assert.equal(isRetryableStatus(404), false);
  assert.equal(isRetryableStatus(422), false);
});

test("5xx, 408 and 429 are retried", () => {
  assert.equal(isRetryableStatus(408), true);
  assert.equal(isRetryableStatus(429), true);
  assert.equal(isRetryableStatus(500), true);
  assert.equal(isRetryableStatus(502), true);
  assert.equal(isRetryableStatus(503), true);
  assert.equal(isRetryableStatus(504), true);
});

test("success and redirect codes are not retried (not errors)", () => {
  assert.equal(isRetryableStatus(200), false);
  assert.equal(isRetryableStatus(301), false);
});
