#!/usr/bin/env bash
# usage-report.sh — Analyze Claude Code session transcript for .claude feature usage
# Usage: .claude/scripts/usage-report.sh [transcript.jsonl]
#   If no file given, uses the most recent transcript for this project.

set -eu

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
PROJECT_KEY=$(echo "$PROJECT_DIR" | sed 's|/|-|g')
TRANSCRIPT_DIR="$HOME/.claude/projects/$PROJECT_KEY"

if [ $# -ge 1 ]; then
  FILE="$1"
else
  FILE=$(ls -t "$TRANSCRIPT_DIR"/*.jsonl 2>/dev/null | head -1 || true)
  if [ -z "$FILE" ]; then
    echo "No transcript found in $TRANSCRIPT_DIR" >&2
    exit 1
  fi
fi

if [ ! -f "$FILE" ]; then
  echo "File not found: $FILE" >&2
  exit 1
fi

# Temp files for intermediate results
TMP_TOOLS=$(mktemp)
TMP_HOOKS=$(mktemp)
TMP_BRANCHES=$(mktemp)
trap 'rm -f "$TMP_TOOLS" "$TMP_HOOKS" "$TMP_BRANCHES"' EXIT

# Single jq pass to extract all tool_use entries
jq -r '
  select(.type == "assistant") |
  .message.content[]? |
  select(.type == "tool_use") |
  "\(.name)\t\(.input.skill // .input.subagent_type // "")\t\(.input.file_path // .input.path // "")\t\(.input.description // "")"
' "$FILE" > "$TMP_TOOLS" 2>/dev/null || true

# Extract hooks and branches
jq -r 'select(.type == "progress") | select(.data.hookEvent) | .data.hookEvent' "$FILE" > "$TMP_HOOKS" 2>/dev/null || true
jq -r 'select(.gitBranch) | .gitBranch' "$FILE" > "$TMP_BRANCHES" 2>/dev/null || true

SESSION_DATE=$(jq -r '.timestamp // empty' "$FILE" 2>/dev/null | head -1 | cut -d'T' -f1 || echo "unknown")
SESSION_ID=$(basename "$FILE" .jsonl)
LINE_COUNT=$(wc -l < "$FILE" | tr -d ' ')

echo "================================================================"
echo "  Claude Code Usage Report"
echo "================================================================"
echo "Session:   $SESSION_ID"
echo "Date:      ${SESSION_DATE:-unknown}"
echo "Entries:   $LINE_COUNT"
echo ""

# ── Tool Usage Summary ──
echo "── Tool Usage Summary ──"
cut -f1 "$TMP_TOOLS" | sort | uniq -c | sort -rn
echo ""

# ── Skills Invoked ──
echo "── Skills Invoked ──"
SKILLS=$(awk -F'\t' '$1 == "Skill" && $2 != "" { print $2 }' "$TMP_TOOLS")
if [ -n "$SKILLS" ]; then
  echo "$SKILLS" | sort | uniq -c | sort -rn
else
  echo "  (none)"
fi
echo ""

# ── Agents Used ──
echo "── Agents Used (Task tool) ──"
AGENTS=$(awk -F'\t' '$1 == "Task" && $2 != "" { print $2 ": " $4 }' "$TMP_TOOLS")
if [ -n "$AGENTS" ]; then
  echo "$AGENTS" | while IFS= read -r line; do echo "  - $line"; done
else
  echo "  (none)"
fi
echo ""

# ── Hooks Fired ──
echo "── Hooks Fired ──"
if [ -s "$TMP_HOOKS" ]; then
  sort "$TMP_HOOKS" | uniq -c | sort -rn | while read -r count name; do
    printf "  %4s  %s\n" "$count" "$name"
  done
else
  echo "  (none)"
fi
echo ""

# ── Files Edited ──
echo "── Files Edited ──"
EDITED_FILES=$(awk -F'\t' '($1 == "Edit" || $1 == "Write") && $3 != "" { print $3 }' "$TMP_TOOLS" | sort -u)
if [ -n "$EDITED_FILES" ]; then
  echo "$EDITED_FILES" | while IFS= read -r f; do
    echo "  $(echo "$f" | sed "s|$PROJECT_DIR/||")"
  done
else
  echo "  (none)"
fi
echo ""

# ── Rules Likely Loaded ──
echo "── Rules Likely Loaded (inferred from edited paths) ──"
RULES_DIR="$PROJECT_DIR/.claude/rules"
if [ -d "$RULES_DIR" ]; then
  for rule_file in "$RULES_DIR"/*.md; do
    [ -f "$rule_file" ] || continue
    rule_name=$(basename "$rule_file")
    # Extract paths from YAML frontmatter
    paths=$(sed -n '/^---$/,/^---$/p' "$rule_file" | grep -E "^\s*- '" | sed "s/.*'\\(.*\\)'.*/\\1/" || true)
    if [ -z "$paths" ]; then
      echo "  [ALWAYS]  $rule_name"
    else
      matched=false
      while IFS= read -r pattern; do
        [ -z "$pattern" ] && continue
        regex=$(echo "$pattern" | sed 's|\*\*|.*|g' | sed 's|\*|[^/]*|g')
        if echo "$EDITED_FILES" | grep -q "$regex" 2>/dev/null; then
          matched=true
          break
        fi
      done <<< "$paths"
      if $matched; then
        echo "  [LOADED]  $rule_name  (paths: $paths)"
      fi
    fi
  done
fi
echo ""

# ── Git Branches ──
echo "── Git Branches ──"
if [ -s "$TMP_BRANCHES" ]; then
  sort -u "$TMP_BRANCHES" | while IFS= read -r b; do echo "  - $b"; done
else
  echo "  (none)"
fi
echo ""

echo "================================================================"
echo "  [ALWAYS] = No paths filter, loaded for all files"
echo "  [LOADED] = paths filter matched edited files"
echo "================================================================"
