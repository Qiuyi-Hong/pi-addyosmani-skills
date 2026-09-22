import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { toSimplifyIgnorePayload } from "../pi-extension/compatibility.ts";
import extension from "../pi-extension/index.ts";

test("converts Pi lifecycle events to simplify-ignore hook payloads", () => {
  assert.deepEqual(
    toSimplifyIgnorePayload({ type: "tool_call", toolName: "read", input: { path: "src/a.ts" } }),
    { tool_name: "Read", tool_input: { file_path: "src/a.ts" } },
  );
  assert.deepEqual(
    toSimplifyIgnorePayload({ type: "tool_result", toolName: "edit", input: { path: "src/a.ts" } }),
    { tool_name: "Edit", tool_input: { file_path: "src/a.ts" } },
  );
  assert.deepEqual(
    toSimplifyIgnorePayload({ type: "tool_result", toolName: "write", input: { path: "src/a.ts" } }),
    { tool_name: "Write", tool_input: { file_path: "src/a.ts" } },
  );
  assert.deepEqual(toSimplifyIgnorePayload({ type: "agent_before_settle" }), {});
  assert.deepEqual(toSimplifyIgnorePayload({ type: "session_shutdown" }), {});
  assert.equal(
    toSimplifyIgnorePayload({ type: "tool_call", toolName: "bash", input: { command: "true" } }),
    null,
  );
});

test("reading this test source does not let the hook rewrite it", { skip: spawnSync("jq", ["--version"]).status !== 0 }, async () => {
  const cwd = await mkdtemp(join(tmpdir(), "pi-source-read-"));
  try {
    const source = await readFile(fileURLToPath(import.meta.url), "utf8");
    const path = join(cwd, "source.ts");
    await writeFile(path, source);
    const script = fileURLToPath(new URL("../upstream/agent-skills/hooks/simplify-ignore.sh", import.meta.url));
    const result = spawnSync("bash", [script], {
      cwd,
      env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
      input: JSON.stringify({ tool_name: "Read", tool_input: { file_path: path } }),
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(await readFile(path, "utf8"), source);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("Pi events drive the unchanged simplify-ignore script", { skip: spawnSync("jq", ["--version"]).status !== 0 }, async () => {
  const cwd = await mkdtemp(join(tmpdir(), "pi-simplify-ignore-"));
  const path = join(cwd, "example.js");
  type Handler = (event: Parameters<typeof toSimplifyIgnorePayload>[0], ctx: { cwd: string }) => void;
  const events = new Map<string, Handler>();
  const pi = {
    on(name: string, handler: Handler) { events.set(name, handler); },
    registerCommand() {},
    sendUserMessage() {},
  };
  extension(pi as unknown as Parameters<typeof extension>[0]);

  try {
    const marker = "simplify-ignore";
    await writeFile(path, `before\n// ${marker}-start\nconst secret = 42;\n// ${marker}-end\nafter\n`);
    const toolCall = events.get("tool_call");
    assert.ok(toolCall);
    toolCall({ type: "tool_call", toolName: "read", input: { path } }, { cwd });
    assert.match(await readFile(path, "utf8"), /BLOCK_[0-9a-f]{8}/);

    const beforeSettle = events.get("agent_before_settle");
    assert.ok(beforeSettle);
    beforeSettle({ type: "agent_before_settle" }, { cwd });
    assert.match(await readFile(path, "utf8"), /const secret = 42;/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
