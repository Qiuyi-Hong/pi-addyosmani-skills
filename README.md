# Pi adapter for Addy Osmani's agent-skills

Unofficial, pinned Pi package for [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills). It exposes upstream Agent Skills directly, generates Pi skills from Claude commands, and keeps the runtime adapter limited to aliases plus one hook bridge.

Verified against Pi `0.87.0` and the current official documentation for [extensions](https://pi.dev/docs/latest/extensions), [skills](https://pi.dev/docs/latest/skills), and [packages](https://pi.dev/docs/latest/packages).

## Architecture

```text
upstream/agent-skills/      # exact vendored snapshot; never edit manually
pi-extension/               # aliases + simplify-ignore lifecycle adapter
skills/                     # generated from upstream .claude/commands/*.md
scripts/                    # sync, generation, and compatibility checks
tests/
upstream.lock.json          # upstream version, commit, commands, and hooks
```

`package.json` exposes both `upstream/agent-skills/skills` and generated `skills/` through `pi.skills`. Pi uses progressive skill discovery; this package does not inject skill bodies into the system prompt and does not port the old SessionStart router.

## Install

Pin a release or commit:

```bash
pi install git:github.com/Qiuyi-Hong/pi-addyosmani-skills@<tag-or-commit>
```

For local development:

```bash
npm install
pi install .
```

Packages and extensions execute with user permissions; review the source before installation.

## Use

Upstream skills are available normally:

```text
/skill:code-review-and-quality
/skill:test-driven-development
```

Generated command workflows are also skills:

```text
/skill:review
/skill:plan
/skill:build auto
```

The extension preserves these convenience aliases:

```text
/review → /skill:review
/plan   → /skill:plan
/build  → /skill:build
```

## Hooks

Only `simplify-ignore.sh` has a Pi adapter. The upstream script is executed unchanged with translated payloads for `tool_call`, `tool_result`, `agent_before_settle`, and `session_shutdown`.

See [docs/hook-compatibility.md](docs/hook-compatibility.md) for the complete classification and mapping. The adapter requires Bash, `jq`, and `shasum` or `sha1sum`.

## Test

```bash
npm run lint
npm run typecheck
npm test
npm run generate:check
npm run upstream:check
# or all gates:
npm run check
```

## Update upstream

```bash
npm run upstream:update
# or pin a specific upstream ref:
npm run upstream:update -- --ref <tag-or-commit>
```

The update command fetches the requested ref, replaces the vendored snapshot, records the exact commit and upstream version, reports added/removed commands and hooks, regenerates command skills, and runs compatibility checks. Runtime code never follows upstream `main` dynamically.

Expected maintenance behavior:

- normal upstream skill changes require no adapter change;
- command changes regenerate `skills/<command>/SKILL.md`;
- added/removed commands and hooks are checked against the lock and hook classification;
- `simplify-ignore.sh` updates are reused from the new snapshot;
- Pi API changes stay mostly inside `pi-extension/`.

## Limitations

- `sdd-cache-pre.sh` and `sdd-cache-post.sh` are unsupported because Pi has no canonical `WebFetch` tool or portable cached-success substitution contract.
- Generated command skills preserve upstream workflow text. A generated compatibility note explains Pi skill names, command arguments, and Claude Agent-tool references where present.
- `simplify-ignore` retains upstream's documented crash-recovery and file-rename limitations.

## Licensing

Adapter code is MIT licensed. The vendored upstream keeps Addy Osmani's original MIT license at `upstream/agent-skills/LICENSE`; see [NOTICE](NOTICE).
