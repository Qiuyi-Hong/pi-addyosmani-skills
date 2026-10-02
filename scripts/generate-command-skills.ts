import { chmod, lstat, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, posix, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { adaptClaudePaths } from "../pi-extension/compatibility.ts";

const rootFromScript = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function splitCommand(source: string) {
  const normalized = source.replaceAll("\r\n", "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) throw new Error("Command must start with YAML frontmatter");
  return { frontmatter: match[1], body: normalized.slice(match[0].length) };
}

function compatibilityNote(body: string) {
  const notes = ["Upstream `/command` references map to generated `/skill:command` skills."];
  if (body.includes("agent-skills:")) notes.push("`agent-skills:<name>` refers to the bundled Pi skill `<name>` (`/skill:<name>`).");
  if (body.includes("$ARGUMENTS")) notes.push("`$ARGUMENTS` refers to arguments appended by Pi in the final `User:` line.");
  if (body.includes("Agent tool")) notes.push("Claude's Agent tool means Pi's configured subagent/delegation facility; use the source fallback when none is available.");
  if (body.includes("Claude Code") || body.includes(".claude/")) notes.push("Configuration uses `.pi/` for projects and `~/.pi/agent/` for users. Claude-only settings, plugin persona auto-discovery, and Agent Teams are not implemented by Pi.");
  return `\n> **Pi compatibility:** ${notes.join(" ")}\n`;
}

export function renderCommandSkill(name: string, source: string, sourcePath: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) throw new Error(`Invalid skill name: ${name}`);
  const { frontmatter, body } = splitCommand(source);
  const keptFrontmatter = frontmatter
    .split("\n")
    .filter((line) => !/^name\s*:/.test(line))
    .join("\n");
  const adaptedBody = adaptClaudePaths(body)
    .replaceAll("references/orchestration-patterns.md", "../upstream/references/orchestration-patterns.md")
    .replace(/^\*\*Persona resolution\.\*\*.*$/m, "**Persona resolution.** Use personas registered with your Pi delegation facility. Project and user definitions may live in `.pi/agents/` and `~/.pi/agent/agents/` if that facility supports those locations. Otherwise read the bundled prompts in `../upstream/agents/` relative to this skill and pass their instructions to a general-purpose subagent. Pi does not automatically discover this package's personas.");
  return `---\nname: ${name}\n${adaptClaudePaths(keptFrontmatter)}\n---\n${generatedMarker(sourcePath)}${compatibilityNote(body)}${adaptedBody}`;
}

export async function listCommandFiles(root: string = rootFromScript) {
  const commandDir = join(root, "upstream", "agent-skills", ".claude", "commands");
  return (await readdir(commandDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => join(commandDir, entry.name))
    .sort();
}

function generatedMarker(sourcePath: string) {
  return `<!-- Generated from upstream/agent-skills/${sourcePath} by scripts/generate-command-skills.ts; do not edit. -->\n`;
}

function rebaseBundledPaths(body: string, sourcePath: string, bundledPaths: Set<string>) {
  return body.replace(/(?<![\w./~-])(?:(?:skills|references|docs)\/[\w./-]+|agents\/[\w./-]*)/g, (path) => {
    const target = path.replace(/\/$/, "");
    const directory = posix.dirname(sourcePath);
    if (!bundledPaths.has(target) || bundledPaths.has(posix.join(directory, target))) return path;
    return posix.relative(directory, target) + (path.endsWith("/") ? "/" : "");
  });
}

function renderUpstreamMarkdown(source: string, sourcePath: string, bundledPaths: Set<string>) {
  const normalized = source.replaceAll("\r\n", "\n");
  const frontmatter = normalized.match(/^---\n[\s\S]*?\n---\n?/)?.[0] ?? "";
  let body = normalized.slice(frontmatter.length);
  if (sourcePath === "references/orchestration-patterns.md") {
    body = body.replace(/^### Setup \(one-time, per-environment\)\n[\s\S]*?(?=^### The trigger prompt)/m,
      "### Setup (one-time, per-environment)\n\nClaude Code Agent Teams has no equivalent Pi setting. Do not put its `env` configuration into `.pi/settings.json` or `~/.pi/agent/settings.json`. Use your configured delegation facility for supported Pi subagents. The following Agent Teams example is Claude-specific reference material, not a Pi workflow.\n\n");
  }
  return `${adaptClaudePaths(frontmatter)}${generatedMarker(sourcePath)}${compatibilityNote(normalized)}${rebaseBundledPaths(adaptClaudePaths(body), sourcePath, bundledPaths)}`;
}

async function listFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(path));
    else if (entry.isFile()) files.push(path);
    else throw new Error(`Unsupported generated entry: ${path}`);
  }
  return files.sort();
}

