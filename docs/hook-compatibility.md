# Claude hook compatibility

The vendored repository ships optional hook scripts; it does not register them automatically. This package does not emulate Claude hooks generically.

| Upstream hook | Classification | Pi behavior |
|---|---|---|
| `session-start.sh` | already handled natively | Not ported. Pi discovers packaged `SKILL.md` files and exposes `/skill:<name>`, so injecting `using-agent-skills` would create a second router. |
| `simplify-ignore.sh` | needs a Pi adapter | Reused unchanged. The extension translates the Pi events below into its existing JSON input. |
| `sdd-cache-pre.sh` | cannot be reproduced | Unsupported. Pi has no canonical `WebFetch` tool and `tool_call` cannot substitute a successful cached result portably. |
| `sdd-cache-post.sh` | cannot be reproduced | Unsupported. Pi has no canonical `WebFetch` response shape across built-in, extension, and MCP fetch tools. |

## `simplify-ignore` mappings

| Claude behavior | Pi event | Upstream payload |
|---|---|---|
| `PreToolUse Read` | `tool_call` for `read` | `{"tool_name":"Read","tool_input":{"file_path":"..."}}` |
| `PostToolUse Edit` | `tool_result` for `edit` | `{"tool_name":"Edit","tool_input":{"file_path":"..."}}` |
| `PostToolUse Write` | `tool_result` for `write` | `{"tool_name":"Write","tool_input":{"file_path":"..."}}` |
| `Stop` | `agent_before_settle` | `{}` |
| cleanup on exit/reload/session replacement | `session_shutdown` | `{}` |

`agent_before_settle` is used instead of `agent_end` because current Pi may retry or compact after `agent_end`; `agent_before_settle` is the final actionable boundary. `session_shutdown` is an idempotent cleanup fallback.

The adapter requires Bash, `jq`, and `shasum` or `sha1sum`, matching upstream. It intentionally preserves upstream cache paths and recovery behavior.
