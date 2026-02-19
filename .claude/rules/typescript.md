# TypeScript & Next.js 규칙

## TypeScript
- strict 모드 활성화 (`tsconfig.json`)
- path alias `@/*` 사용 (예: `@/lib/types`)
- 타입 정의는 `lib/types.ts`에 집중
- `any` 타입 사용 최소화, 불가피한 경우 주석으로 이유 설명
- BigQuery 응답은 `Record<string, unknown>` 수신 후 타입 변환

## Next.js App Router
- API routes: `app/api/{name}/route.ts` (Route Handlers)
- 페이지: `app/page.tsx` (서버 컴포넌트 기본)
- 클라이언트 컴포넌트: 파일 상단 `'use client'` 선언
- 환경변수: 서버 전용은 `BIGQUERY_*`, 클라이언트용은 `NEXT_PUBLIC_*`

## 컴포넌트 패턴
- shadcn/ui 기반 컴포넌트 (`components/ui/`)
- hooks는 `hooks/` 디렉토리에 `use-{name}.ts` 네이밍
- 상태 관리: React hooks (useState, useEffect)
- 데이터 패칭: hooks에서 fetch API 사용

## BigQuery 쿼리
- 테이블 참조 시 fully qualified name: `csopp-25f2.KMCC_QC.{table}`
- 날짜 파티션 활용 (WHERE절에 파티션 컬럼 포함)
- 쿼리 결과 타입은 `lib/types.ts` 인터페이스와 매핑
