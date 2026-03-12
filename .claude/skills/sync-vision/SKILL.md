---
name: sync-vision
description: Analyze PRD trends and update project vision document to reflect evolving direction. Auto-called by create-prd after PRD creation.
argument-hint: "[--dry-run]"
---

# Sync Vision

Analyze all PRDs to detect project direction drift and update vision/strategy documentation accordingly.

## Usage

```
/sync-vision            # Analyze and update
/sync-vision --dry-run  # Analyze only, show proposed changes
```

## When Called

- **Manually**: `/sync-vision` at any time
- **Auto**: Called by `/create-prd` after PRD creation
- **Auto**: Called by `/improve-architecture` after Analysis Phase

## Prerequisites

A project vision document must exist at `docs/vision.md`. If it doesn't exist, this skill will create a starter template.

## Vision Document Structure

```markdown
# Project Vision

## Purpose
{Why this project exists — one paragraph}

## Target User
{Who uses this — persona description}

## Core Values
{3-5 principles that guide decisions}

## Strategic Priorities
{Ordered list of current focus areas}

## Anti-Patterns
{Things this project intentionally avoids}

## Change Log
| Date | Change | Trigger |
|------|--------|---------|
```

## Process

### 1. Read Current State

Read `docs/vision.md` to capture current vision as baseline.

### 2. Scan All PRDs

Read frontmatter + Overview from every file in `docs/prds/features/` (skip `000-template.md`).

Collect:
- **Domain distribution**: Count PRDs per domain/category tag
- **Status distribution**: Completed vs planned
- **Recent additions**: PRDs created in last 30 days
- **Recurring themes**: Extract patterns from PRD titles and overviews

### 3. Detect Drift

Compare PRD trends against current vision:

| Check | Signal |
|-------|--------|
| **Domain shift** | A domain's PRD share grew/shrank >20% since last sync |
| **New domain emergence** | 3+ PRDs in a domain not reflected in vision |
| **Priority misalignment** | Strategic Priorities list domains with few recent PRDs |
| **Value drift** | Recent PRDs contradict a Core Value or Anti-Pattern |

### 4. Propose Updates

For each detected drift, propose a specific update:

```
## Detected Changes

### 1. [Section: Strategic Priorities]
- Current: "{current priority}"
- Signal: {what changed in PRD trends}
- Proposed: {specific text change}
```

### 5. Apply or Report

- **Normal mode**: Present proposed changes, apply to `docs/vision.md`
- **`--dry-run` mode**: Present proposed changes only
- **No drift detected**: "Vision is aligned with current PRD trends. No changes needed."

## Update Rules

| Section | Update Policy |
|---------|---------------|
| **Purpose** | Only update if fundamental project purpose shifted (rare) |
| **Target User** | Update if user persona expanded |
| **Core Values** | Add if 3+ PRDs support new value. Never delete without replacement. |
| **Strategic Priorities** | Reorder based on recent PRD activity. Add emerging priorities. |
| **Anti-Patterns** | Add if a rejected pattern keeps appearing. |

## Output Format

```markdown
## Vision Sync Report

**PRDs analyzed**: {count}
**Last sync**: {date}
**Drift detected**: {count} changes

### Changes Applied
1. {section}: {description}

### No Change
- {section}: Aligned

### Change Log Entry
| {date} | {change summary} | PRD trend analysis |
```

## Safety

- NEVER delete existing content without replacement
- NEVER change Purpose to contradict project's original intent
- All changes are additive or reordering
- Keep Change Log at bottom of vision document
