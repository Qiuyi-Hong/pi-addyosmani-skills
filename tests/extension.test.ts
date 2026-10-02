import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import extension from "../pi-extension/index.ts";

test("packaged hooks preserve upstream's opt-in default", async () => {
  const upstream = JSON.parse(await readFile(new URL("../upstream/agent-skills/.claude-plugin/plugin.json", import.meta.url), "utf8"));
  assert.equal(upstream.hooks, undefined);
  await assert.rejects(access(new URL("../upstream/agent-skills/hooks/hooks.json", import.meta.url)), { code: "ENOENT" });
  await assert.rejects(access(new URL("../upstream/agent-skills/.claude/settings.json", import.meta.url)), { code: "ENOENT" });
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.deepEqual(manifest.pi.extensions, []);
});

test("package exposes adapted skills rather than raw upstream skills", async () => {
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.deepEqual(manifest.pi.skills, ["./skills"]);
});

test("explicitly loaded extension registers only simplify-ignore lifecycle adapters", () => {
  const commands: string[] = [];
  const events: string[] = [];
  extension({
    on(name: string) { events.push(name); },
    registerCommand(name: string) { commands.push(name); },
  } as unknown as Parameters<typeof extension>[0]);

  assert.deepEqual(commands, []);
  assert.deepEqual(events.sort(), ["agent_before_settle", "session_shutdown", "tool_call", "tool_result"]);
});
