---
type: pdca-plan
plan-name: Initial Data Bidirectional Sync
related-prd: PRD-FEAT-006
phase: do
status: in-progress
created: 2026-03-13
updated: 2026-03-13
tags: [pdca]
---

# PDCA Plan: Initial Data Bidirectional Sync

## Plan

- **Goal**: Replace hardcoded seed data with bidirectional SQLite ↔ PostgreSQL sync on startup

- **Scope**:
  - Create `data/initial.db` with reference data from v1 + current PG
  - Implement sync module (`initial-data-loader.ts`)
  - Remove seed methods and hardcoded data arrays
  - Update server startup and Docker config

- **Success Metrics**:
  - [ ] Bidirectional sync works on startup
  - [ ] No seed methods remain
  - [ ] All tests pass

## Do

- **Tasks**:
  - [ ] Wave 1: Create `data/initial.db` from current PG data
  - [ ] Wave 2: Implement `initial-data-loader.ts` with sync logic
  - [ ] Wave 3: Replace seed calls in `index.ts`, remove seed code from repositories
  - [ ] Wave 4: Update Docker, add tests

- **Progress Log**:
  - 2026-03-13: Plan created, implementation started

## Check

- **Results**:
  - [Pending]

- **Evidence**:
  - [Pending]

## Act

- **Learnings**:
  1. [Pending]

- **Next Actions**:
  1. [Pending]
