import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { checkGeneratedSkills, renderCommandSkill } from "../scripts/generate-command-skills.mjs";

test("command generation adds Pi frontmatter without duplicating workflow content", () => {
  const source = `---\ndescription: Example command\n---\n\nInvoke agent-skills:test-driven-development.\n\n$ARGUMENTS\n`;
  const generated = renderCommandSkill("example", source, ".claude/commands/example.md");

  assert.match(generated, /^---\nname: example\ndescription: Example command\n---/);
  assert.match(generated, /Pi compatibility/);
  assert.ok(generated.endsWith("\nInvoke agent-skills:test-driven-development.\n\n$ARGUMENTS\n"));
});

test("generated-file checks report a missing SKILL.md inside an existing directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-command-generation-"));
  try {
    await mkdir(join(root, "upstream", "agent-skills", ".claude", "commands"), { recursive: true });
    await writeFile(join(root, "upstream", "agent-skills", ".claude", "commands", "example.md"), "---\ndescription: Example\n---\nBody\n");
    await mkdir(join(root, "skills", "example"), { recursive: true });

    assert.deepEqual(await checkGeneratedSkills(root), ["missing skills/example/SKILL.md"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
