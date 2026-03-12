# Money Bus V3 — Service Definition

## Vision

가족 단위 금융자산을 한 곳에서 관리하는 셀프호스팅 웹 애플리케이션. 가족 구성원별 자산 현황 파악, 변동 추적, 재무 의사결정(세금, 상속, 은퇴)을 지원한다.

## Target User

- 가족 전체 금융자산을 직접 관리하는 개인 (가장 역할)
- 금융자산(주식, 펀드, 예적금, 현금, 채권, 암호화폐) 중심
- 로컬 환경(PC/NAS)에서 Docker로 셀프호스팅
- 수동 입력 기반, 시세는 API로 자동 반영

## Core Values

1. **가족 중심 자산 가시성** — 가족 구성원별 자산을 통합 조회하고, 가계 전체 재무 상태를 한눈에 파악
2. **셀프호스팅 우선** — 민감한 금융 데이터를 외부에 맡기지 않음. Docker 기반 로컬 운영
3. **수동 입력 + 시세 자동 반영** — 사용자가 보유 자산을 직접 관리하되, 시장가격은 API로 자동 업데이트
4. **점진적 확장** — 인증, 클라우드 배포 등은 필요 시 추가. 현재 범위에 집중
5. **풀스택 타입 안전성** — Zod 스키마와 TypeScript 인터페이스 간 동기화 유지

## Strategic Priorities

1. **자산 관리 기반 구축** — 계좌/보유자산 CRUD, 가족 구성원 연결
2. **현황 대시보드** — 가족/개인별 자산 요약, 자산 유형별 분포
3. **시세 연동** — 주식/암호화폐 등 시장가격 자동 반영
4. **변동 추적** — 자산 스냅샷, 시계열 트렌드
5. **재무 플래닝** — 세금, 상속, 은퇴 계획 지원 도구

## Anti-Patterns

- **부동산/보험/대출 등 비금융자산 관리** — 금융자산 범위를 벗어나는 기능 추가 금지
- **외부 계좌 자동 연동** — 증권사/은행 API 직접 연동은 범위 밖
- **멀티테넌트/SaaS** — 다중 가구 지원, 과금 체계 등 SaaS 기능 금지
- **클라우드 종속** — 특정 클라우드 서비스에 의존하는 구현 금지
- **과도한 추상화** — 커스텀 프레임워크 레이어, 매직 베이스 클래스 금지

## Governance

- **PRD 생성 시** — service-definition.md의 Vision, Strategic Priorities와 정합성 확인 후 service-definition.md 업데이트
- **Anti-Pattern 위반 PRD** — 적용 여부를 반드시 재검토. Anti-Pattern에 해당하면 거부 또는 service-definition.md 자체를 먼저 개정

## Improve Scoring Guide

`/improve-infra`, `/improve-architecture`, `/improve-features` use these weights when evaluating candidates:

| Factor | Weight | Description |
|--------|--------|-------------|
| **Security vulnerabilities** | 4x | 금융 데이터 보호 최우선 |
| **Asset data integrity** | 4x | 자산 데이터 정확성, 계산 오류 방지 |
| **Full-stack type safety** | 3x | Zod-TypeScript 동기화 |
| **Developer experience** | 3x | 빠른 피드백 루프, 간편한 로컬 실행 |
| **Technology modernization** | 2x | 최신 안정 버전 유지 |
| **Docker optimization** | 2x | 이미지 크기, 빌드 캐싱, 헬스체크 |
| **API contract consistency** | 2x | 응답 포맷, 상태 코드, 에러 엔벨로프 |
| **Code quality** | 2x | 커버리지, 타입 안전성, 린트 |
| **Anti-pattern violation** | 0x | 위반 시 무조건 거부 |

Score = Impact / Complexity, multiplied by weight. Candidates violating anti-patterns are rejected regardless of score.

## Change Log

| Date | Change | Trigger |
|------|--------|---------|
| 2026-03-12 | Initial creation from v2 service definition, adapted for Hono + Drizzle stack | Manual |