async function expectedFiles(root: string) {
  const expected = new Map<string, { content: Buffer; mode: number }>();
  for (const sourceFile of await listCommandFiles(root)) {
    const name = basename(sourceFile, ".md");
    const source = await readFile(sourceFile, "utf8");
    expected.set(`${name}/SKILL.md`, {
      content: Buffer.from(renderCommandSkill(name, source, `.claude/commands/${basename(sourceFile)}`)),
      mode: 0o644,
    });
  }

  // Keep the upstream layout so skill-local and shared-reference links still resolve.
  const snapshot = join(root, "upstream", "agent-skills");
  const sourceFiles = [join(snapshot, "docs", "agents.md")];
  for (const directory of ["skills", "references", "agents"]) sourceFiles.push(...await listFiles(join(snapshot, directory)));
  const bundledPaths = new Set<string>();
  for (const file of sourceFiles) {
    let path = relative(snapshot, file).split(sep).join("/");
    while (path !== ".") {
      bundledPaths.add(path);
      path = posix.dirname(path);
    }
  }
  for (const sourceFile of sourceFiles.sort()) {
    const sourcePath = relative(snapshot, sourceFile).split(sep).join("/");
    const metadata = await lstat(sourceFile);
    if (!metadata.isFile()) throw new Error(`Unsupported generated entry: ${sourceFile}`);
    let content = await readFile(sourceFile);
    const extension = extname(sourceFile);
    if (extension === ".md" || extension === ".sh") {
      const source = content.toString("utf8");
      content = Buffer.from(extension === ".md" ? renderUpstreamMarkdown(source, sourcePath, bundledPaths) : adaptClaudePaths(source));
    }
    expected.set(join("upstream", sourcePath), { content, mode: metadata.mode & 0o777 });
  }
  return expected;
}

export async function checkGeneratedSkills(root: string = rootFromScript) {
  const expected = await expectedFiles(root);
  const skillsDir = join(root, "skills");
  const errors: string[] = [];
  let actualFiles: string[] = [];
  try {
    actualFiles = (await listFiles(skillsDir)).map((path) => relative(skillsDir, path));
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
  for (const path of actualFiles.filter((path) => !expected.has(path))) errors.push(`unexpected skills/${path}`);

  for (const [path, file] of expected) {
    try {
      const output = join(skillsDir, path);
      if (!(await readFile(output)).equals(file.content) || ((await stat(output)).mode & 0o111) !== (file.mode & 0o111)) {
        errors.push(`stale skills/${path}`);
      }
    } catch (error) {
      if (isMissing(error)) errors.push(`missing skills/${path}`);
      else throw error;
    }
  }
  return errors;
}

export async function generateCommandSkills(root: string = rootFromScript) {
  const skillsDir = join(root, "skills");
  const expected = await expectedFiles(root);
  await rm(skillsDir, { recursive: true, force: true });
  for (const [path, file] of expected) {
    const output = join(skillsDir, path);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, file.content);
    await chmod(output, file.mode);
  }
  return [...expected.keys()].filter((path) => basename(path) === "SKILL.md").map((path) => basename(dirname(path))).sort();
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--check")) {
    const errors = await checkGeneratedSkills();
    if (errors.length) {
      console.error(errors.join("\n"));
      process.exitCode = 1;
    } else {
      console.log("Generated Pi skills and supporting files are up to date.");
    }
  } else {
    const names = await generateCommandSkills();
    console.log(`Generated ${names.length} Pi skills: ${names.join(", ")}`);
  }
}
