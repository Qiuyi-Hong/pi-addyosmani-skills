import assert from "node:assert/strict";
import { access, chmod, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import { checkGeneratedSkills, generateCommandSkills, renderCommandSkill } from "../scripts/generate-command-skills.ts";
import { snapshotDigest } from "../scripts/upstream-files.ts";

test("command generation adds Pi frontmatter without duplicating workflow content", () => {
  const source = `---\ndescription: Example command\n---\n\nInvoke agent-skills:test-driven-development.\n\n$ARGUMENTS\n`;
  const generated = renderCommandSkill("example", source, ".claude/commands/example.md");

  assert.match(generated, /^---\nname: example\ndescription: Example command\n---/);
  assert.match(generated, /Pi compatibility/);
  assert.ok(generated.endsWith("\nInvoke agent-skills:test-driven-development.\n\n$ARGUMENTS\n"));
});

async function createSnapshotFixture() {
  const root = await mkdtemp(join(tmpdir(), "pi-skill-generation-"));
  const snapshot = join(root, "upstream", "agent-skills");
  const sources = new Map<string, string | Buffer>([
    [".claude/commands/example.md", "---\ndescription: Example\n---\nUse .claude/agents/ and ~/.claude/settings.json.\n"],
    ["skills/example-workflow/SKILL.md", "---\nname: example-workflow\ndescription: Example workflow\n---\n[Details](references/guide.md). See ../../references/checklist.md. Use .claude/skills/. Run `skills/example-workflow/scripts/setup.sh`. Read `skills/another-workflow/SKILL.md`. Preserve `.claude/skills/another-workflow/SKILL.md` and https://example.org/skills/another-workflow/SKILL.md and `docs/ideas/example.md`.\n"],
    ["skills/another-workflow/SKILL.md", "---\nname: another-workflow\ndescription: Another workflow\n---\nBody\n"],
    ["skills/example-workflow/references/guide.md", "# Guide\nUse ~/.claude/agents/.\n"],
    ["skills/example-workflow/scripts/setup.sh", "#!/bin/bash\nmkdir -p .claude/example-cache\n"],
    ["skills/example-workflow/assets/data.bin", Buffer.from([0, 255, 1, 2])],
    ["skills/example-workflow/assets/ascii.bin", Buffer.from(".claude/cache")],
    ["references/checklist.md", "# Checklist\nUse .claude/settings.json.\n"],
    ["references/orchestration-patterns.md", "# Orchestration\n### Setup (one-time, per-environment)\n\nAgent Teams is experimental. In `~/.claude/settings.json`:\n\n```json\n{\"env\": {\"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS\": \"1\"}}\n```\n\n### The trigger prompt\nClaude Code example.\n"],
    ["agents/reviewer.md", "---\nname: reviewer\ndescription: Review\n---\nSee ../docs/agents.md, `references/checklist.md`, and `skills/example-workflow/SKILL.md`.\n"],
    ["docs/agents.md", "# Personas\nSee ../agents/reviewer.md.\n"],
  ]);
  for (const [path, content] of sources) {
    await mkdir(dirname(join(snapshot, path)), { recursive: true });
    await writeFile(join(snapshot, path), content);
  }
  await chmod(join(snapshot, "skills/example-workflow/scripts/setup.sh"), 0o755);
  return { root, snapshot };
}

test("generation adapts all skill content and preserves supporting files without changing upstream", async () => {
  const { root, snapshot } = await createSnapshotFixture();
  try {
    const before = await snapshotDigest(snapshot);
    await generateCommandSkills(root);
    const adapted = join(root, "skills", "upstream");
    const skill = await readFile(join(adapted, "skills/example-workflow/SKILL.md"), "utf8");
    assert.match(skill, /^---\nname: example-workflow\ndescription: Example workflow\n---/);
    assert.match(skill, /Use \.pi\/skills\//);
    assert.match(skill, /\.\.\/\.\.\/references\/checklist\.md/);
    assert.match(skill, /Run `scripts\/setup\.sh`/);
    assert.match(skill, /Read `\.\.\/another-workflow\/SKILL\.md`/);
    assert.match(skill, /`\.pi\/skills\/another-workflow\/SKILL\.md`/);
    assert.match(skill, /https:\/\/example\.org\/skills\/another-workflow\/SKILL\.md/);
    assert.match(skill, /`docs\/ideas\/example\.md`/);
    const persona = await readFile(join(adapted, "agents/reviewer.md"), "utf8");
    assert.match(persona, /`\.\.\/references\/checklist\.md`/);
    assert.match(persona, /`\.\.\/skills\/example-workflow\/SKILL\.md`/);
    await access(join(adapted, "references/checklist.md"));
    await access(join(adapted, "docs/agents.md"));
    const orchestration = await readFile(join(adapted, "references/orchestration-patterns.md"), "utf8");
    assert.doesNotMatch(orchestration, /"env"/);
    assert.match(orchestration, /no equivalent Pi setting/);
    assert.match(await readFile(join(adapted, "skills/example-workflow/references/guide.md"), "utf8"), /~\/\.pi\/agent\/agents\//);
    assert.match(await readFile(join(root, "skills/example/SKILL.md"), "utf8"), /Use \.pi\/agents\/ and ~\/\.pi\/agent\/settings\.json/);
    assert.equal(await readFile(join(adapted, "skills/example-workflow/scripts/setup.sh"), "utf8"), "#!/bin/bash\nmkdir -p .pi/example-cache\n");
    assert.equal((await stat(join(adapted, "skills/example-workflow/scripts/setup.sh"))).mode & 0o111, 0o111);
    assert.deepEqual(await readFile(join(adapted, "skills/example-workflow/assets/data.bin")), Buffer.from([0, 255, 1, 2]));
    assert.deepEqual(await readFile(join(adapted, "skills/example-workflow/assets/ascii.bin")), Buffer.from(".claude/cache"));
    assert.equal(await snapshotDigest(snapshot), before);
    assert.deepEqual(await checkGeneratedSkills(root), []);

    await writeFile(join(adapted, "references/checklist.md"), "stale");
    await writeFile(join(adapted, "references/obsolete.md"), "unexpected");
    assert.deepEqual(await checkGeneratedSkills(root), [
      "unexpected skills/upstream/references/obsolete.md",
      "stale skills/upstream/references/checklist.md",
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("generation rejects symlinked supporting files before replacing existing output", async () => {
  const { root, snapshot } = await createSnapshotFixture();
  try {
    await generateCommandSkills(root);
    await writeFile(join(root, "private.md"), "private data");
    await rm(join(snapshot, "docs/agents.md"));
    await symlink(join(root, "private.md"), join(snapshot, "docs/agents.md"));
    await assert.rejects(generateCommandSkills(root), /Unsupported generated entry/);
    await access(join(root, "skills/example/SKILL.md"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("generated-file checks report a missing SKILL.md inside an existing directory", async () => {
  const { root } = await createSnapshotFixture();
  try {
    await generateCommandSkills(root);
    await rm(join(root, "skills", "example", "SKILL.md"));
    assert.deepEqual(await checkGeneratedSkills(root), ["missing skills/example/SKILL.md"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
