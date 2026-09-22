import { createHash } from "node:crypto";
import { readFile, readdir, readlink, stat } from "node:fs/promises";
import { join, relative } from "node:path";

export async function inspectUpstream(snapshotDir) {
  const commandDir = join(snapshotDir, ".claude", "commands");
  const hookDir = join(snapshotDir, "hooks");
  const commands = (await readdir(commandDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name.slice(0, -3))
    .sort();
  const hooks = (await readdir(hookDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && !entry.name.includes("-test.") && !entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort();
  const plugin = JSON.parse(await readFile(join(snapshotDir, ".claude-plugin", "plugin.json"), "utf8"));
  return { commands, hooks, version: plugin.version };
}

export async function snapshotDigest(snapshotDir) {
  const items = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === ".git") continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile() || entry.isSymbolicLink()) items.push({ path, link: entry.isSymbolicLink() });
    }
  }
  await walk(snapshotDir);
  const digest = createHash("sha256");
  for (const item of items.sort((left, right) => left.path < right.path ? -1 : 1)) {
    if (item.link) {
      digest.update(`${relative(snapshotDir, item.path)}\0link\0${await readlink(item.path)}\0`);
    } else {
      const metadata = await stat(item.path);
      digest.update(`${relative(snapshotDir, item.path)}\0${metadata.mode & 0o111}\0`);
      digest.update(await readFile(item.path));
      digest.update("\0");
    }
  }
  return digest.digest("hex");
}

export function diffNames(before = [], after = []) {
  return {
    added: after.filter((name) => !before.includes(name)),
    removed: before.filter((name) => !after.includes(name)),
  };
}
