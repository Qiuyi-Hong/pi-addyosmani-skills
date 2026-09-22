import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

import { toSimplifyIgnorePayload, type SimplifyIgnorePayload } from "./compatibility.ts";

const simplifyIgnoreScript = fileURLToPath(new URL("../upstream/agent-skills/hooks/simplify-ignore.sh", import.meta.url));

function runSimplifyIgnore(payload: SimplifyIgnorePayload, cwd: string): void {
  const result = spawnSync("bash", [simplifyIgnoreScript], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
    input: JSON.stringify(payload),
    maxBuffer: 1024 * 1024,
    timeout: 10_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`simplify-ignore failed (${result.status}): ${result.stderr.trim() || "unknown error"}`);
  }
  if (result.stderr.trim()) console.warn(`[simplify-ignore] ${result.stderr.trim()}`);
}

function adaptSimplifyIgnore(event: Parameters<typeof toSimplifyIgnorePayload>[0], ctx: ExtensionContext): void {
  const payload = toSimplifyIgnorePayload(event);
  if (payload) runSimplifyIgnore(payload, ctx.cwd);
}

export default function addyOsmaniSkillsExtension(pi: ExtensionAPI): void {
  pi.on("tool_call", (event, ctx) => adaptSimplifyIgnore(event, ctx));
  pi.on("tool_result", (event, ctx) => adaptSimplifyIgnore(event, ctx));
  pi.on("agent_before_settle", (event, ctx) => adaptSimplifyIgnore(event, ctx));
  pi.on("session_shutdown", (event, ctx) => adaptSimplifyIgnore(event, ctx));
}
