import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

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

test("Pi events drive the unchanged simplify-ignore script", { skip: spawnSync("jq", ["--version"]).status !== 0 }, async () => {
  const cwd = await mkdtemp(join(tmpdir(), "pi-simplify-ignore-"));
  const path = join(cwd, "example.js");
  const events = new Map();
  const pi = {
    on(name, handler) { events.set(name, handler); },
    registerCommand() {},
    sendUserMessage() {},
  };
  extension(pi);

  try {
    await writeFile(path, "before\n// simplify-ignore-start\nconst secret = 42;\n// simplify-ignore-end\nafter\n");
    await events.get("tool_call")({ type: "tool_call", toolName: "read", input: { path } }, { cwd });
    assert.match(await readFile(path, "utf8"), /BLOCK_[0-9a-f]{8}/);

    await events.get("agent_before_settle")({ type: "agent_before_settle" }, { cwd });
    assert.match(await readFile(path, "utf8"), /const secret = 42;/);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
