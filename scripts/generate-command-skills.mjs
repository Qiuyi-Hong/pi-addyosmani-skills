import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootFromScript = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function splitCommand(source) {
  const normalized = source.replaceAll("\r\n", "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) throw new Error("Command must start with YAML frontmatter");
  return { frontmatter: match[1], body: normalized.slice(match[0].length) };
}

function compatibilityNote(body) {
  const notes = ["Upstream `/command` references map to generated `/skill:command` skills."];
  if (body.includes("agent-skills:")) notes.push("`agent-skills:<name>` refers to the bundled Pi skill `<name>` (`/skill:<name>`).");
  if (body.includes("$ARGUMENTS")) notes.push("`$ARGUMENTS` refers to arguments appended by Pi in the final `User:` line.");
  if (body.includes("Agent tool")) notes.push("Claude's Agent tool means Pi's configured subagent/delegation facility; use the source fallback when none is available.");
  return notes.length ? `\n> **Pi compatibility:** ${notes.join(" ")}\n` : "";
}

export function renderCommandSkill(name, source, sourcePath) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) throw new Error(`Invalid skill name: ${name}`);
  const { frontmatter, body } = splitCommand(source);
  const keptFrontmatter = frontmatter
    .split("\n")
    .filter((line) => !/^name\s*:/.test(line))
    .join("\n");
  const marker = `<!-- Generated from upstream/agent-skills/${sourcePath} by scripts/generate-command-skills.mjs; do not edit. -->\n`;
  return `---\nname: ${name}\n${keptFrontmatter}\n---\n${marker}${compatibilityNote(body)}${body}`;
}

export async function listCommandFiles(root = rootFromScript) {
  const commandDir = join(root, "upstream", "agent-skills", ".claude", "commands");
  return (await readdir(commandDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => join(commandDir, entry.name))
    .sort();
}

async function expectedSkills(root) {
  const expected = new Map();
  for (const sourceFile of await listCommandFiles(root)) {
    const name = basename(sourceFile, ".md");
    const source = await readFile(sourceFile, "utf8");
    expected.set(name, renderCommandSkill(name, source, `.claude/commands/${basename(sourceFile)}`));
  }
  return expected;
}

export async function checkGeneratedSkills(root = rootFromScript) {
  const expected = await expectedSkills(root);
  const skillsDir = join(root, "skills");
  const errors = [];
  let entries = [];
  try {
    entries = await readdir(skillsDir, { withFileTypes: true });
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const actualNames = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  for (const name of actualNames.filter((name) => !expected.has(name))) errors.push(`unexpected skills/${name}/SKILL.md`);

  for (const [name, content] of expected) {
    try {
      if (await readFile(join(skillsDir, name, "SKILL.md"), "utf8") !== content) errors.push(`stale skills/${name}/SKILL.md`);
    } catch (error) {
      if (error?.code === "ENOENT") errors.push(`missing skills/${name}/SKILL.md`);
      else throw error;
    }
  }
  return errors;
}

export async function generateCommandSkills(root = rootFromScript) {
  const skillsDir = join(root, "skills");
  const expected = await expectedSkills(root);
  await rm(skillsDir, { recursive: true, force: true });
  for (const [name, content] of expected) {
    const output = join(skillsDir, name, "SKILL.md");
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, content, "utf8");
  }
  return [...expected.keys()];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--check")) {
    const errors = await checkGeneratedSkills();
    if (errors.length) {
      console.error(errors.join("\n"));
      process.exitCode = 1;
    } else {
      console.log("Generated command skills are up to date.");
    }
  } else {
    const names = await generateCommandSkills();
    console.log(`Generated ${names.length} command skills: ${names.join(", ")}`);
  }
}
