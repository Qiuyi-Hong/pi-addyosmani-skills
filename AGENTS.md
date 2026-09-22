# Agent guidance

This repository is a Pi adapter around a pinned, vendored snapshot of Addy Osmani's `agent-skills` project. Keep adapter work separate from upstream content.

## Read-only boundaries

- Treat `upstream/agent-skills/` as read-only. **Never edit, add, delete, format, or generate files directly in this directory.** Update the snapshot only through `npm run upstream:update` (optionally with `-- --ref <tag-or-commit>`).
- Treat `skills/` as generated output. Change `scripts/generate-command-skills.mjs` or update the upstream snapshot, then run `npm run generate`; do not hand-edit generated skill files.

## Where changes belong

- Put Pi runtime adapter changes in `pi-extension/`.
- Put synchronization, generation, and compatibility logic in `scripts/`.
- Put adapter tests in `tests/` and compatibility notes in `docs/`.
- Keep changes minimal and preserve unrelated work already present in the working tree.

## Completion

Run `npm run check`. Work is complete when linting, type checking, tests, generated-output checks, and upstream-integrity checks all pass.

## Agent skills

### Issue tracker

Issues live in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five default triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

Use a single-context layout. See `docs/agents/domain.md`.
