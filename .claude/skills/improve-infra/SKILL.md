---
name: improve-infra
description: Analyze and improve .claude/ infrastructure using latest Claude Code best practices. Optionally research official docs, GitHub, and web sources.
argument-hint: "--count {number} [--research] [--dry-run]"
disable-model-invocation: true
---

# Improve Config

Autonomously analyze `.claude/` infrastructure to discover improvement opportunities, optionally research latest Claude Code best practices, then implement each improvement.

## Scope

**ONLY** these directories are in scope:

| Directory | Contents |
|-----------|----------|
| `.claude/rules/` | Context rules (auto-injected by path globs) |
| `.claude/agents/` | Subagent system prompts |
| `.claude/skills/` | Slash-command skill definitions |
| `.claude/hooks/` | Shell hook scripts |
| `.claude/refs/` | Reference documents (patterns, catalogs, tokens) |
| `.claude/hookify.*.local.md` | Hookify rule definitions |
| `CLAUDE.md` | Project instructions |
| `AGENTS.md` | Project knowledge base |

**OUT OF SCOPE**: `src/`, `tests/`, `docs/prds/`, `docs/pdca/`, any code files.

## Usage

```
/improve-infra --count 5
/improve-infra --count 3 --research
/improve-infra --count 3 --dry-run
```

## Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `--count` | 3 | Number of improvements to implement |
| `--research` | false | Search official docs, GitHub, and web for latest Claude Code patterns |
| `--dry-run` | false | Analyze and propose only, do not modify files |

## Flow

### Resume Check

1. Read `.claude/improve-infra-queue.local.md` → if exists with unchecked items, skip to Implementation Phase
2. If not found → start from Research Phase (if `--research`) or Analysis Phase

### Research Phase (optional, when `--research` flag is set)

**Goal**: Discover latest Claude Code patterns and best practices.

#### Source 1: Official Docs (Highest Priority)

Use `WebFetch` to read official Claude Code documentation:
- `https://docs.anthropic.com/en/docs/claude-code` → features overview
- Agent, skill, hook frontmatter fields and new features

#### Source 2: GitHub (Community Patterns)

Use `WebSearch` with `allowed_domains: ["github.com"]`:
- `"Claude Code" CLAUDE.md hooks skills best practices`
- `"claude-code" plugin .claude configuration`

#### Source 3: Web Articles

Use `WebSearch`:
- `"Claude Code" configuration best practices {current_year}`

#### Compile Findings

Save to `.claude/improve-infra-research.local.md`:
- Key insights organized by topic
- Source attribution for each finding
- "Applicable Candidates" checklist (not yet implemented)

### Analysis Phase

1. **Scan configuration**: Read all files in scope:
   - `.claude/rules/*.md` → check for missing `paths:` globs, staleness
   - `.claude/agents/*.md` → check for missing `tools:` or `description`
   - `.claude/skills/*/SKILL.md` → check for missing frontmatter fields
   - `.claude/hooks/*.sh` → check for missing error handling
   - `.claude/refs/*.md` → check freshness against source of truth
   - `CLAUDE.md` / `AGENTS.md` → check accuracy against actual files

2. **Apply analysis rules**:

   **Quality candidates** (fix existing):
   - Rules without `paths:` glob → scope too broad
   - Agents with missing or vague `description`
   - Skills missing frontmatter (`name`, `description`, `argument-hint`)
   - Hooks without error handling
   - Refs that are stale

   **Enhancement candidates** (improve existing):
   - Rules that could benefit from examples
   - Agents that should reference new skills
   - Missing hookify rules for recurring mistakes

   **New candidates** (add missing):
   - Domains without dedicated rules
   - Common tasks without skills
   - Research-discovered patterns not yet adopted

3. **Score candidates**:
   - Score = Impact / Effort
   - Bonus 2x: Research-backed improvement
   - Bonus 1.5x: Fixes a recurring mistake pattern

4. **Select top --count candidates**

5. **Write queue**: Save to `.claude/improve-infra-queue.local.md`

   ```markdown
   ---
   count: 3
   completed: 0
   created: YYYY-MM-DD
   research: true|false
   ---

   ## Queue

   - [ ] **{type}: {title}**
     - target: {file path(s) to create/modify}
     - description: {what to change, 2-3 sentences}
     - rationale: {why this improvement matters}
     - source: {analysis|research|conversation-pattern}
   ```

6. **Present queue**: In `--dry-run` mode, STOP here.

### Implementation Phase

For each unchecked queue item:

1. **Read queue**: Find first unchecked `- [ ]` item
2. **Read target file(s)**: Understand current content
3. **Implement change**: Edit or create target file(s)
4. **Verify**: Valid markdown/YAML frontmatter
5. **Mark complete**: `- [x]` in queue, increment `completed`
6. **Check completion**: If `completed >= count` → done

## Candidate Types

| Type | Target | Example |
|------|--------|---------|
| **rule-fix** | `.claude/rules/` | Add missing `paths:` glob |
| **rule-new** | `.claude/rules/` | Create rule for uncovered domain |
| **agent-fix** | `.claude/agents/` | Fix agent description or tool list |
| **skill-fix** | `.claude/skills/` | Fix skill frontmatter or flow |
| **skill-new** | `.claude/skills/` | Create skill for common task |
| **hook-fix** | `.claude/hooks/` | Add error handling to hook script |
| **hookify-new** | `.claude/` | Add hookify rule for recurring mistake |
| **ref-update** | `.claude/refs/` | Sync ref with source of truth |
| **claude-md** | `CLAUDE.md` | Fix outdated instructions |
| **agents-md** | `AGENTS.md` | Sync with actual agents/skills |

## Safety

- NEVER modify files outside `.claude/`, `CLAUDE.md`, `AGENTS.md`
- NEVER delete existing files — only create new or edit existing
- NEVER modify `.claude/settings.json` (user-managed)
- NEVER auto-commit — present changes for user review
- Research phase is read-only (web search, web fetch)
