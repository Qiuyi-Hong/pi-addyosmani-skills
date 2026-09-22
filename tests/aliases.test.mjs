import assert from "node:assert/strict";
import test from "node:test";

import extension from "../pi-extension/index.ts";

function harness() {
  const commands = new Map();
  const events = new Map();
  const sent = [];
  const pi = {
    on(name, handler) { events.set(name, handler); },
    registerCommand(name, options) { commands.set(name, options); },
    sendUserMessage(text, options) { sent.push({ text, options }); },
  };
  extension(pi);
  return { commands, events, sent };
}

test("registers thin review, plan, and build aliases", async () => {
  const { commands, sent } = harness();
  assert.deepEqual([...commands.keys()].sort(), ["build", "plan", "review"]);

  const idle = { isIdle: () => true };
  await commands.get("review").handler("src/index.ts", idle);
  assert.deepEqual(sent.at(-1), {
    text: "/skill:review src/index.ts",
    options: { expandPromptTemplates: true },
  });

  const busy = { isIdle: () => false };
  await commands.get("build").handler("auto", busy);
  assert.deepEqual(sent.at(-1), {
    text: "/skill:build auto",
    options: { deliverAs: "followUp", expandPromptTemplates: true },
  });
});
