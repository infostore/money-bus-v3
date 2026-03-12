#!/usr/bin/env bash
# stop-hook.sh — Ralph loop continuation hook
# Registered as a Stop hook in .claude/settings.json
# Reads state from .claude/ralph-loop.local.md, checks exit conditions,
# and either blocks stop (continue loop) or approves stop (exit loop).
#
# Based on frankbria/ralph-claude-code v0.11.5
# Combines cnx structure (RALPH_STATUS, dual-condition exit, kebab-case)
# with money-bus robustness (python3 JSON, git fingerprint, session file)

set -euo pipefail

# --- Resolve paths relative to project root ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

STATE_FILE="$PROJECT_ROOT/.claude/ralph-loop.local.md"
SESSION_FILE="$PROJECT_ROOT/.claude/ralph-session.local.json"
PROGRESS_FILE="$PROJECT_ROOT/.claude/ralph-progress.local.md"

# ─── Helper: parse YAML frontmatter value ────────────────────────────
get_field() {
  local key="$1"
  sed -n '/^---$/,/^---$/p' "$STATE_FILE" \
    | grep "^${key}:" \
    | head -1 \
    | sed "s/^${key}: *//" \
    | sed 's/^"\(.*\)"$/\1/' \
    | sed "s/^'\(.*\)'$/\1/"
}

# ─── Helper: update YAML frontmatter field in-place ──────────────────
set_field() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}:" "$STATE_FILE" 2>/dev/null; then
    awk -v k="$key" -v v="$value" '{if ($0 ~ "^"k":") print k": "v; else print}' "$STATE_FILE" > "${STATE_FILE}.tmp"
    mv "${STATE_FILE}.tmp" "$STATE_FILE"
  fi
}

# ─── Helper: get prompt body (everything after second ---) ───────────
get_prompt() {
  awk 'BEGIN{n=0} /^---$/{n++; next} n>=2{print}' "$STATE_FILE"
}

# ─── Helper: ISO 8601 timestamp ──────────────────────────────────────
now_iso() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

# ─── Helper: epoch seconds (cross-platform: macOS + Linux) ───────────
to_epoch() {
  local ts="$1"
  if date -j -f "%Y-%m-%dT%H:%M:%SZ" "$ts" +%s 2>/dev/null; then
    return
  fi
  date -d "$ts" +%s 2>/dev/null || echo 0
}

now_epoch() {
  date +%s
}

# ─── Helper: git diff fingerprint for circuit breaker ────────────────
git_fingerprint() {
  local fp
  fp=$(git -C "$PROJECT_ROOT" diff --stat 2>/dev/null | md5 2>/dev/null \
    || git -C "$PROJECT_ROOT" diff --stat 2>/dev/null | md5sum 2>/dev/null | cut -d' ' -f1 \
    || echo "none")
  printf '%s' "$fp" | tr -d '\n'
}

