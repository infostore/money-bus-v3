---
name: save-session
description: Save the current session state to `.claude/session-memory.md` for the next session.
argument-hint: "[optional notes]"
disable-model-invocation: true
---

# Save Session

Save the current session's context so the next session can pick up where you left off.

## When to Use

- At the end of any productive work session before closing Claude Code
- Before starting a new session that should continue current work
- After completing a significant feature or fix (even if work isn't done)
- Triggered by the `save-session-reminder` hookify rule at session end

## Usage

```
/save-session
```

## Current Git State

- Branch: !`git branch --show-current`
- Recent commits: !`git log --oneline -5`
- Modified files: !`git diff --name-only`

## Process

1. Use the git state above (already injected) to capture current context
2. Summarize the conversation into the sections below
3. Write the file to `.claude/session-memory.md`
4. Keep it concise — under 50 lines. Focus on actionable context, not conversation history.
5. Confirm to the user that session memory has been saved

## Template

Write the following sections to `.claude/session-memory.md`:

```markdown
# Session Memory
**Updated:** [current date and time]
**Branch:** [current git branch]

## What Was Done
- [Bullet list of completed work in this session]

## Current State
- [What is working, what is not]
- [Any in-progress tasks]

## Key Decisions
- [Important decisions made during this session]

## Next Steps
- [What should be done next, in priority order]

## Open Issues
- [Any unresolved problems or blockers]
```

## Guidelines

- **Include**: Branch name, completed tasks, pending work, blockers, decisions that affect future work
- **Exclude**: Conversation history, redundant details, information already in CLAUDE.md or session-memory.md
- **Tone**: Actionable and specific — "feat/user-auth branch, 3 tests passing, API route incomplete" not "worked on stuff"
