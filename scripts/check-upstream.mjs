import { access, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { HOOK_CLASSIFICATIONS } from "../pi-extension/compatibility.ts";
import { checkGeneratedSkills } from "./generate-command-skills.mjs";
import { inspectUpstream, snapshotDigest } from "./upstream-files.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const snapshot = join(root, "upstream", "agent-skills");
const lock = JSON.parse(await readFile(join(root, "upstream.lock.json"), "utf8"));
const actual = await inspectUpstream(snapshot);
const errors = [];

const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
if (actual.version !== lock.version) errors.push(`version mismatch: lock=${lock.version} snapshot=${actual.version}`);
if (await snapshotDigest(snapshot) !== lock.snapshotSha256) errors.push("vendored upstream content differs from upstream.lock.json");
if (!same(actual.commands, lock.commands)) errors.push("upstream commands differ from upstream.lock.json");
if (!same(actual.hooks, lock.hooks)) errors.push("upstream hooks differ from upstream.lock.json");
try {
  await access(join(snapshot, ".git"));
  errors.push("vendored upstream must not contain .git");
} catch {}

for (const error of await checkGeneratedSkills(root)) errors.push(error);
for (const hook of actual.hooks) {
  if (!(hook in HOOK_CLASSIFICATIONS)) errors.push(`unclassified upstream hook: ${hook}`);
}
for (const hook of Object.keys(HOOK_CLASSIFICATIONS)) {
  if (!actual.hooks.includes(hook)) errors.push(`classification remains for removed hook: ${hook}`);
}
const simplifyIgnore = await readFile(join(snapshot, "hooks", "simplify-ignore.sh"), "utf8");
for (const contract of [".tool_name", ".tool_input.file_path", '[ -z "$TOOL_NAME" ]']) {
  if (!simplifyIgnore.includes(contract)) errors.push(`simplify-ignore input contract changed: missing ${contract}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Upstream ${lock.version} (${lock.commit}) is compatible: ${actual.commands.length} commands, ${actual.hooks.length} hooks.`);
}
