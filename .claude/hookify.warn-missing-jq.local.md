---
name: warn-missing-jq
enabled: true
event: file
action: warn
conditions:
  - field: file_path
    operator: regex_match
    pattern: \.claude/hooks/.*\.sh$
  - field: new_text
    operator: regex_match
    pattern: grep.*-o.*json|sed.*json|awk.*json
---

⚠️ **Fragile JSON Parsing Detected**

Hook 스크립트에서 grep/sed/awk 기반 JSON 파싱이 감지되었습니다.

**권장 패턴:**
```bash
if command -v jq &>/dev/null; then
  VALUE=$(echo "$INPUT" | jq -r '.field // empty')
else
  VALUE=$(echo "$INPUT" | grep -o '"field":"[^"]*"' | head -1 | sed 's/"field":"//;s/"$//')
fi
```

**이유:**
- jq가 더 안정적 (JSON 구조 변경에 강건)
- 공식 docs가 jq 사용을 권장
- jq 미설치 시 fallback 포함 필수

See: `.claude/hooks/block-dangerous-commands.sh` (jq + fallback 예시)
