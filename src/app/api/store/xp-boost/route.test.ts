import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST } from "./route";

test("POST /api/store/xp-boost rejects invalid quantities with a Portuguese 400", async () => {
  const request = new NextRequest("http://localhost/api/store/xp-boost", {
    method: "POST",
    body: JSON.stringify({
      quantity: 3,
      idempotencyKey: "12c0c318-66e7-4f70-9364-756d0c461713",
    }),
  });

  const response = await POST(request);
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.match(payload.error, /Quantidade.*2/);
});
