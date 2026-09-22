import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import test from "node:test";

import { listCommandFiles, renderCommandSkill } from "../scripts/generate-command-skills.ts";

const root = new URL("..", import.meta.url).pathname;

test("every upstream Claude command has one generated Pi skill", async () => {
  const commands = await listCommandFiles(root);
  const generatedNames = (await readdir(join(root, "skills"), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  assert.deepEqual(generatedNames, commands.map((path) => basename(path, ".md")));

  for (const commandPath of commands) {
    const name = basename(commandPath, ".md");
    const source = await readFile(commandPath, "utf8");
    const generated = await readFile(join(root, "skills", name, "SKILL.md"), "utf8");
    assert.equal(generated, renderCommandSkill(name, source, `.claude/commands/${name}.md`));
  }
});
