import assert from "node:assert/strict";
import { mkdtemp, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { snapshotDigest } from "../scripts/upstream-files.mjs";

test("snapshot digest includes symbolic-link targets", async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-upstream-digest-"));
  try {
    await writeFile(join(root, "a"), "same");
    await writeFile(join(root, "b"), "same");
    await symlink("a", join(root, "current"));
    const before = await snapshotDigest(root);
    await unlink(join(root, "current"));
    await symlink("b", join(root, "current"));
    assert.notEqual(await snapshotDigest(root), before);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