# ─── Helper: record call to session file (python3 for safe JSON) ─────
record_call() {
  local now
  now=$(now_iso)
  if [[ ! -f "$SESSION_FILE" ]]; then
    echo "{\"calls\":[\"$now\"],\"total_iterations\":1}" > "$SESSION_FILE"
  else
    local updated
    updated=$(python3 -c "
import json
with open('$SESSION_FILE') as f:
    d = json.load(f)
d['calls'].append('$now')
d['total_iterations'] = d.get('total_iterations', 0) + 1
d['calls'] = d['calls'][-200:]
print(json.dumps(d))
" 2>/dev/null || echo "{\"calls\":[\"$now\"],\"total_iterations\":1}")
    echo "$updated" > "$SESSION_FILE"
  fi
}

# ─── Helper: count calls in last hour ────────────────────────────────
calls_last_hour() {
  if [[ ! -f "$SESSION_FILE" ]]; then
    echo 0
    return
  fi
  python3 -c "
import json
from datetime import datetime, timedelta, timezone
with open('$SESSION_FILE') as f:
    d = json.load(f)
cutoff = datetime.now(timezone.utc) - timedelta(hours=1)
count = 0
for c in d.get('calls', []):
    try:
        t = datetime.fromisoformat(c.replace('Z', '+00:00'))
        if t > cutoff:
            count += 1
    except:
        pass
print(count)
" 2>/dev/null || echo 0
}

# ─── Helper: clean exit (allow stop) ─────────────────────────────────
clean_exit() {
  local reason="${1:-}"
  if [[ -n "$reason" ]]; then
    echo "[Ralph Loop] Stopped: $reason" >&2
  fi
  exit 0
}

# ═══════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════

# 1. Check if ralph loop is active
if [[ ! -f "$STATE_FILE" ]]; then
  exit 0
fi

active=$(get_field "active")
if [[ "$active" != "true" ]]; then
  exit 0
fi

# 2. Read configuration (kebab-case keys)
iteration=$(get_field "iteration" || echo "0")
max_iterations=$(get_field "max-iterations" || echo "50")
circuit_breaker_limit=$(get_field "circuit-breaker" || echo "3")
no_change_count=$(get_field "no-change-count" || echo "0")
rate_limit=$(get_field "rate-limit" || echo "100")
completion_promise=$(get_field "completion-promise" || echo "false")
completion_indicators=$(get_field "completion-indicators" || echo "0")
session_ttl=$(get_field "session-ttl" || echo "24")
started_at=$(get_field "started-at" || echo "")
last_git_fingerprint=$(get_field "git-fingerprint" || echo "")
progress_enabled=$(get_field "progress" || echo "false")

# Ensure numeric defaults
iteration=${iteration:-0}
max_iterations=${max_iterations:-50}
rate_limit=${rate_limit:-100}
circuit_breaker_limit=${circuit_breaker_limit:-3}
session_ttl=${session_ttl:-24}
no_change_count=${no_change_count:-0}
completion_indicators=${completion_indicators:-0}

# 3. Check: completion flag (Claude set completed: true)
completed=$(get_field "completed" || echo "")
if [[ "$completed" == "true" ]]; then
  set_field "active" "false"
  clean_exit "Completion flag set. Loop finished after $iteration iterations."
fi

# 4. Check: RALPH_STATUS dual-condition exit (if completion-promise enabled)
# Read stdin (stop event payload) non-blocking
input_peek=""
if read -t 1 -r input_peek 2>/dev/null; then
  # Try to read more lines
  while IFS= read -t 0.1 -r line 2>/dev/null; do
    input_peek="$input_peek"$'\n'"$line"
  done
fi

if [[ "$completion_promise" == "true" ]]; then
  exit_signal="false"
  if echo "$input_peek" | grep -q "EXIT_SIGNAL: true" 2>/dev/null; then
    exit_signal="true"
  fi

  if echo "$input_peek" | grep -q "STATUS: COMPLETE" 2>/dev/null; then
    completion_indicators=$((completion_indicators + 1))
    set_field "completion-indicators" "$completion_indicators"
  fi

  # Dual-condition gate: indicators >= 2 AND EXIT_SIGNAL
  if [[ $completion_indicators -ge 2 ]] && [[ "$exit_signal" == "true" ]]; then
    set_field "active" "false"
    clean_exit "Dual-condition met (indicators: $completion_indicators, EXIT_SIGNAL: true). Loop finished after $iteration iterations."
  fi
else
  # Without completion-promise, check for simple EXIT_SIGNAL
  if echo "$input_peek" | grep -q "EXIT_SIGNAL: true" 2>/dev/null; then
    set_field "active" "false"
    clean_exit "EXIT_SIGNAL received. Loop finished after $iteration iterations."
  fi
fi

# 5. Check: session TTL expired
if [[ -n "$started_at" ]]; then
  start_epoch=$(to_epoch "$started_at")
  current_epoch=$(now_epoch)
  elapsed_hours=$(( (current_epoch - start_epoch) / 3600 ))
  if [[ $elapsed_hours -ge $session_ttl ]]; then
    set_field "active" "false"
    clean_exit "Session TTL expired (${elapsed_hours}h >= ${session_ttl}h limit)."
  fi
fi

# 6. Check: rate limit (calls per hour via session file)
hourly_calls=$(calls_last_hour)
if [[ $hourly_calls -ge $rate_limit ]]; then
  set_field "active" "false"
  clean_exit "Rate limit reached (${hourly_calls}/${rate_limit} calls/hour)."
fi

# 7. Check: circuit breaker (git fingerprint comparison)
if [[ $circuit_breaker_limit -gt 0 ]]; then
  current_fingerprint=$(git_fingerprint)
  if [[ "$current_fingerprint" == "$last_git_fingerprint" && -n "$last_git_fingerprint" ]]; then
    no_change_count=$((no_change_count + 1))
  else
    no_change_count=0
  fi
  set_field "git-fingerprint" "$current_fingerprint"
  set_field "no-change-count" "$no_change_count"

  if [[ $no_change_count -ge $circuit_breaker_limit ]]; then
    set_field "active" "false"
    clean_exit "Circuit breaker: no file changes for $no_change_count iterations."
  fi
fi

# 8. Check: max iterations
if [[ $max_iterations -gt 0 && $iteration -ge $max_iterations ]]; then
  set_field "active" "false"
  clean_exit "Max iterations reached ($iteration/$max_iterations)."
fi

# ─── All checks passed: continue the loop ─────────────────────────────

# Increment iteration
iteration=$((iteration + 1))
set_field "iteration" "$iteration"
set_field "last-iteration-at" "$(now_iso)"

# Record call for rate limiting
record_call

# Write progress if enabled
if [[ "$progress_enabled" == "true" && -f "$PROGRESS_FILE" ]]; then
  {
    echo "## Iteration ${iteration} — $(now_iso)"
    echo ""
    echo "- Git fingerprint changed: $([ "$no_change_count" -eq 0 ] && echo 'yes' || echo 'no')"
    echo "- No-progress streak: ${no_change_count}"
    echo "- Calls this hour: ${hourly_calls}"
    echo ""
  } >> "$PROGRESS_FILE"
fi

# Build continuation prompt and output block decision as valid JSON (python3)
prompt=$(get_prompt)
iter_display="$iteration"
if [[ $max_iterations -gt 0 ]]; then
  iter_display="${iteration}/${max_iterations}"
fi

python3 -c "
import json, sys

prompt = sys.stdin.read().strip()
iteration = $iteration
max_iter = $max_iterations
no_change = $no_change_count
iter_info = '$iter_display'

msg = f'[Ralph Loop - Iteration {iter_info}]\n\n'
msg += 'Continue working on the task. Review your previous progress and pick up where you left off.\n\n'

if no_change > 0:
    msg += f'WARNING: {no_change} consecutive loops with no file changes. Make progress or the circuit breaker will halt the loop.\n\n'

msg += '---\n'
msg += prompt
msg += '\n---\n\n'
msg += 'IMPORTANT: When the task is fully complete'
completion_promise = '''$completion_promise'''
if completion_promise == 'true':
    msg += ', include RALPH_STATUS with STATUS: COMPLETE and EXIT_SIGNAL: true'
else:
    msg += ', update .claude/ralph-loop.local.md to set completed: true (or include EXIT_SIGNAL: true in RALPH_STATUS)'
msg += '.'

print(json.dumps({'decision': 'block', 'reason': msg}))
" <<< "$prompt"
