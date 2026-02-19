# Dashboard Improvement - Gap Analysis Report

> **Summary**: Design vs Implementation gap analysis for dashboard-improvement feature
>
> **Author**: gap-detector (automated)
> **Created**: 2026-02-16
> **Last Modified**: 2026-02-16
> **Status**: Draft

---

## Analysis Overview

- **Analysis Target**: dashboard-improvement
- **Design Document**: `docs/02-design/features/dashboard-improvement.design.md`
- **Implementation Path**: Project root (lib/, components/, app/api/)
- **Analysis Date**: 2026-02-16

---

## Overall Scores

| Category | Score | Status |
|----------|:-----:|:------:|
| Phase 1: Data Recovery | N/A | -- (Infrastructure checks, not verifiable from code) |
| Phase 2: Code Cleanup | 100% | PASS |
| Phase 3: API Stabilization | 80% | PARTIAL |
| Phase 4: Deployment | N/A | -- (Infrastructure checks, not verifiable from code) |
| **Code-Verifiable Items (11 total)** | **91%** | PASS |

> **Match Rate**: 91% (10 matched / 11 code-verifiable items)
>
> Items 1-2, 1-3, 1-4, 3-5, 4-1, 4-2, 4-3, 4-4 are infrastructure/runtime checks that cannot be verified through static code analysis.

---

## Detailed Item Analysis

### Phase 1: Data Recovery (Critical)

| ID | Item | Status | Details |
|:---|:-----|:------:|:--------|
| 1-1 | `.env.local` GOOGLE_SHEETS_ID | PASS | Line 9: `GOOGLE_SHEETS_ID=14pXr3QNz_xY3vm9QNaF2yOtle1M4dqAuGb7Z5ebpi2o` |
| 1-2 | Cloud Scheduler API activation | N/A | Infrastructure check -- cannot verify from code. Requires `gcloud services list` |
| 1-3 | Local manual sync test | N/A | Runtime check -- requires `curl -X POST http://localhost:3000/api/sync-sheets` |
| 1-4 | BigQuery Feb 2026 data exists | N/A | Runtime check -- requires BigQuery query execution |

**Phase 1 Code-Verifiable**: 1/1 matched (100%)

---

### Phase 2: Code Cleanup (High)

| ID | Item | Status | Details |
|:---|:-----|:------:|:--------|
| 2-1 | 14 component imports changed to `@/lib/constants` | PASS | All 14 files confirmed (see detail below) |
| 2-2 | `constants.ts` tenures export | PASS | Line 124: `export const tenures = tenureCategories` |
| 2-3 | `lib/mock-data.ts` deleted | PASS | File not found (confirmed deleted) |
| 2-4 | `lib/firebase-admin.ts` deleted | PASS | File not found (confirmed deleted) |
| 2-5 | `app/api/reset/route.ts` deleted | PASS | File not found (confirmed deleted) |
| 2-6 | `app/api/delete-fake-data/` deleted | PASS | Directory not found (confirmed deleted) |

**Phase 2 Score: 6/6 matched (100%)**

#### 2-1 Detail: Component Import Path Verification

| File | Import Source | Status |
|:-----|:-------------|:------:|
| `components/qc/reports/report-generator.tsx` | `@/lib/constants` | PASS |
| `components/qc/predictions/index.tsx` | `@/lib/constants` | PASS |
| `components/qc/settings/alert-settings.tsx` | `@/lib/constants` | PASS |
| `components/qc/agents/agent-filters.tsx` | `@/lib/constants` | PASS |
| `components/qc/goals/goal-form-modal.tsx` | `@/lib/constants` | PASS |
| `components/qc/dashboard/weekly-error-table.tsx` | `@/lib/constants` | PASS |
| `components/qc/ai-assistant/agent-selector.tsx` | `@/lib/constants` | PASS |
| `components/qc/agents/agent-detail-modal.tsx` | `@/lib/constants` | PASS |
| `components/qc/dashboard/daily-error-table.tsx` | `@/lib/constants` | PASS |
| `components/qc/dashboard/dashboard-filters.tsx` | `@/lib/constants` | PASS |
| `components/qc/dashboard/tenure-error-table.tsx` | `@/lib/constants` | PASS |
| `components/qc/dashboard/item-analysis.tsx` | `@/lib/constants` | PASS |
| `components/qc/dashboard/service-weekly-table.tsx` | `@/lib/constants` | PASS |
| `components/qc/focus/index.tsx` | `@/lib/constants` | PASS |

Zero references to `@/lib/mock-data` remain in the codebase (outside design doc).

---

### Phase 3: API Stabilization (Medium)

| ID | Item | Status | Details |
|:---|:-----|:------:|:--------|
| 3-1 | `lib/bigquery.ts` withRetry utility | PASS | Lines 73-95: Full implementation with exponential backoff, retryable error detection (UNAVAILABLE, DEADLINE_EXCEEDED, INTERNAL, rateLimitExceeded) |
| 3-2 | `lib/vertex-ai.ts` VERTEX_AI_PROJECT_ID fallback | PASS | Line 57: `process.env.VERTEX_AI_PROJECT_ID \|\| process.env.GCP_PROJECT_ID` -- exact match |
| 3-3 | `app/api/sync-sheets/route.ts` UNNEST parameterized query | **GAP** | See gap detail below |
| 3-4 | `npm run build` script with --webpack | PASS | package.json line 6: `"build": "next build --webpack"` |
| 3-5 | lint errors = 0 | N/A | No ESLint config found at project root. `npm run lint` would likely fail or use Next.js defaults. Cannot verify statically. |

