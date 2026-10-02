import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import test from "node:test";

import { loadSkillsFromDir } from "@earendil-works/pi-coding-agent";

import { listCommandFiles, renderCommandSkill } from "../scripts/generate-command-skills.ts";

const root = new URL("..", import.meta.url).pathname;

test("every upstream Claude command has one generated Pi skill", async () => {
  const commands = await listCommandFiles(root);
  const generatedNames = (await readdir(join(root, "skills"), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name !== "upstream")
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

test("Pi discovers all adapted upstream skills and commands without loading supporting files as skills", async () => {
  const upstreamNames = (await readdir(join(root, "upstream/agent-skills/skills"), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  const commandNames = (await listCommandFiles(root)).map((path) => basename(path, ".md"));
  const { skills, diagnostics } = loadSkillsFromDir({ dir: join(root, "skills"), source: "path" });
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(skills.map((skill) => skill.name).sort(), [...upstreamNames, ...commandNames].sort());
  for (const skill of skills) {
    const content = (await readFile(skill.filePath, "utf8")).replace(/^<!-- Generated from .* -->\n/m, "");
    assert.doesNotMatch(content, /\.claude\//);
  }
});
