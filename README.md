# Pi adapter for Addy Osmani's agent-skills

Unofficial, pinned Pi package for [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills). It generates Pi-adapted copies of upstream skills, supporting files, and command workflows. The optional runtime hook bridge is disabled by default, matching upstream.

Verified against Pi `0.87.0` and the current official documentation for [extensions](https://pi.dev/docs/latest/extensions), [skills](https://pi.dev/docs/latest/skills), and [packages](https://pi.dev/docs/latest/packages).

## Architecture

```text
upstream/agent-skills/      # exact vendored snapshot; never edit manually
pi-extension/               # optional simplify-ignore lifecycle adapter
skills/                     # generated command skills
skills/upstream/            # generated Pi-adapted skills, references, and personas
scripts/                    # sync, generation, and compatibility checks
tests/
upstream.lock.json          # upstream version, commit, commands, and hooks
```

`package.json` exposes only generated `skills/` through `pi.skills`. Project configuration paths use `.pi/`; user-level paths use `~/.pi/agent/`. The generated support tree preserves upstream's relative reference layout and script permissions. Provenance comments retain the actual upstream source paths.

Pi uses progressive skill discovery; this package does not inject skill bodies into the system prompt and does not port the old SessionStart router. The vendored snapshot stays unchanged.

## Install

```bash
pi install npm:pi-addyosmani-skills
```

Pin a published version:

```bash
pi install npm:pi-addyosmani-skills@<version>
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

## Hooks

No upstream hook is enabled automatically. Skills, including `code-simplify`, work without hooks.

Only `simplify-ignore.sh` has a Pi adapter. To opt in from this checkout:

```bash
pi -e ./pi-extension/index.ts
```

For the default npm installation:

```bash
pi -e ~/.pi/agent/npm/node_modules/pi-addyosmani-skills/pi-extension/index.ts
```

The adapter translates lifecycle events and changes cache paths in memory to `.pi/.simplify-ignore-cache/`, without editing upstream files. It requires Bash, `jq`, and `shasum` or `sha1sum` only when explicitly loaded.

See [docs/hook-compatibility.md](docs/hook-compatibility.md) for persistent opt-in through `.pi/settings.json`, all hook classifications, and recovery instructions. Finish active hook-enabled sessions before switching; existing cache backups are not migrated or deleted automatically.

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

`.github/workflows/sync-upstream.yml` runs daily at 09:00 Europe/London (including BST), runs `npm run check`, and opens or updates a PR only when the snapshot changes. It can also be run manually. Enable **Settings → Actions → General → Workflow permissions → Allow GitHub Actions to create and approve pull requests** for the PR step to work. The pinned snapshot can lag upstream until the PR is merged (or when a sync fails or a scheduled run is delayed).

Expected maintenance behavior:

- normal upstream skill changes require no adapter change;
- skill, supporting-file, and command changes regenerate the Pi-facing `skills/` tree;
- added/removed commands and hooks are checked against the lock and hook classification;
- `simplify-ignore.sh` updates are read from the new snapshot with Pi paths adapted in memory;
- Pi API changes stay mostly inside `pi-extension/`.

## Limitations

- `sdd-cache-pre.sh` and `sdd-cache-post.sh` are unsupported because Pi has no canonical `WebFetch` tool or portable cached-success substitution contract.
- Generated content translates configuration paths, but does not implement Claude-only settings, plugin persona auto-discovery, or Agent Teams. Compatibility notes distinguish those upstream examples from supported Pi behavior. Use your configured delegation facility or the bundled persona prompts.
- `simplify-ignore` retains upstream's documented crash-recovery and file-rename limitations.

## Licensing

Adapter code is MIT licensed. The vendored upstream keeps Addy Osmani's original MIT license at `upstream/agent-skills/LICENSE`; see [NOTICE](NOTICE).
