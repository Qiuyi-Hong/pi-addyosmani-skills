export const COMMAND_ALIASES = {
  review: "review",
  plan: "plan",
  build: "build",
} as const;

export type HookClassification =
  | "unnecessary in Pi"
  | "already handled natively"
  | "needs a Pi adapter"
  | "cannot be reproduced";

export const HOOK_CLASSIFICATIONS = {
  "session-start.sh": {
    classification: "already handled natively",
    reason: "Pi discovers SKILL.md files and exposes /skill:<name> without a SessionStart router.",
  },
  "simplify-ignore.sh": {
    classification: "needs a Pi adapter",
    reason: "The upstream script is reused through Pi tool and session lifecycle events.",
  },
  "sdd-cache-pre.sh": {
    classification: "cannot be reproduced",
    reason: "Pi has no canonical WebFetch tool or pre-tool success-result substitution contract.",
  },
  "sdd-cache-post.sh": {
    classification: "cannot be reproduced",
    reason: "Pi has no canonical WebFetch response shape to cache portably.",
  },
} as const satisfies Record<string, { classification: HookClassification; reason: string }>;

type PiCompatibilityEvent = {
  type: string;
  toolName?: string;
  input?: Record<string, unknown>;
};

export type SimplifyIgnorePayload =
  | Record<string, never>
  | { tool_name: "Read" | "Edit" | "Write"; tool_input: { file_path: string } };

export function toSimplifyIgnorePayload(event: PiCompatibilityEvent): SimplifyIgnorePayload | null {
  if (event.type === "agent_before_settle" || event.type === "session_shutdown") return {};

  const path = event.input?.path;
  if (typeof path !== "string") return null;
  if (event.type === "tool_call" && event.toolName === "read") {
    return { tool_name: "Read", tool_input: { file_path: path } };
  }
  if (event.type === "tool_result" && event.toolName === "edit") {
    return { tool_name: "Edit", tool_input: { file_path: path } };
  }
  if (event.type === "tool_result" && event.toolName === "write") {
    return { tool_name: "Write", tool_input: { file_path: path } };
  }
  return null;
}
