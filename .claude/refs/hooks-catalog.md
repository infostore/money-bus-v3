# Hooks & Hookify

## Hook Events (18 total)

| Event | Trigger | Matcher Input | Matcher Examples | Use Case |
| ----- | ------- | ------------- | ---------------- | -------- |
| `PreToolUse` | Before tool execution | Tool name | `Bash`, `Edit\|Write`, `mcp__.*` | Block dangerous commands, validate edits |
| `PostToolUse` | After tool success | Tool name | `Edit\|Write` | Auto-format, auto-lint, notifications |
| `PostToolUseFailure` | After tool failure | Tool name | `Bash` | Error logging, retry logic |
| `PermissionRequest` | Permission prompt shown | Tool name | `Bash`, `Edit` | Auto-approve/deny patterns |
| `Stop` | Agent finishes responding | — (no matcher) | — | Force continuation, anti-rationalization |
| `UserPromptSubmit` | User submits prompt | — (no matcher) | — | Context injection, prompt rewriting |
| `PreCompact` | Before context compaction | Trigger type | `manual`, `auto` | Preserve critical state |
| `SessionStart` | Session begins/resumes | Start type | `startup`, `resume`, `clear`, `compact` | Load session memory, set environment |
| `SessionEnd` | Session ends | End reason | `clear`, `logout`, `prompt_input_exit`, `bypass_permissions_disabled`, `other` | Cleanup, save state |
| `SubagentStart` | Subagent spawned | Agent type | `Explore`, `Plan`, custom names | Subagent-specific setup |
| `SubagentStop` | Subagent finishes | Agent type | `Explore`, `Plan`, custom names | Result processing |
| `Notification` | Notification sent | Notification type | `permission_prompt`, `idle_prompt`, `auth_success`, `elicitation_dialog` | External alerts |
| `TeammateIdle` | Agent team member idle | — (no matcher) | — | Agent Teams: reassign work, notify |
| `TaskCompleted` | Background task completes | — (no matcher) | — | Task result handling |
| `InstructionsLoaded` | CLAUDE.md/rules loaded | — (no matcher) | — | Debug rule loading, log which files load |
| `ConfigChange` | Settings modified | Config source | `user_settings`, `project_settings`, `local_settings`, `policy_settings`, `skills` | Config validation, audit |
| `WorktreeCreate` | Git worktree created | — (no matcher) | — | Worktree-specific setup |
| `WorktreeRemove` | Git worktree removed | — (no matcher) | — | Worktree cleanup |

## Hook Types

| Type | Description | Use Case |
| ---- | ----------- | -------- |
| `command` | Shell script execution | File validation, git checks, formatting |
| `prompt` | Single-turn LLM evaluation (e.g., Haiku) | Response quality check, anti-rationalization |
| `agent` | Multi-turn LLM with tool access | Complex validation, code analysis |
| `http` | POST to external endpoint | External integrations, webhooks |

## Hook Handler Common Fields

| Field | Required | Description |
| ----- | -------- | ----------- |
| `type` | O | `"command"`, `"http"`, `"prompt"`, `"agent"` |
| `timeout` | X | Seconds. Default: command=600, prompt=30, agent=60 |
| `statusMessage` | X | Custom spinner text while hook runs |
| `once` | X | `true` = run once per session then remove (skills only) |

**Command-only**: `async` (true = background, non-blocking)
**HTTP-only**: `url`, `headers` (env var interpolation: `$VAR`), `allowedEnvVars`
**Prompt/Agent-only**: `prompt` (`$ARGUMENTS` = hook input JSON), `model`

## Exit Codes (command type)

| Code | Meaning |
| ---- | ------- |
| `0` | Success — stdout parsed for JSON control |
| `1` | Non-blocking error — stderr shown in verbose mode |
| `2` | Blocking error — stderr fed to Claude (see per-event table below) |

### Exit Code 2 Per-Event Behavior

