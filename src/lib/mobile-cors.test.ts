import assert from "node:assert/strict";
import test from "node:test";

import { isAllowedMobileWebOrigin } from "./mobile-cors";

test("allows local Expo web origins in development", () => {
  assert.equal(isAllowedMobileWebOrigin("http://localhost:8081", "development", ""), true);
  assert.equal(isAllowedMobileWebOrigin("http://192.168.1.50:8081", "development", ""), true);
});

test("requires explicit production origins", () => {
  assert.equal(isAllowedMobileWebOrigin("http://localhost:8081", "production", ""), false);
  assert.equal(
    isAllowedMobileWebOrigin(
      "https://mobile.example.com",
      "production",
      "https://mobile.example.com, https://preview.example.com",
    ),
    true,
  );
  assert.equal(
    isAllowedMobileWebOrigin("https://other.example.com", "production", "https://mobile.example.com"),
    false,
  );
});
