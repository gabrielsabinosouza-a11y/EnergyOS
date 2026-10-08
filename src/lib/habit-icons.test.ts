import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_HABIT_ICON_ID, HABIT_ICON_ASSETS, getHabitAsset } from "./habit-icons";

test("every registered habit icon has a published public asset and stable id", () => {
  assert.ok(HABIT_ICON_ASSETS.length > 0);
  for (const asset of HABIT_ICON_ASSETS) {
    assert.ok(asset.id.length > 0);
    assert.ok(existsSync(resolve(process.cwd(), "public", asset.path.slice(1))), asset.path);
  }
});

test("legacy filenames resolve to the same stable asset IDs", () => {
  const firstAsset = HABIT_ICON_ASSETS[0];
  assert.equal(getHabitAsset(firstAsset.legacyFilename).id, firstAsset.id);
  assert.equal(getHabitAsset(`/old/path/${firstAsset.legacyFilename}`).id, firstAsset.id);
  assert.equal(getHabitAsset("unknown-old-icon.png").id, DEFAULT_HABIT_ICON_ID);
});