**Phase 3 Code-Verifiable**: 3/4 matched (75%)

---

### Phase 4: Deployment (High)

| ID | Item | Status | Details |
|:---|:-----|:------:|:--------|
| 4-1 | Cloud Run qc-dashboard deployed | N/A | Infrastructure check |
| 4-2 | Cloud Scheduler sync-sheets-daily created | N/A | Infrastructure check |
| 4-3 | Cloud Scheduler manual test | N/A | Runtime check |
| 4-4 | Sync verification | N/A | Runtime check |

**Phase 4**: All items are infrastructure/runtime -- not verifiable from code.

---

## Differences Found

### GAP: 3-3 sync-sheets UNNEST Parameterized Query

**Design Specification** (design.md lines 226-239):
```typescript
// Use UNNEST + parameterized query for safer SQL
const CHUNK_SIZE = 10000;
for (let i = 0; i < evaluationIds.length; i += CHUNK_SIZE) {
  const chunk = evaluationIds.slice(i, i + CHUNK_SIZE);
  const [rows] = await bigquery.query({
    query: `SELECT DISTINCT evaluation_id FROM ${EVAL_TABLE} WHERE evaluation_id IN UNNEST(@ids)`,
    params: { ids: chunk },
    types: { ids: ['STRING'] },
    location: 'asia-northeast3',
  });
}
```

**Actual Implementation** (`app/api/sync-sheets/route.ts` lines 64-87):

The file contains two conflicting query approaches:

1. **Dead code** (lines 64-68): An UNNEST query is defined in `existingIdsQuery` variable but **never used**:
   ```typescript
   const existingIdsQuery = `
     SELECT DISTINCT evaluation_id
     FROM ${EVAL_TABLE}
     WHERE evaluation_id IN UNNEST(@evaluation_ids)
   `;
   ```

2. **Actual execution** (lines 76-82): Still uses string interpolation with manual SQL-escape:
   ```typescript
   // BigQuery는 UNNEST에 배열을 직접 전달할 수 없으므로, IN 절 사용
   const idsList = evaluationIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',');
   const query = `
     SELECT DISTINCT evaluation_id
     FROM ${EVAL_TABLE}
     WHERE evaluation_id IN (${idsList})
   `;
   ```

**Impact**: High
- The design intended to use parameterized queries with `UNNEST(@ids)` to prevent SQL injection
- The current implementation uses string interpolation, which is less safe
- The UNNEST query variable is dead code, suggesting an incomplete migration
- No chunking is applied (design specified `CHUNK_SIZE = 10000` for large datasets)

---

### Note: ESLint Configuration Missing

The design item 3-5 (`npm run lint` with 0 errors) cannot be verified because:
- No `.eslintrc.*` or `eslint.config.*` file exists at the project root
- The `package.json` has `"lint": "eslint ."` but no ESLint dependencies in devDependencies
- Running `npm run lint` would likely fail or produce unexpected results

This is not listed as a gap since the design only required "0 lint errors" -- but the missing ESLint configuration is a risk.

---

## Score Summary

### Code-Verifiable Items Only

| Phase | Verifiable Items | Matched | Score |
|:------|:----------------:|:-------:|:-----:|
| Phase 1 | 1 | 1 | 100% |
| Phase 2 | 6 | 6 | 100% |
| Phase 3 | 4 | 3 | 75% |
| Phase 4 | 0 | 0 | N/A |
| **Total** | **11** | **10** | **91%** |

### All Items (Including Infrastructure)

| Phase | Total Items | Code-Matched | Infra/N/A | Gaps |
|:------|:-----------:|:------------:|:---------:|:----:|
| Phase 1 | 4 | 1 | 3 | 0 |
| Phase 2 | 6 | 6 | 0 | 0 |
| Phase 3 | 5 | 3 | 1 | 1 |
| Phase 4 | 4 | 0 | 4 | 0 |
| **Total** | **19** | **10** | **8** | **1** |

---

## Recommended Actions

### Immediate Action (Priority: High)

1. **Fix sync-sheets UNNEST parameterized query** (`app/api/sync-sheets/route.ts`)
   - Remove the unused `existingIdsQuery` variable (line 64-68)
   - Replace the string interpolation approach (lines 76-87) with the UNNEST parameterized query
   - Add chunk-based processing with `CHUNK_SIZE = 10000` as specified in design
   - This eliminates SQL injection risk for the `evaluation_id` values

### Recommended (Priority: Medium)

2. **Add ESLint configuration** at project root
   - Create `eslint.config.mjs` (ESLint flat config for Next.js 16)
   - Add `eslint` and `@next/eslint-plugin-next` to devDependencies
   - Run `npm run lint` to verify 0 errors

### Infrastructure Verification Needed

3. **Phase 1 items** (1-2, 1-3, 1-4): Verify Cloud Scheduler API activation, run manual sync, confirm BigQuery February data
4. **Phase 4 items** (4-1 through 4-4): Deploy to Cloud Run, create Cloud Scheduler job, test end-to-end

---

## Synchronization Options

Since Match Rate is 91% (>= 90%), design and implementation match well.

The single gap (3-3: UNNEST query) should be fixed in implementation to match the design document.

**Recommendation**: Modify implementation to match design (Option 1).

---

## Related Documents

- Plan: [dashboard-improvement.plan.md](../01-plan/features/dashboard-improvement.plan.md)
- Design: [dashboard-improvement.design.md](../02-design/features/dashboard-improvement.design.md)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-02-16 | Initial gap analysis | gap-detector |