| Event | Blockable? | Exit 2 Effect |
| ----- | ---------- | ------------- |
| `PreToolUse` | Yes | Blocks tool call |
| `PermissionRequest` | Yes | Denies permission |
| `UserPromptSubmit` | Yes | Blocks + erases prompt |
| `Stop` | Yes | Prevents stop, continues conversation |
| `SubagentStop` | Yes | Prevents subagent from stopping |
| `TeammateIdle` | Yes | Prevents idle transition |
| `TaskCompleted` | Yes | Prevents task completion marking |
| `ConfigChange` | Yes | Blocks config change (except policy_settings) |
| `WorktreeCreate` | Yes | Fails worktree creation (any non-zero) |
| `PostToolUse` | No | stderr shown to Claude |
| `PostToolUseFailure` | No | stderr shown to Claude |
| `Notification` | No | stderr shown to user only |
| `SubagentStart` | No | stderr shown to user only |
| `SessionStart` | No | stderr shown to user only |
| `SessionEnd` | No | stderr shown to user only |
| `PreCompact` | No | stderr shown to user only |
| `WorktreeRemove` | No | Debug mode logging only |
| `InstructionsLoaded` | No | Exit code ignored |

## Stop Hook Infinite Loop Prevention

When a Stop hook forces continuation via exit 2, Claude responds again and triggers another Stop event.
To prevent this loop, check the `stop_hook_active` field in the input JSON:

```bash
INPUT=$(cat)
if [ "$(echo "$INPUT" | jq -r '.stop_hook_active')" = "true" ]; then
  exit 0  # Already re-triggered by Stop hook — allow exit
fi
# ... normal logic
```

| Field | Type | Event | Description |
| ---- | ---- | ------ | ---- |
| `stop_hook_active` | boolean | Stop | `true` when this turn was forced by a previous Stop hook. Required for loop prevention |
| `agent_id` | string | All (in subagent) | Current subagent ID. Only present during subagent execution |
| `agent_type` | string | All (in subagent) | Subagent type name (e.g., `Explore`, `code-reviewer`). For type-based branching |
| `worktree` | string | status line hook | Current worktree path when running in an isolated worktree |

## JSON Response Fields

### Legacy format (still supported)

```json
{
  "block": true,
  "message": "Reason",
  "feedback": "Info",
  "suppressOutput": true,
  "continue": false,
  "updatedInput": {}
}
```

### hookSpecificOutput format (recommended)

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Destructive command blocked by hook"
  }
}
```

`permissionDecision`: `"allow"` | `"deny"` | `"ask"` (PreToolUse/PermissionRequest)

## Project Hooks (`.claude/hooks/` + `settings.json`)

| Hook                      | Event            | Type    | Purpose                                      |
| ------------------------- | ---------------- | ------- | -------------------------------------------- |
| `on-session-start`        | SessionStart     | command | Load session memory + project state snapshot |
| `prd-gate`                | PreToolUse       | command | Block Write/Edit without PRD + PDCA + branch |
| `block-main-push`         | PreToolUse       | command | Block `git push` on main branch              |
| `block-dangerous-commands` | PreToolUse      | command | Block `rm -rf`, `git reset --hard`, `DROP TABLE/DATABASE` (jq + fallback) |
| `auto-eslint-fix` (inline) | PostToolUse     | command | Auto `eslint --fix` for TS/JS files (10s timeout) |
| `compact-guidance`        | PreCompact       | command | Preserve modified files, PRD-ID, test results |
| `verification-gate`       | Stop             | prompt  | Block stop if code modified but tests/tsc not run |
| Stop (ralph)              | Stop             | command | ralph-loop continuation via stop-hook.sh     |
| `macos-notify` (inline)   | Stop             | command | macOS display notification on task completion |

## Hookify (`.claude/hookify.*.local.md`)

Soft rules interpreted by Claude at runtime (warn or block). Defined as YAML frontmatter + markdown body:

```yaml
# .claude/hookify.{name}.local.md
---
name: rule-name
enabled: true
event: file|bash|prompt|stop
action: warn|block
conditions:
  - field: file_path|new_text|command|prompt
    operator: regex_match
    pattern: ^src/.*\.ts$
---

Markdown body shown to Claude when conditions match.
```

Hookify rules are project-specific (`.local.md` = gitignored). Create them with the `/hookify` command.
