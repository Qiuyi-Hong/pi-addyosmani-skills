import assert from "node:assert/strict";
import test from "node:test";

import { checkGeneratedSkills } from "../scripts/generate-command-skills.ts";

const root = new URL("..", import.meta.url).pathname;

test("generated command skills are up to date", async () => {
  assert.deepEqual(await checkGeneratedSkills(root), []);
});
