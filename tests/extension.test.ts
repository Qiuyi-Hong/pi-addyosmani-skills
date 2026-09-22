import assert from "node:assert/strict";
import test from "node:test";

import extension from "../pi-extension/index.ts";

test("extension registers only simplify-ignore lifecycle adapters", () => {
  const commands: string[] = [];
  const events: string[] = [];
  extension({
    on(name: string) { events.push(name); },
    registerCommand(name: string) { commands.push(name); },
  } as unknown as Parameters<typeof extension>[0]);

  assert.deepEqual(commands, []);
  assert.deepEqual(events.sort(), ["agent_before_settle", "session_shutdown", "tool_call", "tool_result"]);
});
