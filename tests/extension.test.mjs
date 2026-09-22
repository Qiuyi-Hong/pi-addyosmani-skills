import assert from "node:assert/strict";
import test from "node:test";

import extension from "../pi-extension/index.ts";

test("extension registers only simplify-ignore lifecycle adapters", () => {
  const commands = [];
  const events = [];
  extension({
    on(name) { events.push(name); },
    registerCommand(name) { commands.push(name); },
  });

  assert.deepEqual(commands, []);
  assert.deepEqual(events.sort(), ["agent_before_settle", "session_shutdown", "tool_call", "tool_result"]);
});
