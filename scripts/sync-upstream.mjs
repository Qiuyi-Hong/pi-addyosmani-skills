import { cp, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { generateCommandSkills } from "./generate-command-skills.mjs";
import { diffNames, inspectUpstream, snapshotDigest } from "./upstream-files.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repository = "https://github.com/addyosmani/agent-skills.git";
const refIndex = process.argv.indexOf("--ref");
const ref = refIndex >= 0 ? process.argv[refIndex + 1] : "main";
if (!ref) throw new Error("--ref requires a value");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", stdio: options.capture ? "pipe" : "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed with exit ${result.status}`);
  return result.stdout?.trim();
}

const temp = await mkdtemp(join(tmpdir(), "pi-addyosmani-skills-"));
const checkout = join(temp, "checkout");
const target = join(root, "upstream", "agent-skills");
const staged = join(root, "upstream", `.agent-skills-${process.pid}`);
let previous = { commands: [], hooks: [] };
try {
  previous = JSON.parse(await readFile(join(root, "upstream.lock.json"), "utf8"));
} catch {}

try {
  run("git", ["init", "--quiet", checkout]);
  run("git", ["-C", checkout, "remote", "add", "origin", repository]);
  run("git", ["-C", checkout, "fetch", "--quiet", "--depth=1", "origin", ref]);
  run("git", ["-C", checkout, "checkout", "--quiet", "--detach", "FETCH_HEAD"]);
  const commit = run("git", ["-C", checkout, "rev-parse", "HEAD"], { capture: true });
  const next = await inspectUpstream(checkout);

  await rm(staged, { recursive: true, force: true });
  await cp(checkout, staged, { recursive: true, filter: (path) => !path.split("/").includes(".git") });
  await rm(target, { recursive: true, force: true });
  await rename(staged, target);

  const lock = {
    schemaVersion: 1,
    repository,
    ref,
    commit,
    version: next.version,
    snapshotSha256: await snapshotDigest(target),
    commands: next.commands,
    hooks: next.hooks,
  };
  await writeFile(join(root, "upstream.lock.json"), `${JSON.stringify(lock, null, 2)}\n`, "utf8");
  await generateCommandSkills(root);

  for (const [label, change] of Object.entries({ commands: diffNames(previous.commands, next.commands), hooks: diffNames(previous.hooks, next.hooks) })) {
    console.log(`${label}: +[${change.added.join(", ")}] -[${change.removed.join(", ")}]`);
  }
  run(process.execPath, ["--experimental-strip-types", join(root, "scripts", "check-upstream.mjs")]);
  console.log(`Pinned agent-skills ${next.version} at ${commit}.`);
} finally {
  await rm(staged, { recursive: true, force: true });
  await rm(temp, { recursive: true, force: true });
}
