---
name: ralph-loop
description: Autonomous iterative development loop (based on ralph-claude-code v0.11.5)
argument-hint: "[prompt-file] [--max-iterations N] [--circuit-breaker N] [--rate-limit N] [--completion-promise] [--progress]"
disable-model-invocation: true
---

# /ralph-loop — Autonomous Iterative Loop

Runs Claude in an autonomous loop, feeding prompts back on each iteration until exit conditions are met. Adapted from [frankbria/ralph-claude-code](https://github.com/frankbria/ralph-claude-code) v0.11.5.

## When to Use

- When a task requires 10+ autonomous iterations to complete (systematic auditing, test coverage improvement, batch documentation)
- When you have a prompt file with clear exit criteria and RALPH_STATUS tracking
- For tasks that benefit from circuit-breaker safety (stopping after N no-progress iterations)
- In `build` Phase 4 Step 15 for coverage improvement loops
- Called with any prompt file (e.g., `.claude/skills/coverage-improvement/SKILL.md`) — use `--completion-promise` for reliable dual-condition exit

## Usage

```bash
/ralph-loop <prompt-file>                          # Run with prompt file
/ralph-loop <prompt-file> --max-iterations 20      # Cap at 20 iterations
/ralph-loop <prompt-file> --circuit-breaker 3      # Halt after 3 no-progress loops
/ralph-loop <prompt-file> --rate-limit 50          # Max 50 calls per hour
/ralph-loop <prompt-file> --completion-promise      # Require EXIT_SIGNAL for exit
/ralph-loop <prompt-file> --progress               # Track progress in ralph-progress.local.md
```

### Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `prompt-file` | (required) | Path to the prompt file (relative to project root) |
| `--max-iterations` | `50` | Maximum number of loop iterations |
| `--circuit-breaker` | `3` | Consecutive no-progress loops before halting |
| `--rate-limit` | `100` | Maximum API calls per hour |
| `--completion-promise` | `false` | Require dual-condition exit (indicators + EXIT_SIGNAL) |
| `--progress` | `false` | Write progress to `ralph-progress.local.md` |
| `--session-ttl` | `24` | Session TTL in hours |

## How It Works

```
1. SKILL.md creates state file (.claude/ralph-loop.local.md)
2. Claude reads prompt, works autonomously
3. Claude includes RALPH_STATUS block in every response
4. Claude's session ends (Stop event fires)
5. stop-hook.sh intercepts the Stop event
6. Hook reads state from ralph-loop.local.md
7. Hook checks exit conditions (completion → session → rate → circuit → max)
8. If no exit: increments iteration, blocks stop (feeds prompt back)
9. If exit: deactivates loop, approves stop
```

## RALPH_STATUS Block

Claude MUST include this block at the end of **every** response during a ralph loop:

```
---RALPH_STATUS---
STATUS: IN_PROGRESS | COMPLETE | BLOCKED
TASKS_COMPLETED_THIS_LOOP: <number>
FILES_MODIFIED: <number>
TESTS_STATUS: PASSING | FAILING | NOT_RUN
WORK_TYPE: IMPLEMENTATION | TESTING | DOCUMENTATION | REFACTORING
EXIT_SIGNAL: false | true
RECOMMENDATION: <one line summary of what to do next>
---END_RALPH_STATUS---
```

### Field Definitions

| Field | Values | Purpose |
|-------|--------|---------|
| `STATUS` | `IN_PROGRESS`, `COMPLETE`, `BLOCKED` | Current work status |
| `TASKS_COMPLETED_THIS_LOOP` | integer | Tasks finished this iteration |
| `FILES_MODIFIED` | integer | Files changed this iteration |
| `TESTS_STATUS` | `PASSING`, `FAILING`, `NOT_RUN` | Test suite state |
| `WORK_TYPE` | `IMPLEMENTATION`, `TESTING`, `DOCUMENTATION`, `REFACTORING` | Category of work done |
| `EXIT_SIGNAL` | `true`, `false` | Claude's explicit "I'm done" signal |
| `RECOMMENDATION` | string | What to do next iteration |

### Dual-Condition Exit Gate

Exit requires **BOTH**:
1. `completion_indicators >= 2` (heuristic: STATUS=COMPLETE, all tasks done, etc.)
2. `EXIT_SIGNAL: true` (Claude's explicit confirmation)

This prevents premature exits where patterns match mid-iteration but Claude hasn't actually finished.

## Prompt Writing Guide

Your prompt file should include:

1. **Goal**: Clear statement of what to accomplish
2. **Constraints**: Boundaries and rules
3. **RALPH_STATUS instruction**: Tell Claude to include the status block
4. **Exit criteria**: When Claude should set EXIT_SIGNAL: true

### Example Prompt

```markdown
# Task: Implement User Authentication

## Goal
Implement JWT-based authentication with login, logout, and token refresh.

## Constraints
- Use existing project structure
- Follow TDD: write tests first, then implement
- Target 80%+ test coverage
- Do not modify unrelated files

## Progress Tracking
At the end of EVERY response, include a RALPH_STATUS block:

\`\`\`
---RALPH_STATUS---
STATUS: IN_PROGRESS | COMPLETE | BLOCKED
TASKS_COMPLETED_THIS_LOOP: <N>
FILES_MODIFIED: <N>
TESTS_STATUS: PASSING | FAILING | NOT_RUN
WORK_TYPE: IMPLEMENTATION | TESTING | DOCUMENTATION | REFACTORING
EXIT_SIGNAL: false | true
RECOMMENDATION: <what to do next>
---END_RALPH_STATUS---
\`\`\`

## Exit Criteria
Set EXIT_SIGNAL: true when:
- All auth endpoints implemented and tested
- Test coverage >= 80%
- No failing tests
- Documentation updated
```

See `.claude/skills/ralph-loop/prompts.md` for more templates.

## State Files

| File | Purpose | Lifecycle |
|------|---------|-----------|
| `.claude/ralph-loop.local.md` | Loop state (YAML frontmatter) + prompt body | Created on start, deactivated on exit |
| `.claude/ralph-session.local.json` | Call timestamps for rate limiting | Created on start, persists until expiry |
| `.claude/ralph-progress.local.md` | Progress log (append-only, optional) | Created if `--progress`, persists |

All files are `.local` (gitignored).

### State File Format (ralph-loop.local.md)

```yaml
---
active: true
prompt-file: path/to/prompt.md
iteration: 0
max-iterations: 50
circuit-breaker: 3
no-change-count: 0
rate-limit: 100
completion-promise: false
completion-indicators: 0
session-ttl: 24
progress: false
started-at: "2026-02-27T00:00:00Z"
last-iteration-at: ""
git-fingerprint: ""
---

<prompt body goes here>
```

## Execution Steps

### 1. Validate

- Confirm `prompt-file` exists and is readable
- Confirm no active loop (`.claude/ralph-loop.local.md` must not exist with `active: true`)
- Parse CLI options with defaults

### 2. Create State

Write `.claude/ralph-loop.local.md` with YAML frontmatter from parsed options.

**IMPORTANT**: Use the Write tool. The YAML frontmatter MUST have exactly these fields:

```markdown
---
active: true
prompt-file: <path>
iteration: 0
max-iterations: <parsed or 50>
circuit-breaker: <parsed or 3>
no-change-count: 0
rate-limit: <parsed or 100>
completion-promise: <true or false>
completion-indicators: 0
session-ttl: <parsed or 24>
progress: <true or false>
started-at: "<current ISO 8601 UTC timestamp>"
last-iteration-at: ""
git-fingerprint: ""
---

<contents of the prompt file>
```

Write `.claude/ralph-session.local.json`:
```json
{"calls":[],"total_iterations":0}
```

### 3. Create Progress File (if --progress)

Write `.claude/ralph-progress.local.md`:

```markdown
# Ralph Loop Progress
Started: <timestamp>
Task: <brief summary>

## Milestones
- [ ] <infer milestones from the prompt>
```

### 4. Acknowledge and Start Working

Tell the user the loop is active, then **immediately start working on the prompt**. Do NOT wait for another message.

Example acknowledgment:
```
Ralph Loop activated.
- Prompt: path/to/prompt.md
- Max iterations: 50
- Circuit breaker: 3 (no-change threshold)
- Completion promise: enabled

Starting iteration 1...
```

### 5. Loop (via stop-hook.sh)

The stop hook (`.claude/skills/ralph-loop/stop-hook.sh`) handles all subsequent iterations. It:
1. Checks exit conditions in priority order
2. If all pass: increments iteration, blocks stop, re-injects prompt
3. If any triggered: deactivates loop, allows stop

## Cancellation

When the user says "cancel ralph", "stop the loop", or `/cancel-ralph`:

1. Delete `.claude/ralph-loop.local.md`
2. Delete `.claude/ralph-session.local.json`
3. Delete `.claude/ralph-progress.local.md` (if exists)
4. Confirm: "Ralph Loop cancelled. Completed N iterations."

## Exit Conditions

| Condition | Trigger | What Happens |
|-----------|---------|--------------|
| Completion | `completed: true` OR dual-condition met | Clean stop, task done |
| Session TTL | Elapsed >= session_ttl hours | Stop, start new loop to resume |
| Rate limit | Hourly calls >= rate_limit | Stop, wait for next hour |
| Circuit breaker | No file changes for N iterations | Stop, review approach |
| Max iterations | iteration >= max_iterations | Stop, increase limit or refine prompt |

## Troubleshooting

### Circuit Breaker Tripped

**Symptom**: Loop stops with "Circuit breaker: N consecutive no-progress loops"

**Fix**:
1. Check what Claude was stuck on in the last response
2. Update prompt to provide clearer guidance
3. Delete `.claude/ralph-loop.local.md` to reset
4. Re-run with adjusted prompt

### Rate Limit Hit

**Symptom**: Loop pauses with "Rate limit reached"

**Action**: Wait until the rate window resets, or abort by deleting state file.

### Session Expired

**Symptom**: Loop stops with "Session expired"

**Fix**: Delete state files and restart:
```bash
rm .claude/ralph-loop.local.md .claude/ralph-session.local.json
/ralph-loop <prompt-file>
```

### Manual Abort

Delete the state file:
```bash
rm .claude/ralph-loop.local.md
```

## Safety Checks

- Never start a loop if one is already active
- State file uses `.local.md` suffix (gitignored by convention)
- Circuit breaker prevents infinite no-progress loops
- Rate limiting prevents API quota exhaustion
- Session expiry prevents stale loops
- Dual-condition exit prevents premature termination

## See Also

- `prompts.md` in this skill directory — Ready-to-use prompt templates
- `stop-hook.sh` in this skill directory — Stop hook implementation
