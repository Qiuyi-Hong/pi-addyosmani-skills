# Upstream hook compatibility in Pi

The vendored upstream repository supplies optional scripts but does not register any hooks by default. This package follows that default: `pi.extensions` is empty, and ordinary skill use executes no hook scripts. Pi does not support copying Claude's `hooks` settings directly into its settings file.

| Upstream hook | Classification | Default Pi behavior |
|---|---|---|
| `session-start.sh` | already handled natively | No hook registered. Pi discovers packaged `SKILL.md` files and exposes `/skill:<name>`; injecting `using-agent-skills` would create a second router. |
| `simplify-ignore.sh` | needs a Pi adapter | Disabled. Explicitly load `pi-extension/index.ts` to enable block hiding and restoration. |
| `sdd-cache-pre.sh` | cannot be reproduced | Unsupported and disabled. Pi has no canonical `WebFetch` tool and `tool_call` cannot substitute a successful cached result portably. |
| `sdd-cache-post.sh` | cannot be reproduced | Unsupported and disabled. Pi has no canonical `WebFetch` response shape across built-in, extension, and MCP fetch tools. |

## Explicit opt-in

From this checkout, enable the supported hook for one invocation:

```bash
pi -e ./pi-extension/index.ts
```

For the default npm installation:

```bash
pi -e ~/.pi/agent/npm/node_modules/pi-addyosmani-skills/pi-extension/index.ts
```

For persistent project opt-in, merge an extension path into `.pi/settings.json`:

```json
{
  "extensions": [
    "~/.pi/agent/npm/node_modules/pi-addyosmani-skills/pi-extension/index.ts"
  ]
}
```

Adjust the path for local/git installations or a custom agent directory. Project-relative extension paths resolve from the `.pi/` directory, not the project root. Project settings load only after project trust is granted. Personal opt-in uses the same `extensions` setting in `~/.pi/agent/settings.json`.

The extension is retained in the package but is not a declared package resource, so package resource filters and `pi config` cannot enable it; load its file explicitly. Removing the explicit path disables it without affecting any skills. Run `/reload` after changing settings.

## `simplify-ignore` mappings

| Claude behavior | Pi event | Upstream payload |
|---|---|---|
| `PreToolUse Read` | `tool_call` for `read` | `{"tool_name":"Read","tool_input":{"file_path":"..."}}` |
| `PostToolUse Edit` | `tool_result` for `edit` | `{"tool_name":"Edit","tool_input":{"file_path":"..."}}` |
| `PostToolUse Write` | `tool_result` for `write` | `{"tool_name":"Write","tool_input":{"file_path":"..."}}` |
| `Stop` | `agent_before_settle` | `{}` |
| cleanup on exit/reload/session replacement | `session_shutdown` | `{}` |

`agent_before_settle` is used instead of `agent_end` because current Pi may retry or compact after `agent_end`; `agent_before_settle` is the final actionable boundary. `session_shutdown` is an idempotent cleanup fallback.

The adapter reads the pinned upstream script and translates its paths in memory before executing it. Backups live in the consuming project's `.pi/.simplify-ignore-cache/`; no `.claude/` directory is created by the Pi adapter. `CLAUDE_PROJECT_DIR` and the JSON field names remain internal upstream protocol details, not Pi configuration settings.

Bash, `jq`, and `shasum` or `sha1sum` are required only when the adapter is loaded. The upstream crash-recovery, wholesale-rewrite, and file-rename limitations still apply. Add `.pi/.simplify-ignore-cache/` to the consuming project's `.gitignore`.

## Recovery and migration

Finish active hook-enabled sessions before disabling or upgrading the adapter so cleanup restores protected blocks. Do not delete a non-empty cache: it can contain the only original copy of hidden code, or `.recovered` edits needing a manual merge.

Existing `.claude/.simplify-ignore-cache/` data is not automatically moved or deleted. To restore a legacy cache from this checkout, run the unmodified upstream script against the affected project:

```bash
printf '{}' | CLAUDE_PROJECT_DIR="/absolute/path/to/affected-project" bash upstream/agent-skills/hooks/simplify-ignore.sh
```

For an installed package, use that package's upstream script path. Keep the legacy cache ignored until recovery is complete.

To restore a `.pi/.simplify-ignore-cache/` left by a crash, start Pi in the affected project with the adapter explicitly loaded, then exit with `/quit`; `session_shutdown` runs restoration without requiring a model request. Inspect any remaining `.recovered` files before deleting the cache.
