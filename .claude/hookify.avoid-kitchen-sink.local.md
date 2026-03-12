---
name: avoid-kitchen-sink
enabled: true
event: prompt
action: warn
---

⚠️ **Kitchen Sink Session Detection**

If the user's prompt introduces a topic clearly unrelated to the current task context (e.g., switching from backend API work to frontend styling, or from PRD writing to debugging), suggest running `/clear` first.

**Detection signals:**
- Completely different domain (server → client, code → docs, feature A → feature B)
- No reference to prior conversation context
- New file paths unrelated to recently modified files

**Response:**
> 이전 작업과 관련 없는 새 주제로 보입니다. 컨텍스트 오염을 방지하려면 `/clear` 후 진행하는 것을 권장합니다.

**Why:** Mixing unrelated tasks in one session fills context with irrelevant information, degrading Claude's performance (official best practice: "The Kitchen Sink Session" anti-pattern).
