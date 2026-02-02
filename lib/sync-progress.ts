/**
 * 동기화 진행 상태 추적 (in-memory)
 */

export type SyncType = 'sync' | 'import2025';

export interface SyncProgress {
  inProgress: boolean;
  type: SyncType | null;
  startedAt: string | null;
  message: string | null;
  currentStep: string | null;
  processed?: number;
  total?: number;
}

export interface LastResult {
  type: SyncType;
  success: boolean;
  finishedAt: string;
  saved?: number;
  total?: number;
  existing?: number;
  error?: string;
}

let syncProgress: SyncProgress = {
  inProgress: false,
  type: null,
  startedAt: null,
  message: null,
  currentStep: null,
};

let lastSyncResult: LastResult | null = null;
let lastImportResult: LastResult | null = null;

export function startSync(type: SyncType) {
  syncProgress = {
    inProgress: true,
    type,
    startedAt: new Date().toISOString(),
    message: type === 'sync' ? '용산/광주 동기화 중' : '용산2025/광주2025 1회 적재 중',
    currentStep: '시트 읽기',
  };
}

export function updateProgress(step: string, processed?: number, total?: number) {
  syncProgress = {
    ...syncProgress,
    currentStep: step,
    processed,
    total,
  };
}

export function finishSync(
  type: SyncType,
  success: boolean,
  result: { saved?: number; total?: number; existing?: number; error?: string }
) {
  const now = new Date().toISOString();
  const lastResult: LastResult = {
    type,
    success,
    finishedAt: now,
    saved: result.saved,
    total: result.total,
    existing: result.existing,
    error: result.error,
  };

  if (type === 'sync') {
    lastSyncResult = lastResult;
  } else {
    lastImportResult = lastResult;
  }

  syncProgress = {
    inProgress: false,
    type: null,
    startedAt: null,
    message: success ? '완료' : '실패',
    currentStep: null,
    processed: result.saved,
    total: result.total,
  };
}

export function getProgress(): SyncProgress {
  return { ...syncProgress };
}

export function getLastResults(): {
  sync: LastResult | null;
  import2025: LastResult | null;
} {
  return {
    sync: lastSyncResult ? { ...lastSyncResult } : null,
    import2025: lastImportResult ? { ...lastImportResult } : null,
  };
}
