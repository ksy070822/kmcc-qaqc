import { BigQuery } from '@google-cloud/bigquery';
import { AgentAnalysisContext, GroupAnalysisContext } from './types';
import { SERVICE_NORMALIZE_MAP, INVALID_SERVICE_NAMES, SERVICE_ORDER, SERVICE_CHANNEL_EXTRACT, VALID_CHANNELS, groups as GROUP_ORDER } from './constants';

/**
 * BigQuery 클라이언트 초기화
 * 
 * 인증 방법:
 * 1. BIGQUERY_CREDENTIALS 환경 변수 (JSON 문자열)
 * 2. GOOGLE_APPLICATION_CREDENTIALS 환경 변수 (파일 경로)
 * 3. 기본 애플리케이션 인증 (GCP 환경)
 */
function initializeBigQuery(): BigQuery {
  const projectId = process.env.BIGQUERY_PROJECT_ID || 'csopp-25f2';
  
  // 환경 변수에서 credentials JSON 파싱
  if (process.env.BIGQUERY_CREDENTIALS) {
    try {
      const credentials = JSON.parse(process.env.BIGQUERY_CREDENTIALS);
      return new BigQuery({
        projectId,
        credentials,
        scopes: [
          'https://www.googleapis.com/auth/bigquery',
          'https://www.googleapis.com/auth/drive.readonly',
        ],
      });
    } catch (error) {
      console.error('[BigQuery] Failed to parse BIGQUERY_CREDENTIALS:', error);
      throw new Error('Invalid BIGQUERY_CREDENTIALS format');
    }
  }
  
  // GOOGLE_APPLICATION_CREDENTIALS 환경 변수가 있으면 사용
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const path = require('path');
    const credentialsPath = path.isAbsolute(process.env.GOOGLE_APPLICATION_CREDENTIALS)
      ? process.env.GOOGLE_APPLICATION_CREDENTIALS
      : path.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS);
    
    console.log('[BigQuery] Using credentials file:', credentialsPath);
    return new BigQuery({
      projectId,
      keyFilename: credentialsPath,
      scopes: [
        'https://www.googleapis.com/auth/bigquery',
        'https://www.googleapis.com/auth/drive.readonly',
      ],
    });
  }
  
  // 기본 인증 사용 (Application Default Credentials)
  console.log('[BigQuery] Using Application Default Credentials');
  return new BigQuery({
    projectId,
    scopes: [
      'https://www.googleapis.com/auth/bigquery',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  });
}

// BigQuery 클라이언트 싱글톤
let bigqueryClient: BigQuery | null = null;

export function getBigQueryClient(): BigQuery {
  if (!bigqueryClient) {
    bigqueryClient = initializeBigQuery();
  }
  return bigqueryClient;
}

// 데이터셋 ID
const DATASET_ID = process.env.BIGQUERY_DATASET_ID || 'KMCC_QC';
const HR_DATASET_ID = 'kMCC_HR';

// 서비스명 정규화 (변형→표준명, 잘못된 값→null)
function mapServiceName(raw: string, _center?: string): string | null {
  if (!raw || INVALID_SERVICE_NAMES.includes(raw)) return null;
  return SERVICE_NORMALIZE_MAP[raw] || raw;
}

// 역매핑: 화면 표시명 → BQ 원본명 배열 (필터 쿼리용)
function unmapServiceName(display: string): string[] {
  if (!display) return [display];
  const rawNames = Object.entries(SERVICE_NORMALIZE_MAP)
    .filter(([, normalized]) => normalized === display)
    .map(([raw]) => raw);
  if (!rawNames.includes(display)) rawNames.push(display);
  return rawNames;
}

// service 필터 SQL 조건절 생성 (역매핑 포함)
function addServiceFilter(whereClause: string, params: any, service: string, alias = ''): string {
  const prefix = alias ? `${alias}.` : '';
  const rawNames = unmapServiceName(service);
  if (rawNames.length === 1) {
    whereClause += ` AND ${prefix}service = @service`;
    params.service = rawNames[0];
  } else {
    whereClause += ` AND ${prefix}service IN UNNEST(@serviceNames)`;
    params.serviceNames = rawNames;
  }
  return whereClause;
}

// BigQuery 테이블 참조 (Turbopack SWC 파서 호환을 위해 문자열 상수 사용)
const EVAL_TABLE = '`' + DATASET_ID + '.evaluations`';
const TARGETS_TABLE = '`' + DATASET_ID + '.targets`';
const ACTION_PLANS_TABLE = '`' + DATASET_ID + '.action_plans`';

// BigQuery 위치 (기본값: asia-northeast3)
const GCP_LOCATION = process.env.GCP_LOCATION || 'asia-northeast3';

// ============================================
// HR 데이터 CTE 헬퍼
// ============================================

/**
 * HR 테이블 UNION CTE SQL을 반환 (상담사만, TRIM+LOWER 정규화)
 * Google Sheets 외부 테이블이므로 drive.readonly 스코프 필요
 */
function getHrAgentsCte(): string {
  return `
    hr_agents AS (
      SELECT DISTINCT TRIM(LOWER(id)) as agent_id, hire_date
      FROM \`csopp-25f2.${HR_DATASET_ID}.HR_Yongsan_Live\`
      WHERE type = '상담사' AND hire_date IS NOT NULL
      UNION ALL
      SELECT DISTINCT TRIM(LOWER(id)) as agent_id, hire_date
      FROM \`csopp-25f2.${HR_DATASET_ID}.HR_Gwangju_Live\`
      WHERE type = '상담사' AND hire_date IS NOT NULL
    )`;
}

// ============================================
// HR 데이터 메모리 캐시 (Google Sheets 외부 테이블 성능 최적화)
// ============================================

let hrAgentsCache: Map<string, string> | null = null; // agent_id → hire_date(ISO)
let hrCacheTimestamp = 0;
const HR_CACHE_TTL = 6 * 60 * 60 * 1000; // 6시간

/**
 * HR 상담사 데이터를 메모리 캐시로 반환
 * 첫 호출 시 BigQuery(Google Sheets 외부 테이블)를 1회 조회 후 캐시
 * 이후 6시간 동안 캐시 히트 (Sheets API 호출 없이 즉시 반환)
 */
async function getHrAgentsMap(): Promise<Map<string, string>> {
  if (hrAgentsCache && Date.now() - hrCacheTimestamp < HR_CACHE_TTL) {
    return hrAgentsCache;
  }

  console.log('[BigQuery] Building HR agents cache from Google Sheets external tables...');
  const bigquery = getBigQueryClient();

  const query = `
    SELECT DISTINCT TRIM(LOWER(id)) as agent_id, hire_date
    FROM \`csopp-25f2.${HR_DATASET_ID}.HR_Yongsan_Live\`
    WHERE type = '상담사' AND hire_date IS NOT NULL
    UNION ALL
    SELECT DISTINCT TRIM(LOWER(id)) as agent_id, hire_date
    FROM \`csopp-25f2.${HR_DATASET_ID}.HR_Gwangju_Live\`
    WHERE type = '상담사' AND hire_date IS NOT NULL
  `;

  const [rows] = await bigquery.query({ query, location: GCP_LOCATION });

  const map = new Map<string, string>();
  for (const row of rows) {
    const agentId = String(row.agent_id || '').trim();
    const hireDate = row.hire_date;
    if (agentId && hireDate) {
      // BigQuery DATE → ISO string
      const dateStr = typeof hireDate === 'string'
        ? hireDate
        : hireDate.value
          ? hireDate.value
          : String(hireDate);
      map.set(agentId, dateStr);
    }
  }

  hrAgentsCache = map;
  hrCacheTimestamp = Date.now();
  console.log(`[BigQuery] HR cache built: ${map.size} agents`);
  return map;
}

/**
 * HR 캐시 사전 빌드 (비동기, fire-and-forget)
 * 대시보드 첫 로드 시 호출하여 근속기간별 탭 접근 시 즉시 응답
 */
export function warmupHrCache(): void {
  getHrAgentsMap().catch(err => {
    console.warn('[BigQuery] HR cache warmup failed:', err);
  });
}

/**
 * hire_date에서 근속 개월 수 계산
 */
function calcTenureMonths(hireDateStr: string): number {
  const hireDate = new Date(hireDateStr);
  const now = new Date();
  return (now.getFullYear() - hireDate.getFullYear()) * 12 + (now.getMonth() - hireDate.getMonth());
}

/**
 * 근속 개월 수 → 그룹 분류
 */
function calcTenureGroup(months: number): string {
  if (months < 3) return '3개월 미만';
  if (months < 6) return '3개월 이상';
  if (months < 12) return '6개월 이상';
  return '12개월 이상';
}

// ============================================
// BigQuery 쿼리 재시도 유틸리티
// ============================================

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const isRetryable = error instanceof Error && (
        error.message.includes('UNAVAILABLE') ||
        error.message.includes('DEADLINE_EXCEEDED') ||
        error.message.includes('INTERNAL') ||
        error.message.includes('rateLimitExceeded')
      );
      if (!isRetryable) throw error;
      console.warn(`[BigQuery] Retry ${attempt}/${maxRetries} after ${delayMs * attempt}ms`);
      await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
    }
  }
  throw new Error('Unreachable');
}

// ============================================
// 대시보드 통계 조회
// ============================================

export interface DashboardStats {
  totalAgentsYongsan: number;
  totalAgentsGwangju: number;
  totalEvaluations: number;
  watchlistYongsan: number;
  watchlistGwangju: number;
  attitudeErrorRate: number;
  businessErrorRate: number;
  overallErrorRate: number;
  date: string;
  // 주간 범위
  weekStart?: string;
  weekEnd?: string;
  // 전주 대비 트렌드
  prevWeekStart?: string;
  prevWeekEnd?: string;
  attitudeTrend?: number;
  businessTrend?: number;
  overallTrend?: number;
  // 센터별 오류율
  yongsanAttitudeErrorRate?: number;
  yongsanBusinessErrorRate?: number;
  yongsanOverallErrorRate?: number;
  gwangjuAttitudeErrorRate?: number;
  gwangjuBusinessErrorRate?: number;
  gwangjuOverallErrorRate?: number;
  // 센터별 전주 대비 트렌드
  yongsanOverallTrend?: number;
  gwangjuOverallTrend?: number;
}

export async function getDashboardStats(targetDate?: string, filterStartDate?: string, filterEndDate?: string): Promise<{ success: boolean; data?: DashboardStats; error?: string }> {
  try {
    const bigquery = getBigQueryClient();

    // 기준 날짜 결정 (미지정 시 전영업일)
    let queryDate: string = targetDate || '';

    if (!queryDate) {
      const now = new Date();
      const kstOffset = 9 * 60 * 60 * 1000;
      const kstTime = new Date(now.getTime() + kstOffset);
      const yesterday = new Date(kstTime);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      queryDate = `${yesterday.getUTCFullYear()}-${String(yesterday.getUTCMonth() + 1).padStart(2, '0')}-${String(yesterday.getUTCDate()).padStart(2, '0')}`;
    }

    const fmtDate = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

    // 필터 날짜가 있으면 해당 기간 사용, 없으면 기존 목~수 주간 로직
    const useFilterRange = !!(filterStartDate && filterEndDate);
    let weekStart: string;
    let weekEnd: string;
    let prevWeekStart: string;
    let prevWeekEnd: string;

    if (useFilterRange) {
      // 필터 날짜 범위 사용
      weekStart = filterStartDate!;
      weekEnd = filterEndDate!;

      // 이전 기간 계산: 동일 일수만큼 이전으로 (예: 1월 → 12월)
      const rangeStartDate = new Date(filterStartDate! + 'T00:00:00Z');
      const rangeEndDate = new Date(filterEndDate! + 'T00:00:00Z');
      const rangeDays = Math.round((rangeEndDate.getTime() - rangeStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;

      const prevEnd = new Date(rangeStartDate);
      prevEnd.setUTCDate(prevEnd.getUTCDate() - 1); // 시작일 하루 전
      const prevStart = new Date(prevEnd);
      prevStart.setUTCDate(prevStart.getUTCDate() - rangeDays + 1); // 동일 기간만큼 이전

      prevWeekStart = fmtDate(prevStart);
      prevWeekEnd = fmtDate(prevEnd);

      console.log(`[BigQuery] getDashboardStats: 필터기간 ${weekStart}~${weekEnd} (${rangeDays}일), 이전기간 ${prevWeekStart}~${prevWeekEnd}`);
    } else {
      // 데이터가 있는 최근 날짜 찾기 (fallback)
      try {
        const [checkRows] = await bigquery.query({
          query: `SELECT COUNT(*) as cnt FROM ${EVAL_TABLE} WHERE evaluation_date = @checkDate`,
          params: { checkDate: queryDate },
          location: GCP_LOCATION,
        });
        if (!(checkRows.length > 0 && checkRows[0].cnt > 0)) {
          const [recentRows] = await bigquery.query({
            query: `SELECT FORMAT_DATE('%Y-%m-%d', evaluation_date) as date_str FROM ${EVAL_TABLE} WHERE evaluation_date <= @checkDate ORDER BY evaluation_date DESC LIMIT 1`,
            params: { checkDate: queryDate },
            location: GCP_LOCATION,
          });
          if (recentRows.length > 0 && recentRows[0].date_str) {
            queryDate = recentRows[0].date_str;
          }
        }
      } catch (checkError) {
        console.warn(`[BigQuery] 날짜 확인 중 오류:`, checkError);
      }

      // 이번주 목~수 범위 계산 (목요일 시작, 수요일 종료)
      const qd = new Date(queryDate + 'T00:00:00Z');
      const dayOfWeek = qd.getUTCDay(); // 0=일, 1=월, ..., 4=목, 6=토
      const daysBackToThursday = (dayOfWeek - 4 + 7) % 7;
      const thursday = new Date(qd);
      thursday.setUTCDate(thursday.getUTCDate() - daysBackToThursday);
      const wednesday = new Date(thursday);
      wednesday.setUTCDate(thursday.getUTCDate() + 6);
      weekStart = fmtDate(thursday);
      // weekEnd는 수요일 또는 queryDate 중 이른 날짜 (아직 수요일이 안 된 경우)
      weekEnd = fmtDate(wednesday) <= queryDate ? fmtDate(wednesday) : queryDate;

      // 전주 목~수 범위 계산
      const prevThursday = new Date(thursday);
      prevThursday.setUTCDate(prevThursday.getUTCDate() - 7);
      const prevWednesday = new Date(prevThursday);
      prevWednesday.setUTCDate(prevThursday.getUTCDate() + 6);
      prevWeekStart = fmtDate(prevThursday);
      prevWeekEnd = fmtDate(prevWednesday);

      console.log(`[BigQuery] getDashboardStats: 이번주(목~수) ${weekStart}~${weekEnd}, 전주 ${prevWeekStart}~${prevWeekEnd}`);
    }

    const dateFilter = 'WHERE evaluation_date BETWEEN @weekStart AND @weekEnd';
    const params: any = { weekStart, weekEnd };

    const query = `
      WITH daily_stats AS (
        SELECT
          center,
          COUNT(*) as evaluation_count,
          COUNT(DISTINCT agent_id) as agent_count,
          SUM(COALESCE(attitude_error_count, 0)) as total_attitude_errors,
          SUM(COALESCE(business_error_count, 0)) as total_ops_errors
        FROM ${EVAL_TABLE}
        ${dateFilter}
        GROUP BY center
      ),
      watchlist_counts AS (
        SELECT
          center,
          COUNT(DISTINCT agent_id) as watchlist_count
        FROM ${EVAL_TABLE}
        ${dateFilter}
        AND (
          (attitude_error_count / 5.0 * 100) > 5
          OR (business_error_count / 11.0 * 100) > 6
        )
        GROUP BY center
      ),
      aggregated_stats AS (
        SELECT
          COALESCE(SUM(CASE WHEN ds.center = '용산' THEN ds.agent_count ELSE 0 END), 0) as totalAgentsYongsan,
          COALESCE(SUM(CASE WHEN ds.center = '광주' THEN ds.agent_count ELSE 0 END), 0) as totalAgentsGwangju,
          COALESCE(SUM(ds.evaluation_count), 0) as totalEvaluations,
          COALESCE(SUM(CASE WHEN wc.center = '용산' THEN wc.watchlist_count ELSE 0 END), 0) as watchlistYongsan,
          COALESCE(SUM(CASE WHEN wc.center = '광주' THEN wc.watchlist_count ELSE 0 END), 0) as watchlistGwangju,
          COALESCE(SUM(ds.total_attitude_errors), 0) as total_attitude_errors,
          COALESCE(SUM(ds.total_ops_errors), 0) as total_ops_errors,
          COALESCE(SUM(ds.evaluation_count), 0) as total_evaluation_count,
          -- 센터별 오류율
          COALESCE(SUM(CASE WHEN ds.center = '용산' THEN ds.total_attitude_errors ELSE 0 END), 0) as yongsan_attitude_errors,
          COALESCE(SUM(CASE WHEN ds.center = '용산' THEN ds.total_ops_errors ELSE 0 END), 0) as yongsan_ops_errors,
          COALESCE(SUM(CASE WHEN ds.center = '용산' THEN ds.evaluation_count ELSE 0 END), 0) as yongsan_eval_count,
          COALESCE(SUM(CASE WHEN ds.center = '광주' THEN ds.total_attitude_errors ELSE 0 END), 0) as gwangju_attitude_errors,
          COALESCE(SUM(CASE WHEN ds.center = '광주' THEN ds.total_ops_errors ELSE 0 END), 0) as gwangju_ops_errors,
          COALESCE(SUM(CASE WHEN ds.center = '광주' THEN ds.evaluation_count ELSE 0 END), 0) as gwangju_eval_count
        FROM daily_stats ds
        LEFT JOIN watchlist_counts wc ON ds.center = wc.center
      )
      SELECT
        totalAgentsYongsan,
        totalAgentsGwangju,
        totalEvaluations,
        watchlistYongsan,
        watchlistGwangju,
        CASE
          WHEN total_evaluation_count > 0
          THEN ROUND(SAFE_DIVIDE(total_attitude_errors, total_evaluation_count * 5) * 100, 2)
          ELSE 0
        END as attitudeErrorRate,
        CASE
          WHEN total_evaluation_count > 0
          THEN ROUND(SAFE_DIVIDE(total_ops_errors, total_evaluation_count * 11) * 100, 2)
          ELSE 0
        END as businessErrorRate,
        -- 센터별 오류율
        CASE WHEN yongsan_eval_count > 0 THEN ROUND(SAFE_DIVIDE(yongsan_attitude_errors, yongsan_eval_count * 5) * 100, 2) ELSE 0 END as yongsanAttitudeErrorRate,
        CASE WHEN yongsan_eval_count > 0 THEN ROUND(SAFE_DIVIDE(yongsan_ops_errors, yongsan_eval_count * 11) * 100, 2) ELSE 0 END as yongsanBusinessErrorRate,
        CASE WHEN gwangju_eval_count > 0 THEN ROUND(SAFE_DIVIDE(gwangju_attitude_errors, gwangju_eval_count * 5) * 100, 2) ELSE 0 END as gwangjuAttitudeErrorRate,
        CASE WHEN gwangju_eval_count > 0 THEN ROUND(SAFE_DIVIDE(gwangju_ops_errors, gwangju_eval_count * 11) * 100, 2) ELSE 0 END as gwangjuBusinessErrorRate
      FROM aggregated_stats
    `;
    
    console.log(`[BigQuery] Query:`, query);
    console.log(`[BigQuery] Params:`, params);
    
    const options = {
      query,
      params,
      location: GCP_LOCATION,
    };
    
    const [rows] = await bigquery.query(options);
    
    console.log(`[BigQuery] Query result rows:`, rows.length);
    console.log(`[BigQuery] Query date:`, queryDate);
    
    // 기본 데이터 구조 생성 함수
    const createDefaultStats = (): DashboardStats => ({
      totalAgentsYongsan: 0,
      totalAgentsGwangju: 0,
      totalEvaluations: 0,
      watchlistYongsan: 0,
      watchlistGwangju: 0,
      attitudeErrorRate: 0,
      businessErrorRate: 0,
      overallErrorRate: 0,
      date: queryDate,
      weekStart, weekEnd, prevWeekStart, prevWeekEnd,
      attitudeTrend: 0,
      businessTrend: 0,
      overallTrend: 0,
      yongsanAttitudeErrorRate: 0,
      yongsanBusinessErrorRate: 0,
      yongsanOverallErrorRate: 0,
      gwangjuAttitudeErrorRate: 0,
      gwangjuBusinessErrorRate: 0,
      gwangjuOverallErrorRate: 0,
      yongsanOverallTrend: 0,
      gwangjuOverallTrend: 0,
    });

    if (!rows || rows.length === 0 || !rows[0]) {
      console.warn(`[BigQuery] No data for week ${weekStart}~${weekEnd}`);
      return { success: true, data: createDefaultStats() };
    }

    const row = rows[0];

    // 이번주 누적 값 추출
    const totalAgentsYongsan = Number(row.totalAgentsYongsan) || 0;
    const totalAgentsGwangju = Number(row.totalAgentsGwangju) || 0;
    const totalEvaluations = Number(row.totalEvaluations) || 0;
    const watchlistYongsan = Number(row.watchlistYongsan) || 0;
    const watchlistGwangju = Number(row.watchlistGwangju) || 0;
    const attitudeErrorRate = Number(row.attitudeErrorRate) || 0;
    const businessErrorRate = Number(row.businessErrorRate) || 0;
    const yongsanAttitudeErrorRate = Number(row.yongsanAttitudeErrorRate) || 0;
    const yongsanBusinessErrorRate = Number(row.yongsanBusinessErrorRate) || 0;
    const gwangjuAttitudeErrorRate = Number(row.gwangjuAttitudeErrorRate) || 0;
    const gwangjuBusinessErrorRate = Number(row.gwangjuBusinessErrorRate) || 0;
    const overallErrorRate = Number((attitudeErrorRate + businessErrorRate).toFixed(2));

    // 전주 누적 오류율 조회 (트렌드 계산용)
    let prevAttitudeErrorRate = 0;
    let prevBusinessErrorRate = 0;
    let prevYongsanOverallRate = 0;
    let prevGwangjuOverallRate = 0;
    try {
      const prevQuery = `
        WITH prev_stats AS (
          SELECT
            center,
            SUM(COALESCE(attitude_error_count, 0)) as att_errors,
            SUM(COALESCE(business_error_count, 0)) as biz_errors,
            COUNT(*) as eval_count
          FROM ${EVAL_TABLE}
          WHERE evaluation_date BETWEEN @prevWeekStart AND @prevWeekEnd
          GROUP BY center
        ),
        prev_total AS (
          SELECT
            SUM(att_errors) as att_errors,
            SUM(biz_errors) as biz_errors,
            SUM(eval_count) as eval_count,
            -- 센터별
            SUM(CASE WHEN center = '용산' THEN att_errors ELSE 0 END) as yongsan_att,
            SUM(CASE WHEN center = '용산' THEN biz_errors ELSE 0 END) as yongsan_biz,
            SUM(CASE WHEN center = '용산' THEN eval_count ELSE 0 END) as yongsan_cnt,
            SUM(CASE WHEN center = '광주' THEN att_errors ELSE 0 END) as gwangju_att,
            SUM(CASE WHEN center = '광주' THEN biz_errors ELSE 0 END) as gwangju_biz,
            SUM(CASE WHEN center = '광주' THEN eval_count ELSE 0 END) as gwangju_cnt
          FROM prev_stats
        )
        SELECT
          CASE WHEN eval_count > 0 THEN ROUND(SAFE_DIVIDE(att_errors, eval_count * 5) * 100, 2) ELSE 0 END as prevAttitudeErrorRate,
          CASE WHEN eval_count > 0 THEN ROUND(SAFE_DIVIDE(biz_errors, eval_count * 11) * 100, 2) ELSE 0 END as prevBusinessErrorRate,
          ROUND(
            CASE WHEN yongsan_cnt > 0 THEN SAFE_DIVIDE(yongsan_att, yongsan_cnt * 5) * 100 ELSE 0 END +
            CASE WHEN yongsan_cnt > 0 THEN SAFE_DIVIDE(yongsan_biz, yongsan_cnt * 11) * 100 ELSE 0 END
          , 2) as prevYongsanOverallRate,
          ROUND(
            CASE WHEN gwangju_cnt > 0 THEN SAFE_DIVIDE(gwangju_att, gwangju_cnt * 5) * 100 ELSE 0 END +
            CASE WHEN gwangju_cnt > 0 THEN SAFE_DIVIDE(gwangju_biz, gwangju_cnt * 11) * 100 ELSE 0 END
          , 2) as prevGwangjuOverallRate
        FROM prev_total
      `;
      const [prevRows] = await bigquery.query({
        query: prevQuery,
        params: { prevWeekStart, prevWeekEnd },
        location: GCP_LOCATION,
      });
      if (prevRows.length > 0) {
        prevAttitudeErrorRate = Number(prevRows[0].prevAttitudeErrorRate) || 0;
        prevBusinessErrorRate = Number(prevRows[0].prevBusinessErrorRate) || 0;
        prevYongsanOverallRate = Number(prevRows[0].prevYongsanOverallRate) || 0;
        prevGwangjuOverallRate = Number(prevRows[0].prevGwangjuOverallRate) || 0;
        console.log(`[BigQuery] 전주(${prevWeekStart}~${prevWeekEnd}): 태도=${prevAttitudeErrorRate}%, 업무=${prevBusinessErrorRate}%, 용산전체=${prevYongsanOverallRate}%, 광주전체=${prevGwangjuOverallRate}%`);
      }
    } catch (prevError) {
      console.warn('[BigQuery] 전주 데이터 조회 실패:', prevError);
    }

    const prevOverallErrorRate = Number((prevAttitudeErrorRate + prevBusinessErrorRate).toFixed(2));

    const result: { success: boolean; data: DashboardStats } = {
      success: true,
      data: {
        totalAgentsYongsan,
        totalAgentsGwangju,
        totalEvaluations,
        watchlistYongsan,
        watchlistGwangju,
        attitudeErrorRate,
        businessErrorRate,
        overallErrorRate,
        date: queryDate,
        weekStart, weekEnd, prevWeekStart, prevWeekEnd,
        // 전주 대비 트렌드
        attitudeTrend: Number((attitudeErrorRate - prevAttitudeErrorRate).toFixed(2)),
        businessTrend: Number((businessErrorRate - prevBusinessErrorRate).toFixed(2)),
        overallTrend: Number((overallErrorRate - prevOverallErrorRate).toFixed(2)),
        // 센터별 오류율 (이번주 누적)
        yongsanAttitudeErrorRate,
        yongsanBusinessErrorRate,
        yongsanOverallErrorRate: Number((yongsanAttitudeErrorRate + yongsanBusinessErrorRate).toFixed(2)),
        gwangjuAttitudeErrorRate,
        gwangjuBusinessErrorRate,
        gwangjuOverallErrorRate: Number((gwangjuAttitudeErrorRate + gwangjuBusinessErrorRate).toFixed(2)),
        // 센터별 전주 대비 트렌드
        yongsanOverallTrend: Number(((yongsanAttitudeErrorRate + yongsanBusinessErrorRate) - prevYongsanOverallRate).toFixed(2)),
        gwangjuOverallTrend: Number(((gwangjuAttitudeErrorRate + gwangjuBusinessErrorRate) - prevGwangjuOverallRate).toFixed(2)),
      },
    };

    console.log(`[BigQuery] Final result:`, JSON.stringify(result.data, null, 2));

    return result;
  } catch (error) {
    console.error('[BigQuery] getDashboardStats error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// 센터별 통계 조회
// ============================================

export interface CenterStats {
  name: string;
  evaluations: number;
  errorRate: number;
  attitudeErrorRate: number;
  businessErrorRate: number;
  services: Array<{
    name: string;
    agentCount: number;
    errorRate: number;
  }>;
}

export async function getCenterStats(startDate?: string, endDate?: string): Promise<{ success: boolean; data?: CenterStats[]; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    
    // 기본값: 이번 달
    if (!startDate || !endDate) {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    }
    
    const query = `
      WITH center_stats AS (
        SELECT
          center,
          COUNT(*) as evaluations,
          SUM(attitude_error_count) as attitude_errors,
          SUM(business_error_count) as ops_errors
        FROM ${EVAL_TABLE}
        WHERE evaluation_date BETWEEN @startDate AND @endDate
        GROUP BY center
      ),
      service_stats AS (
        SELECT
          center,
          service,
          channel,
          COUNT(DISTINCT agent_id) as agent_count,
          COUNT(*) as evaluations,
          SUM(attitude_error_count) as attitude_errors,
          SUM(business_error_count) as ops_errors
        FROM ${EVAL_TABLE}
        WHERE evaluation_date BETWEEN @startDate AND @endDate
        GROUP BY center, service, channel
      )
      SELECT
        cs.center,
        cs.evaluations,
        ROUND(SAFE_DIVIDE(cs.attitude_errors, cs.evaluations * 5) * 100, 2) as attitudeErrorRate,
        ROUND(SAFE_DIVIDE(cs.ops_errors, cs.evaluations * 11) * 100, 2) as businessErrorRate,
        ARRAY_AGG(
          STRUCT(
            ss.service as name,
            ss.channel as channel,
            ss.agent_count as agentCount,
            ss.evaluations as evaluations,
            ROUND(
              SAFE_DIVIDE(ss.attitude_errors, ss.evaluations * 5) * 100 +
              SAFE_DIVIDE(ss.ops_errors, ss.evaluations * 11) * 100
            , 2) as errorRate
          )
        ) as services
      FROM center_stats cs
      LEFT JOIN service_stats ss ON cs.center = ss.center
      GROUP BY cs.center, cs.evaluations, cs.attitude_errors, cs.ops_errors
    `;
    
    const options = {
      query,
      params: { startDate, endDate },
      location: GCP_LOCATION,
    };
    
    const [rows] = await bigquery.query(options);
    
    const result: CenterStats[] = rows.map((row: any) => {
      const centerName = row.center as string;
      const orderList = GROUP_ORDER[centerName as keyof typeof GROUP_ORDER] || [];

      // 1. 서비스명 정규화 + 채널 추출 + 그룹명 생성
      const rawGroups = (row.services || []).map((svc: any) => {
        const rawService = (svc.name || '').trim();
        const rawChannel = (svc.channel || '').trim();

        // combined service+channel 분리 (예: "택시 / 유선" → service=택시, channel=유선)
        const extractedChannel = SERVICE_CHANNEL_EXTRACT[rawService];
        const normalized = mapServiceName(rawService, centerName);
        const channel = extractedChannel || rawChannel;

        // 유효 채널만 그룹명에 포함 (게시판/보드, 팀장, 모니터링, unknown 등 제외)
        const isValidChannel = (VALID_CHANNELS as readonly string[]).includes(channel);
        // 심야: 채널 구분 없는 서비스
        const isNoChannelService = normalized === '심야';

        let groupName: string | null = null;
        if (!normalized) {
          groupName = null;
        } else if (isNoChannelService) {
          groupName = normalized;
        } else if (isValidChannel) {
          groupName = `${normalized}/${channel}`;
        } else {
          groupName = null; // 유효하지 않은 채널 → 센터비교에서 제외
        }

        return {
          name: groupName,
          agentCount: Number(svc.agentCount) || 0,
          evaluations: Number(svc.evaluations) || 0,
          errorRate: Number(svc.errorRate) || 0,
        };
      });

      // 2. null 제거 + 용산 대리 필터링
      const validGroups = rawGroups.filter((g: any) =>
        g.name !== null &&
        !(centerName === '용산' && g.name?.startsWith('대리'))
      );

      // 3. 같은 그룹명 합산 (agentCount 합산, errorRate 가중평균)
      const mergedMap = new Map<string, { agentCount: number; evaluations: number; errorRate: number }>();
      for (const g of validGroups) {
        const existing = mergedMap.get(g.name);
        if (existing) {
          const totalEval = existing.evaluations + g.evaluations;
          existing.errorRate = totalEval > 0
            ? Number(((existing.errorRate * existing.evaluations + g.errorRate * g.evaluations) / totalEval).toFixed(2))
            : 0;
          existing.agentCount += g.agentCount;
          existing.evaluations = totalEval;
        } else {
          mergedMap.set(g.name, { agentCount: g.agentCount, evaluations: g.evaluations, errorRate: g.errorRate });
        }
      }

      // 4. groups 상수 기준 정렬 (센터별 고정 순서)
      const services = Array.from(mergedMap.entries())
        .sort(([a], [b]) => {
          const aIdx = orderList.indexOf(a);
          const bIdx = orderList.indexOf(b);
          return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
        })
        .map(([name, data]) => ({
          name,
          agentCount: data.agentCount,
          errorRate: data.errorRate,
        }));

      return {
        name: centerName,
        evaluations: Number(row.evaluations) || 0,
        attitudeErrorRate: Number(row.attitudeErrorRate) || 0,
        businessErrorRate: Number(row.businessErrorRate) || 0,
        errorRate: Number((Number(row.attitudeErrorRate) + Number(row.businessErrorRate)).toFixed(2)),
        services,
      };
    });
    
    return { success: true, data: result };
  } catch (error) {
    console.error('[BigQuery] getCenterStats error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// 일별 트렌드 데이터 조회
// ============================================

export interface TrendData {
  date: string;
  용산_태도: number;
  용산_오상담: number;
  용산_합계: number;
  광주_태도: number;
  광주_오상담: number;
  광주_합계: number;
  목표: number;
}

export async function getDailyTrend(days = 30, paramStartDate?: string, paramEndDate?: string): Promise<{ success: boolean; data?: TrendData[]; error?: string }> {
  try {
    const bigquery = getBigQueryClient();

    let startDateStr: string;
    let endDateStr: string;

    if (paramStartDate && paramEndDate) {
      startDateStr = paramStartDate;
      endDateStr = paramEndDate;
    } else {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDateStr = startDate.toISOString().split('T')[0];
      endDateStr = endDate.toISOString().split('T')[0];
    }

    const query = `
      SELECT
        evaluation_date as date,
        -- 용산 데이터
        SUM(CASE WHEN center = '용산' THEN attitude_error_count ELSE 0 END) as yongsan_attitude_errors,
        SUM(CASE WHEN center = '용산' THEN business_error_count ELSE 0 END) as yongsan_business_errors,
        SUM(CASE WHEN center = '용산' THEN 1 ELSE 0 END) as yongsan_count,
        -- 광주 데이터
        SUM(CASE WHEN center = '광주' THEN attitude_error_count ELSE 0 END) as gwangju_attitude_errors,
        SUM(CASE WHEN center = '광주' THEN business_error_count ELSE 0 END) as gwangju_business_errors,
        SUM(CASE WHEN center = '광주' THEN 1 ELSE 0 END) as gwangju_count
      FROM ${EVAL_TABLE}
      WHERE evaluation_date BETWEEN @startDate AND @endDate
      GROUP BY evaluation_date
      ORDER BY evaluation_date ASC
    `;

    const options = {
      query,
      params: { startDate: startDateStr, endDate: endDateStr },
      location: GCP_LOCATION,
    };

    const [rows] = await bigquery.query(options);

    const result: TrendData[] = rows.map((row: any) => {
      const yongsanCount = Number(row.yongsan_count) || 0;
      const gwangjuCount = Number(row.gwangju_count) || 0;

      // 태도 오류율 = (태도오류건수 / (평가건수 * 5)) * 100
      const yongsanAttitude = yongsanCount > 0
        ? Number((Number(row.yongsan_attitude_errors) / (yongsanCount * 5) * 100).toFixed(2))
        : 0;
      const gwangjuAttitude = gwangjuCount > 0
        ? Number((Number(row.gwangju_attitude_errors) / (gwangjuCount * 5) * 100).toFixed(2))
        : 0;

      // 오상담/오처리 오류율 = (업무오류건수 / (평가건수 * 11)) * 100
      const yongsanBusiness = yongsanCount > 0
        ? Number((Number(row.yongsan_business_errors) / (yongsanCount * 11) * 100).toFixed(2))
        : 0;
      const gwangjuBusiness = gwangjuCount > 0
        ? Number((Number(row.gwangju_business_errors) / (gwangjuCount * 11) * 100).toFixed(2))
        : 0;

      // 날짜 포맷팅 (MM/DD)
      const dateValue = row.date.value || row.date;
      const dateObj = new Date(dateValue);
      const formattedDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;

      return {
        date: formattedDate,
        용산_태도: yongsanAttitude,
        용산_오상담: yongsanBusiness,
        용산_합계: Number((yongsanAttitude + yongsanBusiness).toFixed(2)),
        광주_태도: gwangjuAttitude,
        광주_오상담: gwangjuBusiness,
        광주_합계: Number((gwangjuAttitude + gwangjuBusiness).toFixed(2)),
        목표: 3.0,
      };
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('[BigQuery] getDailyTrend error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// 주차별 오류율 트렌드 (최근 N주)
// ============================================

export async function getWeeklyTrend(weeks = 6): Promise<{ success: boolean; data?: TrendData[]; error?: string }> {
  try {
    const bigquery = getBigQueryClient();

    // 최근 N주 범위 계산 (목~수 기준)
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun, 4=Thu
    // 이번 주 목요일 구하기 (이미 지났거나 오늘이면 이번 주, 아직이면 지난 주)
    const daysFromThursday = (dayOfWeek - 4 + 7) % 7;
    const thisThursday = new Date(today);
    thisThursday.setDate(today.getDate() - daysFromThursday);

    // 시작일: weeks주 전 목요일
    const startDate = new Date(thisThursday);
    startDate.setDate(thisThursday.getDate() - (weeks - 1) * 7);

    // 종료일: 이번 주 수요일 (목+6)
    const endDate = new Date(thisThursday);
    endDate.setDate(thisThursday.getDate() + 6);
    // 미래면 오늘로 제한
    if (endDate > today) {
      endDate.setTime(today.getTime());
    }

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const query = `
      WITH weekly AS (
        SELECT
          -- 목~수 주차 계산: 목요일 기준으로 주 시작 (DAYOFWEEK: 1=Sun..7=Sat, Thu=5)
          DATE_SUB(evaluation_date, INTERVAL MOD(EXTRACT(DAYOFWEEK FROM evaluation_date) + 2, 7) DAY) as week_start,
          center,
          SUM(attitude_error_count) as attitude_errors,
          SUM(business_error_count) as business_errors,
          COUNT(*) as eval_count
        FROM ${EVAL_TABLE}
        WHERE evaluation_date BETWEEN @startDate AND @endDate
        GROUP BY week_start, center
      )
      SELECT
        week_start,
        -- 용산
        SUM(CASE WHEN center = '용산' THEN attitude_errors ELSE 0 END) as yongsan_attitude_errors,
        SUM(CASE WHEN center = '용산' THEN business_errors ELSE 0 END) as yongsan_business_errors,
        SUM(CASE WHEN center = '용산' THEN eval_count ELSE 0 END) as yongsan_count,
        -- 광주
        SUM(CASE WHEN center = '광주' THEN attitude_errors ELSE 0 END) as gwangju_attitude_errors,
        SUM(CASE WHEN center = '광주' THEN business_errors ELSE 0 END) as gwangju_business_errors,
        SUM(CASE WHEN center = '광주' THEN eval_count ELSE 0 END) as gwangju_count
      FROM weekly
      GROUP BY week_start
      ORDER BY week_start ASC
    `;

    const options = {
      query,
      params: { startDate: startDateStr, endDate: endDateStr },
      location: GCP_LOCATION,
    };

    const [rows] = await bigquery.query(options);

    const result: TrendData[] = rows.map((row: any) => {
      const yongsanCount = Number(row.yongsan_count) || 0;
      const gwangjuCount = Number(row.gwangju_count) || 0;

      const yongsanAttitude = yongsanCount > 0
        ? Number((Number(row.yongsan_attitude_errors) / (yongsanCount * 5) * 100).toFixed(2))
        : 0;
      const gwangjuAttitude = gwangjuCount > 0
        ? Number((Number(row.gwangju_attitude_errors) / (gwangjuCount * 5) * 100).toFixed(2))
        : 0;

      const yongsanBusiness = yongsanCount > 0
        ? Number((Number(row.yongsan_business_errors) / (yongsanCount * 11) * 100).toFixed(2))
        : 0;
      const gwangjuBusiness = gwangjuCount > 0
        ? Number((Number(row.gwangju_business_errors) / (gwangjuCount * 11) * 100).toFixed(2))
        : 0;

      // 주차 라벨: "M/D주" (목요일 날짜 기준)
      const dateValue = row.week_start.value || row.week_start;
      const dateObj = new Date(dateValue);
      const weekEndObj = new Date(dateObj);
      weekEndObj.setDate(dateObj.getDate() + 6);
      const label = `${dateObj.getMonth() + 1}/${dateObj.getDate()}~${weekEndObj.getMonth() + 1}/${weekEndObj.getDate()}`;

      return {
        date: label,
        용산_태도: yongsanAttitude,
        용산_오상담: yongsanBusiness,
        용산_합계: Number((yongsanAttitude + yongsanBusiness).toFixed(2)),
        광주_태도: gwangjuAttitude,
        광주_오상담: gwangjuBusiness,
        광주_합계: Number((gwangjuAttitude + gwangjuBusiness).toFixed(2)),
        목표: 3.0,
      };
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('[BigQuery] getWeeklyTrend error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// 상담사 목록 조회
// ============================================

export interface Agent {
  id: string;
  name: string;
  center: string;
  service: string;
  channel: string;
  tenureMonths: number;
  tenureGroup: string;
  isActive: boolean;
  totalEvaluations: number;
  attitudeErrorRate: number;
  opsErrorRate: number;
  overallErrorRate: number;
}

export async function getAgents(filters?: {
  center?: string;
  service?: string;
  channel?: string;
  tenure?: string;
  month?: string;
  date?: string;
}): Promise<{ success: boolean; data?: Agent[]; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    
    const params: any = {};

    // date 파라미터가 있으면 특정 날짜로 필터링, 없으면 month 사용
    let evalWhereClause = '';
    if (filters?.date) {
      evalWhereClause = 'WHERE e.evaluation_date = @date';
      params.date = filters.date;
    } else {
      // 기본값: 이번 달
      const month = filters?.month || new Date().toISOString().slice(0, 7);
      evalWhereClause = "WHERE FORMAT_DATE('%Y-%m', e.evaluation_date) = @month";
      params.month = month;
    }

    if (filters?.center && filters.center !== 'all') {
      evalWhereClause += ' AND e.center = @center';
      params.center = filters.center;
    }
    if (filters?.service && filters.service !== 'all') {
      evalWhereClause = addServiceFilter(evalWhereClause, params, filters.service, 'e');
    }
    if (filters?.channel && filters.channel !== 'all') {
      evalWhereClause += ' AND e.channel = @channel';
      params.channel = filters.channel;
    }

    // HR 캐시에서 근속 정보 가져오기 (Google Sheets JOIN 제거 → 성능 개선)
    const hrMap = await getHrAgentsMap();

    const query = `
      SELECT
        e.agent_id as id,
        e.agent_name as name,
        e.center,
        e.service,
        e.channel,
        COUNT(*) as totalEvaluations,
        ROUND(SAFE_DIVIDE(SUM(e.attitude_error_count), COUNT(*) * 5) * 100, 2) as attitudeErrorRate,
        ROUND(SAFE_DIVIDE(SUM(e.business_error_count), COUNT(*) * 11) * 100, 2) as opsErrorRate,
        SUM(CAST(e.greeting_error AS INT64)) as greeting_errors,
        SUM(CAST(e.empathy_error AS INT64)) as empathy_errors,
        SUM(CAST(e.apology_error AS INT64)) as apology_errors,
        SUM(CAST(e.additional_inquiry_error AS INT64)) as additional_inquiry_errors,
        SUM(CAST(e.unkind_error AS INT64)) as unkind_errors,
        SUM(CAST(e.consult_type_error AS INT64)) as consult_type_errors,
        SUM(CAST(e.guide_error AS INT64)) as guide_errors,
        SUM(CAST(e.identity_check_error AS INT64)) as identity_check_errors,
        SUM(CAST(e.required_search_error AS INT64)) as required_search_errors,
        SUM(CAST(e.wrong_guide_error AS INT64)) as wrong_guide_errors,
        SUM(CAST(e.process_missing_error AS INT64)) as process_missing_errors,
        SUM(CAST(e.process_incomplete_error AS INT64)) as process_incomplete_errors,
        SUM(CAST(e.system_error AS INT64)) as system_errors,
        SUM(CAST(e.id_mapping_error AS INT64)) as id_mapping_errors,
        SUM(CAST(e.flag_keyword_error AS INT64)) as flag_keyword_errors,
        SUM(CAST(e.history_error AS INT64)) as history_errors
      FROM ${EVAL_TABLE} e
      ${evalWhereClause}
      GROUP BY e.agent_id, e.agent_name, e.center, e.service, e.channel
      ORDER BY attitudeErrorRate + opsErrorRate DESC
    `;

    const options = {
      query,
      params,
      location: GCP_LOCATION,
    };

    const [rows] = await bigquery.query(options);
    
    // 항목별 이름 매핑
    const errorItemMap: Record<string, string> = {
      greeting_errors: '첫인사/끝인사 누락',
      empathy_errors: '공감표현 누락',
      apology_errors: '사과표현 누락',
      additional_inquiry_errors: '추가문의 누락',
      unkind_errors: '불친절',
      consult_type_errors: '상담유형 오설정',
      guide_errors: '가이드 미준수',
      identity_check_errors: '본인확인 누락',
      required_search_errors: '필수탐색 누락',
      wrong_guide_errors: '오안내',
      process_missing_errors: '전산 처리 누락',
      process_incomplete_errors: '전산 처리 미흡/정정',
      system_errors: '전산 조작 미흡/오류',
      id_mapping_errors: '콜/픽/트립ID 매핑누락&오기재',
      flag_keyword_errors: '플래그/키워드 누락&오기재',
      history_errors: '상담이력 기재 미흡',
    };
    
    const allAgents: Agent[] = rows.map((row: any) => {
      const attRate = Number(row.attitudeErrorRate) || 0;
      const opsRate = Number(row.opsErrorRate) || 0;
      const totalEvals = Number(row.totalEvaluations) || 0;

      // HR 캐시에서 근속 정보 매핑
      const agentIdLower = String(row.id || '').trim().toLowerCase();
      const hireDate = hrMap.get(agentIdLower);
      const tenureMonths = hireDate ? calcTenureMonths(hireDate) : 0;
      const tenureGroup = hireDate ? calcTenureGroup(tenureMonths) : '';

      // 항목별 오류 개수 수집
      const errorCounts: Array<{ name: string; count: number; rate: number }> = [];

      Object.entries(errorItemMap).forEach(([key, name]) => {
        const count = Number(row[key]) || 0;
        if (count > 0) {
          const rate = totalEvals > 0 ? Number((count / totalEvals * 100).toFixed(2)) : 0;
          errorCounts.push({ name, count, rate });
        }
      });

      // 오류 개수 기준으로 정렬하여 상위 3개 선택
      const topErrors = errorCounts
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .map(e => ({
          name: e.name,
          count: e.count,
          rate: e.rate,
        }));

      return {
        id: row.id,
        name: row.name,
        center: row.center,
        service: mapServiceName(row.service, row.center),
        channel: row.channel,
        tenureMonths,
        tenureGroup,
        isActive: true,
        totalEvaluations: totalEvals,
        attitudeErrorRate: attRate,
        opsErrorRate: opsRate,
        overallErrorRate: Number((attRate + opsRate).toFixed(2)),
        topErrors: topErrors.length > 0 ? topErrors : undefined,
      };
    });

    // tenure 필터는 JS에서 적용 (CTE JOIN 제거로 HAVING절 사용 불가)
    const result = filters?.tenure && filters.tenure !== 'all'
      ? allAgents.filter(a => a.tenureGroup === filters.tenure)
      : allAgents;

    return { success: true, data: result };
  } catch (error) {
    console.error('[BigQuery] getAgents error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// 평가 데이터 조회
// ============================================

export async function getEvaluations(startDate?: string, endDate?: string, limit = 10000): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    
    // 기본값: 최근 30일
    if (!startDate || !endDate) {
      const now = new Date();
      endDate = now.toISOString().split('T')[0];
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      startDate = start.toISOString().split('T')[0];
    }
    
    const query = `
      SELECT *
      FROM ${EVAL_TABLE}
      WHERE evaluation_date BETWEEN @startDate AND @endDate
      ORDER BY evaluation_date DESC, agent_id
      LIMIT @limit
    `;
    
    const options = {
      query,
      params: { startDate, endDate, limit },
      location: GCP_LOCATION,
    };
    
    const [rows] = await bigquery.query(options);
    
    return { success: true, data: rows };
  } catch (error) {
    console.error('[BigQuery] getEvaluations error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// 집중관리 대상 조회
// ============================================

export interface WatchListItem {
  agentId: string;
  agentName: string;
  center: string;
  service: string;
  channel: string;
  attitudeRate: number;
  opsRate: number;
  totalRate: number;
  trend: number;
  evaluationCount: number;
  reason: string;
  topErrors: string[];
  registeredAt?: string;
}

export async function getWatchList(filters?: {
  center?: string;
  channel?: string;
  tenure?: string;
  month?: string;
}): Promise<{ success: boolean; data?: WatchListItem[]; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    
    const month = filters?.month || new Date().toISOString().slice(0, 7);
    
    let whereClause = 'WHERE 1=1';
    const params: any = { month };
    
    // 전월 계산
    const prevMonth = new Date(month + '-01')
    prevMonth.setMonth(prevMonth.getMonth() - 1)
    const prevMonthStr = prevMonth.toISOString().slice(0, 7)
    params.prevMonth = prevMonthStr
    
    if (filters?.center && filters.center !== 'all') {
      whereClause += ' AND center = @center';
      params.center = filters.center;
    }
    if (filters?.channel && filters.channel !== 'all') {
      whereClause += ' AND channel = @channel';
      params.channel = filters.channel;
    }
    // tenure 필터는 평가 테이블에 없으므로 주석 처리
    // if (filters?.tenure && filters.tenure !== 'all') {
    //   whereClause += ' AND tenure_group = @tenure';
    //   params.tenure = filters.tenure;
    // }
    
    const query = `
      WITH current_month_errors AS (
        SELECT
          agent_id,
          agent_name,
          center,
          service,
          channel,
          COUNT(*) as evaluation_count,
          MIN(evaluation_date) as first_eval_date,
          SUM(attitude_error_count) as attitude_errors,
          SUM(business_error_count) as ops_errors,
          ROUND(SAFE_DIVIDE(SUM(attitude_error_count), COUNT(*) * 5) * 100, 2) as attitude_rate,
          ROUND(SAFE_DIVIDE(SUM(business_error_count), COUNT(*) * 11) * 100, 2) as ops_rate,
          SUM(CAST(greeting_error AS INT64)) as greeting_errors,
          SUM(CAST(empathy_error AS INT64)) as empathy_errors,
          SUM(CAST(apology_error AS INT64)) as apology_errors,
          SUM(CAST(additional_inquiry_error AS INT64)) as additional_inquiry_errors,
          SUM(CAST(unkind_error AS INT64)) as unkind_errors,
          SUM(CAST(consult_type_error AS INT64)) as consult_type_errors,
          SUM(CAST(guide_error AS INT64)) as guide_errors,
          SUM(CAST(identity_check_error AS INT64)) as identity_check_errors,
          SUM(CAST(required_search_error AS INT64)) as required_search_errors,
          SUM(CAST(wrong_guide_error AS INT64)) as wrong_guide_errors,
          SUM(CAST(process_missing_error AS INT64)) as process_missing_errors,
          SUM(CAST(process_incomplete_error AS INT64)) as process_incomplete_errors,
          SUM(CAST(system_error AS INT64)) as system_errors,
          SUM(CAST(id_mapping_error AS INT64)) as id_mapping_errors,
          SUM(CAST(flag_keyword_error AS INT64)) as flag_keyword_errors,
          SUM(CAST(history_error AS INT64)) as history_errors
        FROM ${EVAL_TABLE}
        WHERE FORMAT_DATE('%Y-%m', evaluation_date) = @month
          ${filters?.center && filters.center !== 'all' ? 'AND center = @center' : ''}
          ${filters?.channel && filters.channel !== 'all' ? 'AND channel = @channel' : ''}
        GROUP BY agent_id, agent_name, center, service, channel
      ),
      previous_month_errors AS (
        SELECT
          agent_id,
          agent_name,
          center,
          service,
          channel,
          ROUND(SAFE_DIVIDE(SUM(attitude_error_count), COUNT(*) * 5) * 100, 2) as prev_attitude_rate,
          ROUND(SAFE_DIVIDE(SUM(business_error_count), COUNT(*) * 11) * 100, 2) as prev_ops_rate
        FROM ${EVAL_TABLE}
        WHERE FORMAT_DATE('%Y-%m', evaluation_date) = @prevMonth
          ${filters?.center && filters.center !== 'all' ? 'AND center = @center' : ''}
          ${filters?.channel && filters.channel !== 'all' ? 'AND channel = @channel' : ''}
        GROUP BY agent_id, agent_name, center, service, channel
      )
      SELECT
        c.agent_id,
        c.agent_name,
        c.center,
        c.service,
        c.channel,
        c.evaluation_count,
        c.first_eval_date,
        c.attitude_errors,
        c.ops_errors,
        c.attitude_rate,
        c.ops_rate,
        c.greeting_errors,
        c.empathy_errors,
        c.apology_errors,
        c.additional_inquiry_errors,
        c.unkind_errors,
        c.consult_type_errors,
        c.guide_errors,
        c.identity_check_errors,
        c.required_search_errors,
        c.wrong_guide_errors,
        c.process_missing_errors,
        c.process_incomplete_errors,
        c.system_errors,
        c.id_mapping_errors,
        c.flag_keyword_errors,
        c.history_errors,
        COALESCE(p.prev_attitude_rate, 0) as prev_attitude_rate,
        COALESCE(p.prev_ops_rate, 0) as prev_ops_rate
      FROM current_month_errors c
      LEFT JOIN previous_month_errors p 
        ON c.agent_id = p.agent_id 
        AND c.center = p.center 
        AND c.service = p.service 
        AND c.channel = p.channel
      WHERE c.attitude_rate > 5 OR c.ops_rate > 6
      ORDER BY (c.attitude_rate + c.ops_rate) DESC
    `;
    
    const options = {
      query,
      params,
      location: GCP_LOCATION,
    };
    
    const [rows] = await bigquery.query(options);
    
    const result: WatchListItem[] = rows.map((row: any) => {
      const attRate = Number(row.attitude_rate) || 0;
      const opsRate = Number(row.ops_rate) || 0;
      const prevAttRate = Number(row.prev_attitude_rate) || 0;
      const prevOpsRate = Number(row.prev_ops_rate) || 0;
      
      // 전일대비 증감율 계산 (전월 대비)
      const totalRate = Number((attRate + opsRate).toFixed(2));
      const prevTotalRate = Number((prevAttRate + prevOpsRate).toFixed(2));
      const trend = Number((totalRate - prevTotalRate).toFixed(2));
      
      // 주요 오류 항목 (모든 오류 항목 포함)
      const errors = [
        { name: '첫인사/끝인사 누락', count: Number(row.greeting_errors) || 0 },
        { name: '공감표현 누락', count: Number(row.empathy_errors) || 0 },
        { name: '사과표현 누락', count: Number(row.apology_errors) || 0 },
        { name: '추가문의 누락', count: Number(row.additional_inquiry_errors) || 0 },
        { name: '불친절', count: Number(row.unkind_errors) || 0 },
        { name: '상담유형 오설정', count: Number(row.consult_type_errors) || 0 },
        { name: '가이드 미준수', count: Number(row.guide_errors) || 0 },
        { name: '본인확인 누락', count: Number(row.identity_check_errors) || 0 },
        { name: '필수탐색 누락', count: Number(row.required_search_errors) || 0 },
        { name: '오안내', count: Number(row.wrong_guide_errors) || 0 },
        { name: '전산 처리 누락', count: Number(row.process_missing_errors) || 0 },
        { name: '전산 처리 미완료', count: Number(row.process_incomplete_errors) || 0 },
        { name: '전산 조작 미흡', count: Number(row.system_errors) || 0 },
        { name: '콜픽트림ID 매핑 누락', count: Number(row.id_mapping_errors) || 0 },
        { name: '플래그키워드 누락', count: Number(row.flag_keyword_errors) || 0 },
        { name: '상담이력 기재 미흡', count: Number(row.history_errors) || 0 },
      ].filter(e => e.count > 0).sort((a, b) => b.count - a.count);
      
      const topErrors = errors.slice(0, 3).map(e => `${e.name}(${e.count})`);
      
      let reason = '';
      if (attRate > 10) {
        reason = '태도 오류율 10% 초과';
      } else if (opsRate > 10) {
        reason = '오상담 오류율 10% 초과';
      } else if (attRate > 5) {
        reason = '태도 오류율 5% 초과';
      } else {
        reason = '오상담 오류율 6% 초과';
      }
      
      return {
        agentId: row.agent_id,
        agentName: row.agent_name,
        center: row.center,
        service: mapServiceName(row.service, row.center),
        channel: row.channel,
        attitudeRate: attRate,
        opsRate: opsRate,
        totalRate: totalRate,
        trend: trend,
        evaluationCount: Number(row.evaluation_count) || 0,
        reason,
        topErrors,
        registeredAt: row.first_eval_date ? row.first_eval_date.value || String(row.first_eval_date) : undefined,
      };
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('[BigQuery] getWatchList error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// 목표 데이터 조회
// ============================================

export interface Goal {
  id: string;
  name: string;
  center: string | null;
  type: string;
  targetRate: number;
  attitudeTargetRate?: number | null;
  businessTargetRate?: number | null;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  isActive: boolean;
}

export async function getGoals(filters?: {
  center?: string;
  periodType?: string;
  isActive?: boolean;
  currentMonth?: boolean;
}): Promise<{ success: boolean; data?: Goal[]; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    
    let whereClause = 'WHERE 1=1';
    const params: any = {};
    
    if (filters?.center && filters.center !== 'all') {
      whereClause += ' AND (center = @center OR center IS NULL)';
      params.center = filters.center;
    }
    if (filters?.periodType) {
      whereClause += ' AND period_type = @periodType';
      params.periodType = filters.periodType;
    }
    if (filters?.isActive !== undefined) {
      whereClause += ' AND is_active = @isActive';
      params.isActive = filters.isActive;
    }
    
    const query = `
      SELECT
        target_id as id,
        CONCAT(COALESCE(center, '전체'), ' ', COALESCE(service, ''), ' ', period_type) as name,
        center,
        service,
        CASE
          WHEN IFNULL(target_attitude_error_rate, 0) > 0 AND IFNULL(target_business_error_rate, 0) > 0 THEN 'total'
          WHEN IFNULL(target_attitude_error_rate, 0) > 0 THEN 'attitude'
          WHEN IFNULL(target_business_error_rate, 0) > 0 THEN 'ops'
          ELSE 'total'
        END as type,
        target_attitude_error_rate as attitudeTargetRate,
        target_business_error_rate as businessTargetRate,
        COALESCE(target_overall_error_rate, target_attitude_error_rate, target_business_error_rate, 0) as targetRate,
        period_type as periodType,
        start_date as periodStart,
        end_date as periodEnd,
        is_active as isActive
      FROM ${TARGETS_TABLE}
      ${whereClause}
      ORDER BY start_date DESC, center
    `;
    
    const options = {
      query,
      params,
      location: GCP_LOCATION,
    };
    
    const [rows] = await bigquery.query(options);
    
    const result: Goal[] = rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      center: row.center,
      type: row.type,
      targetRate: Number(row.targetRate) || 0,
      attitudeTargetRate: row.attitudeTargetRate != null ? Number(row.attitudeTargetRate) : null,
      businessTargetRate: row.businessTargetRate != null ? Number(row.businessTargetRate) : null,
      periodType: row.periodType,
      periodStart: row.periodStart.value || row.periodStart,
      periodEnd: row.periodEnd.value || row.periodEnd,
      isActive: Boolean(row.isActive),
    }));
    
    return { success: true, data: result };
  } catch (error) {
    console.error('[BigQuery] getGoals error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// 데이터 저장 (동기화)
// ============================================

export async function saveEvaluationsToBigQuery(evaluations: any[]): Promise<{ success: boolean; saved?: number; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    const dataset = bigquery.dataset(DATASET_ID);
    const table = dataset.table('evaluations');
    
    // BigQuery insert 형식으로 변환
    const rows = evaluations.map(evalData => {
      // evaluation_id 생성: consult_id가 있으면 사용, 없으면 agentId_date 조합
      const evaluationId = evalData.consultId
        ? `${evalData.agentId}_${evalData.date}_${evalData.consultId}`
        : `${evalData.agentId}_${evalData.date}_${evalData.evaluationId || Date.now()}`;

      // Group construction (service + channel)
      const groupValue = `${evalData.service || ''} ${evalData.channel || ''}`.trim();

      return {
      evaluation_id: evaluationId,
      evaluation_date: evalData.date,
      center: evalData.center,
      service: evalData.service || '',
      channel: evalData.channel || 'unknown',
      group: groupValue || 'unknown',
      agent_id: evalData.agentId,
      agent_name: evalData.agentName,
      consultation_id: evalData.consultId || null,
      consultation_datetime: evalData.consultDate ? new Date(evalData.consultDate).toISOString() : null,
      greeting_error: evalData.greetingError || false,
      empathy_error: evalData.empathyError || false,
      apology_error: evalData.apologyError || false,
      additional_inquiry_error: evalData.additionalInquiryError || false,
      unkind_error: evalData.unkindError || false,
      consult_type_error: evalData.consultTypeError || false,
      guide_error: evalData.guideError || false,
      identity_check_error: evalData.identityCheckError || false,
      required_search_error: evalData.requiredSearchError || false,
      wrong_guide_error: evalData.wrongGuideError || false,
      process_missing_error: evalData.processMissingError || false,
      process_incomplete_error: evalData.processIncompleteError || false,
      system_error: evalData.systemError || false,
      id_mapping_error: evalData.idMappingError || false,
      flag_keyword_error: evalData.flagKeywordError || false,
      history_error: evalData.historyError || false,
      attitude_error_count: evalData.attitudeErrors || 0,
      business_error_count: evalData.businessErrors || 0,
      total_error_count: (evalData.attitudeErrors || 0) + (evalData.businessErrors || 0),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      };
    });
    
    // 배치로 나누어 삽입 (BigQuery 제한: 10,000 rows per request)
    const BATCH_SIZE = 10000;
    let savedCount = 0;
    
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      await table.insert(batch);
      savedCount += batch.length;
    }
    
    console.log(`[BigQuery] Saved ${savedCount} evaluations`);
    
    return { success: true, saved: savedCount };
  } catch (error) {
    console.error('[BigQuery] saveEvaluationsToBigQuery error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// 일자별 오류 통계 조회
// ============================================

export interface DailyErrorData {
  date: string
  items: Array<{
    itemId: string
    itemName: string
    errorCount: number
  }>
}

export async function getDailyErrors(filters?: {
  startDate?: string
  endDate?: string
  center?: string
  service?: string
  channel?: string
}): Promise<{ success: boolean; data?: DailyErrorData[]; error?: string }> {
  try {
    const bigquery = getBigQueryClient()
    
    // 기본값: 최근 30일
    let startDate = filters?.startDate
    let endDate = filters?.endDate
    if (!startDate || !endDate) {
      const now = new Date()
      endDate = now.toISOString().split('T')[0]
      const start = new Date(now)
      start.setDate(start.getDate() - 30)
      startDate = start.toISOString().split('T')[0]
    }
    
    let whereClause = 'WHERE evaluation_date BETWEEN @startDate AND @endDate'
    const params: any = { startDate, endDate }
    
    if (filters?.center && filters.center !== 'all') {
      whereClause += ' AND center = @center'
      params.center = filters.center
    }
    if (filters?.service && filters.service !== 'all') {
      whereClause = addServiceFilter(whereClause, params, filters.service)
    }
    if (filters?.channel && filters.channel !== 'all') {
      whereClause += ' AND channel = @channel'
      params.channel = filters.channel
    }
    
    // 평가 항목별 일자별 오류 집계
    const query = `
      SELECT
        evaluation_date as date,
        'att1' as item_id,
        '첫인사/끝인사 누락' as item_name,
        SUM(CAST(greeting_error AS INT64)) as error_count
      FROM ${EVAL_TABLE}
      ${whereClause}
      GROUP BY evaluation_date
      
      UNION ALL
      
      SELECT
        evaluation_date as date,
        'att2' as item_id,
        '공감표현 누락' as item_name,
        SUM(CAST(empathy_error AS INT64)) as error_count
      FROM ${EVAL_TABLE}
      ${whereClause}
      GROUP BY evaluation_date
      
      UNION ALL
      
      SELECT
        evaluation_date as date,
        'att3' as item_id,
        '사과표현 누락' as item_name,
        SUM(CAST(apology_error AS INT64)) as error_count
      FROM ${EVAL_TABLE}
      ${whereClause}
      GROUP BY evaluation_date
      
      UNION ALL
      
      SELECT
        evaluation_date as date,
        'att4' as item_id,
        '추가문의 누락' as item_name,
        SUM(CAST(additional_inquiry_error AS INT64)) as error_count
      FROM ${EVAL_TABLE}
      ${whereClause}
      GROUP BY evaluation_date
      
      UNION ALL
      
      SELECT
        evaluation_date as date,
        'att5' as item_id,
        '불친절' as item_name,
        SUM(CAST(unkind_error AS INT64)) as error_count
      FROM ${EVAL_TABLE}
      ${whereClause}
      GROUP BY evaluation_date
      
      UNION ALL
      
      SELECT
        evaluation_date as date,
        'err1' as item_id,
        '상담유형 오설정' as item_name,
        SUM(CAST(consult_type_error AS INT64)) as error_count
      FROM ${EVAL_TABLE}
      ${whereClause}
      GROUP BY evaluation_date
      
      UNION ALL
      
      SELECT
        evaluation_date as date,
        'err2' as item_id,
        '가이드 미준수' as item_name,
        SUM(CAST(guide_error AS INT64)) as error_count
      FROM ${EVAL_TABLE}
      ${whereClause}
      GROUP BY evaluation_date
      
      UNION ALL
      
      SELECT
        evaluation_date as date,
        'err3' as item_id,
        '본인확인 누락' as item_name,
        SUM(CAST(identity_check_error AS INT64)) as error_count
      FROM ${EVAL_TABLE}
      ${whereClause}
      GROUP BY evaluation_date
      
      UNION ALL
      
      SELECT
        evaluation_date as date,
        'err4' as item_id,
        '필수탐색 누락' as item_name,
        SUM(CAST(required_search_error AS INT64)) as error_count
      FROM ${EVAL_TABLE}
      ${whereClause}
      GROUP BY evaluation_date
      
      UNION ALL
      
      SELECT
        evaluation_date as date,
        'err5' as item_id,
        '오안내' as item_name,
        SUM(CAST(wrong_guide_error AS INT64)) as error_count
      FROM ${EVAL_TABLE}
      ${whereClause}
      GROUP BY evaluation_date
      
      UNION ALL
      
      SELECT
        evaluation_date as date,
        'err6' as item_id,
        '전산 처리 누락' as item_name,
        SUM(CAST(process_missing_error AS INT64)) as error_count
      FROM ${EVAL_TABLE}
      ${whereClause}
      GROUP BY evaluation_date
      
      UNION ALL
      
      SELECT
        evaluation_date as date,
        'err7' as item_id,
        '전산 처리 미완료' as item_name,
        SUM(CAST(process_incomplete_error AS INT64)) as error_count
      FROM ${EVAL_TABLE}
      ${whereClause}
      GROUP BY evaluation_date
      
      UNION ALL
      
      SELECT
        evaluation_date as date,
        'err8' as item_id,
        '전산 조작 미흡' as item_name,
        SUM(CAST(system_error AS INT64)) as error_count
      FROM ${EVAL_TABLE}
      ${whereClause}
      GROUP BY evaluation_date
      
      UNION ALL
      
      SELECT
        evaluation_date as date,
        'err9' as item_id,
        '콜픽트림ID 매핑 누락' as item_name,
        SUM(CAST(id_mapping_error AS INT64)) as error_count
      FROM ${EVAL_TABLE}
      ${whereClause}
      GROUP BY evaluation_date
      
      UNION ALL
      
      SELECT
        evaluation_date as date,
        'err10' as item_id,
        '플래그키워드 누락' as item_name,
        SUM(CAST(flag_keyword_error AS INT64)) as error_count
      FROM ${EVAL_TABLE}
      ${whereClause}
      GROUP BY evaluation_date
      
      UNION ALL
      
      SELECT
        evaluation_date as date,
        'err11' as item_id,
        '상담이력 기재 미흡' as item_name,
        SUM(CAST(history_error AS INT64)) as error_count
      FROM ${EVAL_TABLE}
      ${whereClause}
      GROUP BY evaluation_date
      
      ORDER BY date DESC, item_id
    `
    
    const options = {
      query,
      params,
      location: GCP_LOCATION,
    }
    
    const [rows] = await bigquery.query(options)
    
    // 날짜별로 그룹화
    const dateMap = new Map<string, DailyErrorData>()
    
    rows.forEach((row: any) => {
      const date = row.date.value || row.date
      if (!dateMap.has(date)) {
        dateMap.set(date, {
          date,
          items: [],
        })
      }
      dateMap.get(date)!.items.push({
        itemId: row.item_id,
        itemName: row.item_name,
        errorCount: Number(row.error_count) || 0,
      })
    })
    
    const result = Array.from(dateMap.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )
    
    return { success: true, data: result }
  } catch (error) {
    console.error('[BigQuery] getDailyErrors error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// ============================================
// 주차별 오류 통계 조회
// ============================================

export interface WeeklyErrorData {
  week: string
  weekLabel: string
  dateRange?: string
  items: Array<{
    itemId: string
    itemName: string
    errorCount: number
    errorRate: number
  }>
}

export async function getWeeklyErrors(filters?: {
  startDate?: string
  endDate?: string
  center?: string
  service?: string
  channel?: string
}): Promise<{ success: boolean; data?: WeeklyErrorData[]; error?: string }> {
  try {
    const bigquery = getBigQueryClient()
    
    // 기본값: 최근 6주
    let startDate = filters?.startDate
    let endDate = filters?.endDate
    if (!startDate || !endDate) {
      const now = new Date()
      endDate = now.toISOString().split('T')[0]
      const start = new Date(now)
      start.setDate(start.getDate() - 42) // 6주
      startDate = start.toISOString().split('T')[0]
    }
    
    let whereClause = 'WHERE evaluation_date BETWEEN @startDate AND @endDate'
    const params: any = { startDate, endDate }
    
    if (filters?.center && filters.center !== 'all') {
      whereClause += ' AND center = @center'
      params.center = filters.center
    }
    if (filters?.service && filters.service !== 'all') {
      whereClause = addServiceFilter(whereClause, params, filters.service)
    }
    if (filters?.channel && filters.channel !== 'all') {
      whereClause += ' AND channel = @channel'
      params.channel = filters.channel
    }
    
    // 주차별 집계 (ISO 주 사용)
    const query = `
      WITH weekly_data AS (
        SELECT
          FORMAT_DATE('%Y-W%V', evaluation_date) as week,
          EXTRACT(YEAR FROM evaluation_date) as year,
          EXTRACT(WEEK FROM evaluation_date) as week_num,
          'att1' as item_id,
          '첫인사/끝인사 누락' as item_name,
          SUM(CAST(greeting_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM ${EVAL_TABLE}
        ${whereClause}
        GROUP BY week, year, week_num
        
        UNION ALL
        
        SELECT
          FORMAT_DATE('%Y-W%V', evaluation_date) as week,
          EXTRACT(YEAR FROM evaluation_date) as year,
          EXTRACT(WEEK FROM evaluation_date) as week_num,
          'att2' as item_id,
          '공감표현 누락' as item_name,
          SUM(CAST(empathy_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM ${EVAL_TABLE}
        ${whereClause}
        GROUP BY week, year, week_num
        
        UNION ALL
        
        SELECT
          FORMAT_DATE('%Y-W%V', evaluation_date) as week,
          EXTRACT(YEAR FROM evaluation_date) as year,
          EXTRACT(WEEK FROM evaluation_date) as week_num,
          'att3' as item_id,
          '사과표현 누락' as item_name,
          SUM(CAST(apology_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM ${EVAL_TABLE}
        ${whereClause}
        GROUP BY week, year, week_num
        
        UNION ALL
        
        SELECT
          FORMAT_DATE('%Y-W%V', evaluation_date) as week,
          EXTRACT(YEAR FROM evaluation_date) as year,
          EXTRACT(WEEK FROM evaluation_date) as week_num,
          'att4' as item_id,
          '추가문의 누락' as item_name,
          SUM(CAST(additional_inquiry_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM ${EVAL_TABLE}
        ${whereClause}
        GROUP BY week, year, week_num
        
        UNION ALL
        
        SELECT
          FORMAT_DATE('%Y-W%V', evaluation_date) as week,
          EXTRACT(YEAR FROM evaluation_date) as year,
          EXTRACT(WEEK FROM evaluation_date) as week_num,
          'att5' as item_id,
          '불친절' as item_name,
          SUM(CAST(unkind_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM ${EVAL_TABLE}
        ${whereClause}
        GROUP BY week, year, week_num
        
        UNION ALL
        
        SELECT
          FORMAT_DATE('%Y-W%V', evaluation_date) as week,
          EXTRACT(YEAR FROM evaluation_date) as year,
          EXTRACT(WEEK FROM evaluation_date) as week_num,
          'err1' as item_id,
          '상담유형 오설정' as item_name,
          SUM(CAST(consult_type_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM ${EVAL_TABLE}
        ${whereClause}
        GROUP BY week, year, week_num
        
        UNION ALL
        
        SELECT
          FORMAT_DATE('%Y-W%V', evaluation_date) as week,
          EXTRACT(YEAR FROM evaluation_date) as year,
          EXTRACT(WEEK FROM evaluation_date) as week_num,
          'err2' as item_id,
          '가이드 미준수' as item_name,
          SUM(CAST(guide_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM ${EVAL_TABLE}
        ${whereClause}
        GROUP BY week, year, week_num
        
        UNION ALL
        
        SELECT
          FORMAT_DATE('%Y-W%V', evaluation_date) as week,
          EXTRACT(YEAR FROM evaluation_date) as year,
          EXTRACT(WEEK FROM evaluation_date) as week_num,
          'err3' as item_id,
          '본인확인 누락' as item_name,
          SUM(CAST(identity_check_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM ${EVAL_TABLE}
        ${whereClause}
        GROUP BY week, year, week_num
        
        UNION ALL
        
        SELECT
          FORMAT_DATE('%Y-W%V', evaluation_date) as week,
          EXTRACT(YEAR FROM evaluation_date) as year,
          EXTRACT(WEEK FROM evaluation_date) as week_num,
          'err4' as item_id,
          '필수탐색 누락' as item_name,
          SUM(CAST(required_search_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM ${EVAL_TABLE}
        ${whereClause}
        GROUP BY week, year, week_num
        
        UNION ALL
        
        SELECT
          FORMAT_DATE('%Y-W%V', evaluation_date) as week,
          EXTRACT(YEAR FROM evaluation_date) as year,
          EXTRACT(WEEK FROM evaluation_date) as week_num,
          'err5' as item_id,
          '오안내' as item_name,
          SUM(CAST(wrong_guide_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM ${EVAL_TABLE}
        ${whereClause}
        GROUP BY week, year, week_num
        
        UNION ALL
        
        SELECT
          FORMAT_DATE('%Y-W%V', evaluation_date) as week,
          EXTRACT(YEAR FROM evaluation_date) as year,
          EXTRACT(WEEK FROM evaluation_date) as week_num,
          'err6' as item_id,
          '전산 처리 누락' as item_name,
          SUM(CAST(process_missing_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM ${EVAL_TABLE}
        ${whereClause}
        GROUP BY week, year, week_num
        
        UNION ALL
        
        SELECT
          FORMAT_DATE('%Y-W%V', evaluation_date) as week,
          EXTRACT(YEAR FROM evaluation_date) as year,
          EXTRACT(WEEK FROM evaluation_date) as week_num,
          'err7' as item_id,
          '전산 처리 미완료' as item_name,
          SUM(CAST(process_incomplete_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM ${EVAL_TABLE}
        ${whereClause}
        GROUP BY week, year, week_num
        
        UNION ALL
        
        SELECT
          FORMAT_DATE('%Y-W%V', evaluation_date) as week,
          EXTRACT(YEAR FROM evaluation_date) as year,
          EXTRACT(WEEK FROM evaluation_date) as week_num,
          'err8' as item_id,
          '전산 조작 미흡' as item_name,
          SUM(CAST(system_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM ${EVAL_TABLE}
        ${whereClause}
        GROUP BY week, year, week_num
        
        UNION ALL
        
        SELECT
          FORMAT_DATE('%Y-W%V', evaluation_date) as week,
          EXTRACT(YEAR FROM evaluation_date) as year,
          EXTRACT(WEEK FROM evaluation_date) as week_num,
          'err9' as item_id,
          '콜픽트림ID 매핑 누락' as item_name,
          SUM(CAST(id_mapping_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM ${EVAL_TABLE}
        ${whereClause}
        GROUP BY week, year, week_num
        
        UNION ALL
        
        SELECT
          FORMAT_DATE('%Y-W%V', evaluation_date) as week,
          EXTRACT(YEAR FROM evaluation_date) as year,
          EXTRACT(WEEK FROM evaluation_date) as week_num,
          'err10' as item_id,
          '플래그키워드 누락' as item_name,
          SUM(CAST(flag_keyword_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM ${EVAL_TABLE}
        ${whereClause}
        GROUP BY week, year, week_num
        
        UNION ALL
        
        SELECT
          FORMAT_DATE('%Y-W%V', evaluation_date) as week,
          EXTRACT(YEAR FROM evaluation_date) as year,
          EXTRACT(WEEK FROM evaluation_date) as week_num,
          'err11' as item_id,
          '상담이력 기재 미흡' as item_name,
          SUM(CAST(history_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM ${EVAL_TABLE}
        ${whereClause}
        GROUP BY week, year, week_num
      )
      ,
      date_ranges AS (
        SELECT
          FORMAT_DATE('%Y-W%V', evaluation_date) as week,
          MIN(evaluation_date) as min_date,
          MAX(evaluation_date) as max_date
        FROM ${EVAL_TABLE}
        ${whereClause}
        GROUP BY FORMAT_DATE('%Y-W%V', evaluation_date)
      )
      SELECT
        w.week,
        w.year,
        w.week_num,
        w.item_id,
        w.item_name,
        w.error_count,
        ROUND(SAFE_DIVIDE(w.error_count, w.total_evaluations) * 100, 1) as error_rate,
        d.min_date,
        d.max_date
      FROM weekly_data w
      LEFT JOIN date_ranges d ON w.week = d.week
      ORDER BY w.year DESC, w.week_num DESC, w.item_id
    `
    
    const options = {
      query,
      params,
      location: GCP_LOCATION,
    }
    
    const [rows] = await bigquery.query(options)
    
    // 주차별로 그룹화
    const weekMap = new Map<string, WeeklyErrorData>()
    
    rows.forEach((row: any) => {
      const week = row.week
      const year2 = String(row.year).slice(2)
      const weekLabel = `${year2}년 ${row.week_num}주차`

      // 날짜 범위 포맷
      let dateRange = ''
      if (row.min_date && row.max_date) {
        try {
          const minD = row.min_date.value ? new Date(row.min_date.value) : new Date(row.min_date)
          const maxD = row.max_date.value ? new Date(row.max_date.value) : new Date(row.max_date)
          dateRange = `${minD.getMonth() + 1}/${minD.getDate()}~${maxD.getMonth() + 1}/${maxD.getDate()}`
        } catch {
          dateRange = ''
        }
      }

      if (!weekMap.has(week)) {
        weekMap.set(week, {
          week,
          weekLabel,
          dateRange,
          items: [],
        })
      }

      weekMap.get(week)!.items.push({
        itemId: row.item_id,
        itemName: row.item_name,
        errorCount: Number(row.error_count) || 0,
        errorRate: Number(row.error_rate) || 0,
      })
    })
    
    const result = Array.from(weekMap.values()).sort((a, b) => 
      b.week.localeCompare(a.week)
    )
    
    return { success: true, data: result }
  } catch (error) {
    console.error('[BigQuery] getWeeklyErrors error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// ============================================
// 항목별 오류 통계 조회
// ============================================

export interface ItemErrorStats {
  itemId: string
  itemName: string
  category: "상담태도" | "오상담/오처리"
  errorCount: number
  errorRate: number
  trend: number
}

export async function getItemErrorStats(filters?: {
  center?: string
  service?: string
  channel?: string
  startDate?: string
  endDate?: string
}): Promise<{ success: boolean; data?: ItemErrorStats[]; error?: string }> {
  try {
    const bigquery = getBigQueryClient()
    
    // 기본값: 최근 14일
    let startDate = filters?.startDate
    let endDate = filters?.endDate
    if (!startDate || !endDate) {
      const now = new Date()
      endDate = now.toISOString().split('T')[0]
      const start = new Date(now)
      start.setDate(start.getDate() - 14)
      startDate = start.toISOString().split('T')[0]
    }
    
    let whereClause = 'WHERE evaluation_date BETWEEN @startDate AND @endDate'
    const params: any = { startDate, endDate }
    
    if (filters?.center && filters.center !== 'all') {
      whereClause += ' AND center = @center'
      params.center = filters.center
    }
    if (filters?.service && filters.service !== 'all') {
      whereClause = addServiceFilter(whereClause, params, filters.service)
    }
    if (filters?.channel && filters.channel !== 'all') {
      whereClause += ' AND channel = @channel'
      params.channel = filters.channel
    }
    
    // 전일 데이터도 가져와서 trend 계산
    const prevStartDate = new Date(startDate)
    prevStartDate.setDate(prevStartDate.getDate() - 14)
    const prevEndDate = new Date(startDate)
    prevEndDate.setDate(prevEndDate.getDate() - 1)
    const prevStartDateStr = prevStartDate.toISOString().split('T')[0]
    const prevEndDateStr = prevEndDate.toISOString().split('T')[0]
    
    const query = `
      WITH current_period AS (
        SELECT
          'att1' as item_id,
          '첫인사/끝인사 누락' as item_name,
          '상담태도' as category,
          SUM(CAST(greeting_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM ${EVAL_TABLE}
        ${whereClause}
        
        UNION ALL
        
        SELECT
          'att2' as item_id,
          '공감표현 누락' as item_name,
          '상담태도' as category,
          SUM(CAST(empathy_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM ${EVAL_TABLE}
        ${whereClause}
        
        UNION ALL
        
        SELECT
          'att3' as item_id,
          '사과표현 누락' as item_name,
          '상담태도' as category,
          SUM(CAST(apology_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM ${EVAL_TABLE}
        ${whereClause}
        
        UNION ALL
        
        SELECT
          'att4' as item_id,
          '추가문의 누락' as item_name,
          '상담태도' as category,
          SUM(CAST(additional_inquiry_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM ${EVAL_TABLE}
        ${whereClause}
        
        UNION ALL
        
        SELECT
          'att5' as item_id,
          '불친절' as item_name,
          '상담태도' as category,
          SUM(CAST(unkind_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM ${EVAL_TABLE}
        ${whereClause}
        
        UNION ALL
        
        SELECT
          'err1' as item_id,
          '상담유형 오설정' as item_name,
          '오상담/오처리' as category,
          SUM(CAST(consult_type_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM ${EVAL_TABLE}
        ${whereClause}
        
        UNION ALL
        
        SELECT
          'err2' as item_id,
          '가이드 미준수' as item_name,
          '오상담/오처리' as category,
          SUM(CAST(guide_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM ${EVAL_TABLE}
        ${whereClause}
        
        UNION ALL
        
        SELECT
          'err3' as item_id,
          '본인확인 누락' as item_name,
          '오상담/오처리' as category,
          SUM(CAST(identity_check_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM ${EVAL_TABLE}
        ${whereClause}
        
        UNION ALL
        
        SELECT
          'err4' as item_id,
          '필수탐색 누락' as item_name,
          '오상담/오처리' as category,
          SUM(CAST(required_search_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM ${EVAL_TABLE}
        ${whereClause}
        
        UNION ALL
        
        SELECT
          'err5' as item_id,
          '오안내' as item_name,
          '오상담/오처리' as category,
          SUM(CAST(wrong_guide_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM ${EVAL_TABLE}
        ${whereClause}
        
        UNION ALL
        
        SELECT
          'err6' as item_id,
          '전산 처리 누락' as item_name,
          '오상담/오처리' as category,
          SUM(CAST(process_missing_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM ${EVAL_TABLE}
        ${whereClause}
        
        UNION ALL
        
        SELECT
          'err7' as item_id,
          '전산 처리 미완료' as item_name,
          '오상담/오처리' as category,
          SUM(CAST(process_incomplete_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM ${EVAL_TABLE}
        ${whereClause}
        
        UNION ALL
        
        SELECT
          'err8' as item_id,
          '전산 조작 미흡' as item_name,
          '오상담/오처리' as category,
          SUM(CAST(system_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM ${EVAL_TABLE}
        ${whereClause}
        
        UNION ALL
        
        SELECT
          'err9' as item_id,
          '콜픽트림ID 매핑 누락' as item_name,
          '오상담/오처리' as category,
          SUM(CAST(id_mapping_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM ${EVAL_TABLE}
        ${whereClause}
        
        UNION ALL
        
        SELECT
          'err10' as item_id,
          '플래그키워드 누락' as item_name,
          '오상담/오처리' as category,
          SUM(CAST(flag_keyword_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM ${EVAL_TABLE}
        ${whereClause}
        
        UNION ALL
        
        SELECT
          'err11' as item_id,
          '상담이력 기재 미흡' as item_name,
          '오상담/오처리' as category,
          SUM(CAST(history_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM ${EVAL_TABLE}
        ${whereClause}
      )
      SELECT
        item_id,
        item_name,
        category,
        error_count,
        ROUND(SAFE_DIVIDE(error_count, total_evaluations) * 100, 2) as error_rate
      FROM current_period
      ORDER BY item_id
    `
    
    const options = {
      query,
      params,
      location: GCP_LOCATION,
    }
    
    const [rows] = await bigquery.query(options)

    // 전영업일 대비 trend 계산: 최근 2 영업일(평가 데이터 있는 날) 조회
    let trendCenterFilter = ''
    if (filters?.center && filters.center !== 'all') {
      trendCenterFilter += ' AND center = @center'
    }
    if (filters?.service && filters.service !== 'all') {
      const rawNames = unmapServiceName(filters.service);
      if (rawNames.length === 1) {
        trendCenterFilter += ' AND service = @service';
        // params.service는 이미 위에서 설정됐을 수 있음
        if (!params.service) params.service = rawNames[0];
      } else {
        trendCenterFilter += ' AND service IN UNNEST(@serviceNames)';
        params.serviceNames = rawNames;
      }
    }
    if (filters?.channel && filters.channel !== 'all') {
      trendCenterFilter += ' AND channel = @channel'
    }

    const trendQuery = `
      WITH latest_dates AS (
        SELECT DISTINCT evaluation_date
        FROM ${EVAL_TABLE}
        WHERE evaluation_date BETWEEN @startDate AND @endDate
        ${trendCenterFilter}
        ORDER BY evaluation_date DESC
        LIMIT 2
      )
      SELECT
        evaluation_date,
        SUM(CAST(greeting_error AS INT64)) as att1,
        SUM(CAST(empathy_error AS INT64)) as att2,
        SUM(CAST(apology_error AS INT64)) as att3,
        SUM(CAST(additional_inquiry_error AS INT64)) as att4,
        SUM(CAST(unkind_error AS INT64)) as att5,
        SUM(CAST(consult_type_error AS INT64)) as err1,
        SUM(CAST(guide_error AS INT64)) as err2,
        SUM(CAST(identity_check_error AS INT64)) as err3,
        SUM(CAST(required_search_error AS INT64)) as err4,
        SUM(CAST(wrong_guide_error AS INT64)) as err5,
        SUM(CAST(process_missing_error AS INT64)) as err6,
        SUM(CAST(process_incomplete_error AS INT64)) as err7,
        SUM(CAST(system_error AS INT64)) as err8,
        SUM(CAST(id_mapping_error AS INT64)) as err9,
        SUM(CAST(flag_keyword_error AS INT64)) as err10,
        SUM(CAST(history_error AS INT64)) as err11,
        COUNT(*) as total_count
      FROM ${EVAL_TABLE}
      WHERE evaluation_date IN (SELECT evaluation_date FROM latest_dates)
      ${trendCenterFilter}
      GROUP BY evaluation_date
      ORDER BY evaluation_date DESC
    `

    const trendMap: Record<string, number> = {}
    try {
      const [trendRows] = await bigquery.query({
        query: trendQuery,
        params,
        location: GCP_LOCATION,
      })

      if (trendRows.length >= 2) {
        const latest = trendRows[0]
        const prev = trendRows[1]
        const itemIds = ['att1','att2','att3','att4','att5','err1','err2','err3','err4','err5','err6','err7','err8','err9','err10','err11']
        itemIds.forEach(id => {
          const latestTotal = Number(latest.total_count) || 1
          const prevTotal = Number(prev.total_count) || 1
          const latestRate = (Number(latest[id]) / latestTotal) * 100
          const prevRate = (Number(prev[id]) / prevTotal) * 100
          trendMap[id] = Number((latestRate - prevRate).toFixed(2))
        })
      }
    } catch (trendErr) {
      console.warn('[BigQuery] trend calculation failed, using 0:', trendErr)
    }

    const result: ItemErrorStats[] = rows.map((row: any) => ({
      itemId: row.item_id,
      itemName: row.item_name,
      category: row.category as "상담태도" | "오상담/오처리",
      errorCount: Number(row.error_count) || 0,
      errorRate: Number(row.error_rate) || 0,
      trend: trendMap[row.item_id] || 0,
    }))

    return { success: true, data: result }
  } catch (error) {
    console.error('[BigQuery] getItemErrorStats error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// ============================================
// 근속기간별 오류 현황 조회
// ============================================

export interface TenureStatItem {
  center: string;
  service: string;
  channel: string;
  tenureGroup: string;
  items: Record<string, number>;
}

export async function getTenureStats(filters?: {
  center?: string;
  service?: string;
  channel?: string;
  startDate?: string;
  endDate?: string;
}): Promise<{ success: boolean; data?: TenureStatItem[]; error?: string }> {
  try {
    const bigquery = getBigQueryClient();

    let startDate = filters?.startDate;
    let endDate = filters?.endDate;
    if (!startDate || !endDate) {
      const now = new Date();
      endDate = now.toISOString().split('T')[0];
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      startDate = start.toISOString().split('T')[0];
    }

    let whereClause = 'WHERE e.evaluation_date BETWEEN @startDate AND @endDate';
    const params: any = { startDate, endDate };

    if (filters?.center && filters.center !== 'all') {
      whereClause += ' AND e.center = @center';
      params.center = filters.center;
    }
    if (filters?.service && filters.service !== 'all') {
      whereClause = addServiceFilter(whereClause, params, filters.service, 'e');
    }
    if (filters?.channel && filters.channel !== 'all') {
      whereClause += ' AND e.channel = @channel';
      params.channel = filters.channel;
    }

    // HR 캐시에서 근속 정보 가져오기 (Google Sheets JOIN 제거 → 성능 개선)
    const hrMap = await getHrAgentsMap();

    // agent_id별로 집계 (tenureGroup은 JS에서 매핑)
    const query = `
      SELECT
        e.agent_id,
        e.center,
        e.service,
        e.channel,
        SUM(CAST(e.greeting_error AS INT64)) as att1,
        SUM(CAST(e.empathy_error AS INT64)) as att2,
        SUM(CAST(e.apology_error AS INT64)) as att3,
        SUM(CAST(e.additional_inquiry_error AS INT64)) as att4,
        SUM(CAST(e.unkind_error AS INT64)) as att5,
        SUM(CAST(e.consult_type_error AS INT64)) as err1,
        SUM(CAST(e.guide_error AS INT64)) as err2,
        SUM(CAST(e.identity_check_error AS INT64)) as err3,
        SUM(CAST(e.required_search_error AS INT64)) as err4,
        SUM(CAST(e.wrong_guide_error AS INT64)) as err5,
        SUM(CAST(e.process_missing_error AS INT64)) as err6,
        SUM(CAST(e.process_incomplete_error AS INT64)) as err7,
        SUM(CAST(e.system_error AS INT64)) as err8,
        SUM(CAST(e.id_mapping_error AS INT64)) as err9,
        SUM(CAST(e.flag_keyword_error AS INT64)) as err10,
        SUM(CAST(e.history_error AS INT64)) as err11
      FROM ${EVAL_TABLE} e
      ${whereClause}
      GROUP BY e.agent_id, e.center, e.service, e.channel
    `;

    const [rows] = await bigquery.query({ query, params, location: GCP_LOCATION });

    const itemIds = ['att1','att2','att3','att4','att5','err1','err2','err3','err4','err5','err6','err7','err8','err9','err10','err11'];

    // center-service-channel-tenureGroup 키별로 재집계
    const aggregated = new Map<string, Record<string, number>>();

    for (const row of rows) {
      const agentIdLower = String(row.agent_id || '').trim().toLowerCase();
      const hireDate = hrMap.get(agentIdLower);
      const tenureMonths = hireDate ? calcTenureMonths(hireDate) : 0;
      const tenureGroup = hireDate ? calcTenureGroup(tenureMonths) : '3개월 미만';

      const key = `${row.center}|${mapServiceName(row.service, row.center)}|${row.channel}|${tenureGroup}`;
      const existing = aggregated.get(key);

      if (existing) {
        for (const id of itemIds) {
          existing[id] = (existing[id] || 0) + (Number(row[id]) || 0);
        }
      } else {
        aggregated.set(key, Object.fromEntries(itemIds.map(id => [id, Number(row[id]) || 0])));
      }
    }

    const data: TenureStatItem[] = [];
    for (const [key, items] of aggregated) {
      const [center, service, channel, tenureGroup] = key.split('|');
      data.push({ center, service, channel, tenureGroup, items });
    }
    // 정렬: center → service → channel → tenureGroup
    data.sort((a, b) =>
      a.center.localeCompare(b.center) ||
      a.service.localeCompare(b.service) ||
      a.channel.localeCompare(b.channel) ||
      a.tenureGroup.localeCompare(b.tenureGroup)
    );

    return { success: true, data };
  } catch (error) {
    console.error('[BigQuery] getTenureStats error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// 상담사 존재 여부 확인
// ============================================

export async function checkAgentExists(
  agentName?: string,
  agentId?: string
): Promise<{ success: boolean; found?: boolean; agents?: any[]; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    
    if (!agentName && !agentId) {
      return { success: false, error: 'agentName or agentId is required' };
    }
    
    let whereClause = 'WHERE 1=1';
    const params: any = {};
    
    if (agentName) {
      whereClause += ' AND agent_name = @agentName';
      params.agentName = agentName;
    }
    if (agentId) {
      whereClause += ' AND agent_id = @agentId';
      params.agentId = agentId;
    }
    
    const query = `
      SELECT DISTINCT
        agent_id,
        agent_name,
        center,
        service,
        channel
      FROM ${EVAL_TABLE}
      ${whereClause}
      LIMIT 10
    `;
    
    const options = {
      query,
      params,
      location: GCP_LOCATION,
    };
    
    const [rows] = await bigquery.query(options);
    
    return {
      success: true,
      found: rows.length > 0,
      agents: rows,
    };
  } catch (error) {
    console.error('[BigQuery] checkAgentExists error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// 상담사 상세 데이터 조회 (일별 추이 및 항목별 오류)
// ============================================

export interface AgentDetailData {
  agentId: string
  agentName: string
  dailyTrend: Array<{
    date: string
    errorRate: number
  }>
  itemErrors: Array<{
    itemId: string
    itemName: string
    errorCount: number
    category: "상담태도" | "오상담/오처리"
  }>
}

export async function getAgentDetail(
  agentId: string,
  startDate?: string,
  endDate?: string
): Promise<{ success: boolean; data?: AgentDetailData; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    
    // 기본값: 최근 14일
    let queryStartDate = startDate;
    let queryEndDate = endDate;
    if (!queryStartDate || !queryEndDate) {
      const now = new Date();
      queryEndDate = now.toISOString().split('T')[0];
      const start = new Date(now);
      start.setDate(start.getDate() - 14);
      queryStartDate = start.toISOString().split('T')[0];
    }
    
    // 1. 일별 오류율 추이 조회
    const dailyTrendQuery = `
      SELECT
        evaluation_date as date,
        COUNT(*) as total_evaluations,
        SUM(attitude_error_count) as attitude_errors,
        SUM(business_error_count) as business_errors,
        ROUND(SAFE_DIVIDE(SUM(attitude_error_count) + SUM(business_error_count), COUNT(*) * 16) * 100, 2) as error_rate
      FROM ${EVAL_TABLE}
      WHERE agent_id = @agentId
        AND evaluation_date BETWEEN @startDate AND @endDate
      GROUP BY evaluation_date
      ORDER BY evaluation_date ASC
    `;
    
    const [dailyTrendRows] = await bigquery.query({
      query: dailyTrendQuery,
      params: {
        agentId,
        startDate: queryStartDate,
        endDate: queryEndDate,
      },
      location: GCP_LOCATION,
    });
    
    // 2. 항목별 오류 개수 조회 (단일 쿼리로 모든 항목 집계)
    const itemErrorsQuery = `
      SELECT
        SUM(CAST(greeting_error AS INT64)) as greeting_errors,
        SUM(CAST(empathy_error AS INT64)) as empathy_errors,
        SUM(CAST(apology_error AS INT64)) as apology_errors,
        SUM(CAST(additional_inquiry_error AS INT64)) as additional_inquiry_errors,
        SUM(CAST(unkind_error AS INT64)) as unkind_errors,
        SUM(CAST(consult_type_error AS INT64)) as consult_type_errors,
        SUM(CAST(guide_error AS INT64)) as guide_errors,
        SUM(CAST(identity_check_error AS INT64)) as identity_check_errors,
        SUM(CAST(required_search_error AS INT64)) as required_search_errors,
        SUM(CAST(wrong_guide_error AS INT64)) as wrong_guide_errors,
        SUM(CAST(process_missing_error AS INT64)) as process_missing_errors,
        SUM(CAST(process_incomplete_error AS INT64)) as process_incomplete_errors,
        SUM(CAST(system_error AS INT64)) as system_errors,
        SUM(CAST(id_mapping_error AS INT64)) as id_mapping_errors,
        SUM(CAST(flag_keyword_error AS INT64)) as flag_keyword_errors,
        SUM(CAST(history_error AS INT64)) as history_errors
      FROM ${EVAL_TABLE}
      WHERE agent_id = @agentId
        AND evaluation_date BETWEEN @startDate AND @endDate
    `;
    
    const [itemErrorsRows] = await bigquery.query({
      query: itemErrorsQuery,
      params: {
        agentId,
        startDate: queryStartDate,
        endDate: queryEndDate,
      },
      location: GCP_LOCATION,
    });
    
    // 항목별 매핑
    const itemMap = [
      { key: 'greeting_errors', id: 'att1', name: '첫인사/끝인사 누락', category: '상담태도' as const },
      { key: 'empathy_errors', id: 'att2', name: '공감표현 누락', category: '상담태도' as const },
      { key: 'apology_errors', id: 'att3', name: '사과표현 누락', category: '상담태도' as const },
      { key: 'additional_inquiry_errors', id: 'att4', name: '추가문의 누락', category: '상담태도' as const },
      { key: 'unkind_errors', id: 'att5', name: '불친절', category: '상담태도' as const },
      { key: 'consult_type_errors', id: 'err1', name: '상담유형 오설정', category: '오상담/오처리' as const },
      { key: 'guide_errors', id: 'err2', name: '가이드 미준수', category: '오상담/오처리' as const },
      { key: 'identity_check_errors', id: 'err3', name: '본인확인 누락', category: '오상담/오처리' as const },
      { key: 'required_search_errors', id: 'err4', name: '필수탐색 누락', category: '오상담/오처리' as const },
      { key: 'wrong_guide_errors', id: 'err5', name: '오안내', category: '오상담/오처리' as const },
      { key: 'process_missing_errors', id: 'err6', name: '전산 처리 누락', category: '오상담/오처리' as const },
      { key: 'process_incomplete_errors', id: 'err7', name: '전산 처리 미흡/정정', category: '오상담/오처리' as const },
      { key: 'system_errors', id: 'err8', name: '전산 조작 미흡/오류', category: '오상담/오처리' as const },
      { key: 'id_mapping_errors', id: 'err9', name: '콜/픽/트립ID 매핑누락&오기재', category: '오상담/오처리' as const },
      { key: 'flag_keyword_errors', id: 'err10', name: '플래그/키워드 누락&오기재', category: '오상담/오처리' as const },
      { key: 'history_errors', id: 'err11', name: '상담이력 기재 미흡', category: '오상담/오처리' as const },
    ];
    
    const itemErrors = itemMap
      .map(item => ({
        itemId: item.id,
        itemName: item.name,
        errorCount: Number(itemErrorsRows[0]?.[item.key]) || 0,
        category: item.category,
      }))
      .filter(item => item.errorCount > 0);
    
    // 3. 상담사 이름 조회
    const agentNameQuery = `
      SELECT DISTINCT agent_name
      FROM ${EVAL_TABLE}
      WHERE agent_id = @agentId
      LIMIT 1
    `;
    
    const [agentNameRows] = await bigquery.query({
      query: agentNameQuery,
      params: { agentId },
      location: GCP_LOCATION,
    });
    
    const agentName = agentNameRows[0]?.agent_name || agentId;
    
    // 결과 변환
    const dailyTrend = dailyTrendRows.map((row: any) => ({
      date: row.date?.value || row.date || '',
      errorRate: Number(row.error_rate) || 0,
    }));
    
    return {
      success: true,
      data: {
        agentId,
        agentName,
        dailyTrend,
        itemErrors,
      },
    };
  } catch (error) {
    console.error('[BigQuery] getAgentDetail error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// AI 어시스턴트용 데이터 조회
// ============================================

export async function getAgentAnalysisData(
  agentId: string,
  month: string
): Promise<{ success: boolean; data?: AgentAnalysisContext; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    
    const query = `
      SELECT
        agent_id,
        agent_name,
        center,
        service,
        channel,
        COUNT(*) as total_evaluations,
        ROUND(SAFE_DIVIDE(SUM(attitude_error_count), COUNT(*) * 5) * 100, 2) as attitude_error_rate,
        ROUND(SAFE_DIVIDE(SUM(business_error_count), COUNT(*) * 11) * 100, 2) as ops_error_rate,
        SUM(CAST(empathy_error AS INT64)) as empathy_errors,
        SUM(CAST(consult_type_error AS INT64)) as consult_type_errors,
        SUM(CAST(guide_error AS INT64)) as guide_errors
      FROM ${EVAL_TABLE}
      WHERE agent_id = @agentId
        AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
      GROUP BY agent_id, agent_name, center, service, channel
      LIMIT 1
    `;
    
    const [rows] = await bigquery.query({
      query,
      params: { agentId, month },
      location: GCP_LOCATION,
    });
    
    if (rows.length === 0) {
      return { success: false, error: 'Agent not found' };
    }
    
    const row = rows[0];
    const attitudeRate = Number(row.attitude_error_rate) || 0;
    const opsRate = Number(row.ops_error_rate) || 0;
    
    const context: AgentAnalysisContext = {
      agentId: row.agent_id,
      agentName: row.agent_name,
      center: row.center,
      service: mapServiceName(row.service, row.center),
      channel: row.channel,
      tenureMonths: 0, // TODO: 실제 tenure 데이터 조회
      tenureGroup: '',
      totalEvaluations: Number(row.total_evaluations) || 0,
      attitudeErrorRate: attitudeRate,
      opsErrorRate: opsRate,
      overallErrorRate: Number((attitudeRate + opsRate).toFixed(2)),
      errorBreakdown: [
        { itemName: '공감표현누락', errorCount: Number(row.empathy_errors) || 0, errorRate: 0 },
        { itemName: '상담유형오설정', errorCount: Number(row.consult_type_errors) || 0, errorRate: 0 },
        { itemName: '가이드미준수', errorCount: Number(row.guide_errors) || 0, errorRate: 0 },
      ],
      trendData: [], // TODO: 실제 trend 데이터 조회
    };
    
    return { success: true, data: context };
  } catch (error) {
    console.error('[BigQuery] getAgentAnalysisData error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getGroupAnalysisData(
  center: string,
  service: string,
  channel: string,
  month: string
): Promise<{ success: boolean; data?: GroupAnalysisContext; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    
    const query = `
      SELECT
        center,
        service,
        channel,
        COUNT(DISTINCT agent_id) as total_agents,
        COUNT(*) as total_evaluations,
        ROUND(SAFE_DIVIDE(SUM(attitude_error_count), COUNT(*) * 5) * 100, 2) as attitude_error_rate,
        ROUND(SAFE_DIVIDE(SUM(business_error_count), COUNT(*) * 11) * 100, 2) as ops_error_rate
      FROM ${EVAL_TABLE}
      WHERE center = @center
        AND service IN UNNEST(@serviceNames)
        AND channel = @channel
        AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
      GROUP BY center, service, channel
      LIMIT 1
    `;

    const serviceNames = unmapServiceName(service);
    const [rows] = await bigquery.query({
      query,
      params: { center, serviceNames, channel, month },
      location: GCP_LOCATION,
    });
    
    if (rows.length === 0) {
      return { success: false, error: 'Group not found' };
    }
    
    const row = rows[0];
    const attitudeRate = Number(row.attitude_error_rate) || 0;
    const opsRate = Number(row.ops_error_rate) || 0;
    
    const context: GroupAnalysisContext = {
      center: row.center,
      service: mapServiceName(row.service, row.center),
      channel: row.channel,
      totalAgents: Number(row.total_agents) || 0,
      totalEvaluations: Number(row.total_evaluations) || 0,
      attitudeErrorRate: attitudeRate,
      opsErrorRate: opsRate,
      overallErrorRate: Number((attitudeRate + opsRate).toFixed(2)),
      topErrors: [],
      agentRankings: [],
      trendData: [], // TODO: 실제 trend 데이터 조회
    };
    
    return { success: true, data: context };
  } catch (error) {
    console.error('[BigQuery] getGroupAnalysisData error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// 목표 관련 함수
// ============================================

export async function getGoalCurrentRate(
  goalId: string,
  goalType: 'attitude' | 'ops' | 'total',
  center: string | null,
  startDate: string,
  endDate: string
): Promise<{ success: boolean; data?: { currentRate: number }; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    
    let whereClause = 'WHERE evaluation_date >= @startDate AND evaluation_date <= @endDate';
    const params: any = { startDate, endDate };
    
    if (center && center !== '전체') {
      whereClause += ' AND center = @center';
      params.center = center;
    }
    
    let rateColumn = '';
    if (goalType === 'attitude') {
      rateColumn = 'ROUND(SAFE_DIVIDE(SUM(attitude_error_count), COUNT(*) * 5) * 100, 2)';
    } else if (goalType === 'ops') {
      rateColumn = 'ROUND(SAFE_DIVIDE(SUM(business_error_count), COUNT(*) * 11) * 100, 2)';
    } else {
      rateColumn = 'ROUND(SAFE_DIVIDE(SUM(attitude_error_count + business_error_count), COUNT(*) * 16) * 100, 2)';
    }
    
    const query = `
      SELECT
        ${rateColumn} as current_rate
      FROM ${EVAL_TABLE}
      ${whereClause}
    `;
    
    const [rows] = await bigquery.query({
      query,
      params,
      location: GCP_LOCATION,
    });
    
    const currentRate = Number(rows[0]?.current_rate) || 0;
    
    return { success: true, data: { currentRate } };
  } catch (error) {
    console.error('[BigQuery] getGoalCurrentRate error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function saveGoalToBigQuery(goal: {
  id?: string;
  name: string;
  center: string | null;
  service?: string | null;
  channel?: string | null;
  type: string;
  targetRate: number;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  isActive: boolean;
}): Promise<{ success: boolean; saved?: number; data?: any; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    const dataset = bigquery.dataset(DATASET_ID);
    const table = dataset.table('targets');
    
    const isUpdate = !!goal.id;
    
    // target_id 생성 또는 사용
    const targetId = goal.id || `${goal.periodType}_${goal.center || 'all'}_${goal.type}_${Date.now()}`;
    
    // type에 따라 적절한 컬럼에 값 설정
    let targetAttitudeErrorRate: number | null = null;
    let targetBusinessErrorRate: number | null = null;
    let targetOverallErrorRate: number | null = null;
    
    if (goal.type === 'attitude') {
      targetAttitudeErrorRate = goal.targetRate;
    } else if (goal.type === 'ops') {
      targetBusinessErrorRate = goal.targetRate;
    } else if (goal.type === 'total') {
      targetOverallErrorRate = goal.targetRate;
    }
    
    // name에서 service 추출 (선택적)
    const nameParts = goal.name.split(' ');
    const service = nameParts.length > 2 ? nameParts[1] : null;
    
    if (isUpdate) {
      // UPDATE: MERGE 문 사용 (더 안전하고 null 값 처리 용이)
      try {
        // 기존 레코드 조회 (기존 값 유지용)
        const [existingRows] = await bigquery.query({
          query: `SELECT * FROM ${TARGETS_TABLE} WHERE target_id = @targetId LIMIT 1`,
          params: { targetId },
          location: GCP_LOCATION,
        });
        
        if (existingRows.length === 0) {
          throw new Error(`Goal with id ${targetId} not found`);
        }
        
        const existing = existingRows[0];
        
        // type에 따라 업데이트할 필드 결정 (기존 값 유지)
        const finalAttitudeRate = goal.type === 'attitude' 
          ? targetAttitudeErrorRate 
          : (existing.target_attitude_error_rate ?? null);
        const finalBusinessRate = goal.type === 'ops'
          ? targetBusinessErrorRate
          : (existing.target_business_error_rate ?? null);
        const finalOverallRate = goal.type === 'total'
          ? targetOverallErrorRate
          : (existing.target_overall_error_rate ?? null);
        
        // MERGE 문 사용 (INSERT OR UPDATE) - null 값은 리터럴로 처리
        const centerValue = (goal.center !== null && goal.center !== undefined && goal.center !== '') 
          ? `'${goal.center.replace(/'/g, "''")}'` 
          : 'NULL';
        const serviceValue = (service !== null && service !== undefined && service !== '') 
          ? `'${service.replace(/'/g, "''")}'` 
          : 'NULL';
        
        const attitudeRateValue = goal.type === 'attitude' ? String(finalAttitudeRate) : 'NULL';
        const businessRateValue = goal.type === 'ops' ? String(finalBusinessRate) : 'NULL';
        const overallRateValue = goal.type === 'total' ? String(finalOverallRate) : 'NULL';
        
        const mergeQuery = `
          MERGE ${TARGETS_TABLE} T
          USING (
            SELECT
              @targetId as target_id,
              ${centerValue} as center,
              ${serviceValue} as service,
              @periodType as period_type,
              ${attitudeRateValue} as target_attitude_error_rate,
              ${businessRateValue} as target_business_error_rate,
              ${overallRateValue} as target_overall_error_rate,
              @startDate as start_date,
              @endDate as end_date,
              @isActive as is_active
          ) S
          ON T.target_id = S.target_id
          WHEN MATCHED THEN
            UPDATE SET
              center = S.center,
              service = S.service,
              period_type = S.period_type,
              target_attitude_error_rate = ${goal.type === 'attitude' ? 'S.target_attitude_error_rate' : 'T.target_attitude_error_rate'},
              target_business_error_rate = ${goal.type === 'ops' ? 'S.target_business_error_rate' : 'T.target_business_error_rate'},
              target_overall_error_rate = ${goal.type === 'total' ? 'S.target_overall_error_rate' : 'T.target_overall_error_rate'},
              start_date = S.start_date,
              end_date = S.end_date,
              is_active = S.is_active,
              updated_at = CURRENT_TIMESTAMP()
          WHEN NOT MATCHED THEN
            INSERT (
              target_id, center, service, period_type,
              target_attitude_error_rate, target_business_error_rate, target_overall_error_rate,
              start_date, end_date, is_active, created_at, updated_at
            )
            VALUES (
              S.target_id, S.center, S.service, S.period_type,
              S.target_attitude_error_rate, S.target_business_error_rate, S.target_overall_error_rate,
              S.start_date, S.end_date, S.is_active, CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()
            )
        `;
        
        // 파라미터 준비 (null이 아닌 값만)
        const mergeParams: any = {
          targetId,
          periodType: goal.periodType,
          startDate: goal.periodStart,
          endDate: goal.periodEnd,
          isActive: goal.isActive,
        };
        
        console.log('[BigQuery] Merge query:', mergeQuery);
        console.log('[BigQuery] Merge params:', JSON.stringify(mergeParams, null, 2));
        
        const [result] = await bigquery.query({
          query: mergeQuery,
          params: mergeParams,
          location: GCP_LOCATION,
        });
        
        console.log('[BigQuery] Goal merged successfully:', targetId);
        return { success: true, saved: 1 };
      } catch (updateError: any) {
        console.error('[BigQuery] Merge error details:', updateError);
        console.error('[BigQuery] Error stack:', updateError?.stack);
        
        // 에러 메시지 개선
        let errorMessage = '목표 저장 실패';
        if (updateError?.errors && Array.isArray(updateError.errors)) {
          const errorDetails = updateError.errors.map((e: any) => e.message || e.reason || String(e)).join(', ');
          errorMessage += ': ' + errorDetails;
        } else if (updateError?.message) {
          errorMessage += ': ' + updateError.message;
        } else if (typeof updateError === 'string') {
          errorMessage += ': ' + updateError;
        } else {
          errorMessage += ': 알 수 없는 오류가 발생했습니다';
        }
        
        throw new Error(errorMessage);
      }
    } else {
      // INSERT: table.insert() 사용
      const row: any = {
        target_id: targetId,
        period_type: goal.periodType,
        start_date: goal.periodStart,
        end_date: goal.periodEnd,
        is_active: goal.isActive,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      // center와 service는 null이어도 명시적으로 설정
      row.center = goal.center !== null && goal.center !== undefined && goal.center !== '' ? goal.center : null;
      row.service = service !== null && service !== undefined && service !== '' ? service : null;
      
      // type에 따라 해당 필드만 설정 (나머지는 null)
      if (goal.type === 'attitude') {
        row.target_attitude_error_rate = targetAttitudeErrorRate;
        row.target_business_error_rate = null;
        row.target_overall_error_rate = null;
      } else if (goal.type === 'ops') {
        row.target_attitude_error_rate = null;
        row.target_business_error_rate = targetBusinessErrorRate;
        row.target_overall_error_rate = null;
      } else if (goal.type === 'total') {
        row.target_attitude_error_rate = null;
        row.target_business_error_rate = null;
        row.target_overall_error_rate = targetOverallErrorRate;
      }
      
      try {
        console.log('[BigQuery] Inserting goal:', {
          target_id: targetId,
          center: row.center,
          service: row.service,
          type: goal.type,
          targetRate: goal.targetRate,
        });
        
        await table.insert([row]);
        console.log('[BigQuery] Goal inserted successfully:', targetId);
        return { success: true, saved: 1 };
      } catch (insertError: any) {
        console.error('[BigQuery] Insert error details:', insertError);
        console.error('[BigQuery] Insert row:', JSON.stringify(row, null, 2));
        
        // 에러 메시지 개선
        let errorMessage = '목표 저장 실패';
        if (insertError?.errors) {
          errorMessage += ': ' + insertError.errors.map((e: any) => e.message).join(', ');
        } else if (insertError?.message) {
          errorMessage += ': ' + insertError.message;
        }
        
        throw new Error(errorMessage);
      }
    }
  } catch (error) {
    console.error('[BigQuery] saveGoalToBigQuery error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// 리포트 데이터 조회
// ============================================

export async function getReportData(
  type: string,
  period: string,
  filters?: {
    center?: string;
    service?: string;
    channel?: string;
    startDate?: string;
    endDate?: string;
  }
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    const { center, service, channel, startDate, endDate } = filters || {};
    
    // 리포트 타입에 따라 다른 쿼리 실행
    // 기본적으로 대시보드 통계를 반환
    if (type === 'dashboard') {
      const stats = await getDashboardStats(startDate);
      if (!stats.success || !stats.data) {
        return stats;
      }
      // 리포트 형식으로 변환
      return {
        success: true,
        data: {
          summary: {
            totalEvaluations: stats.data.totalEvaluations || 0,
            totalAgents: (stats.data.totalAgentsYongsan || 0) + (stats.data.totalAgentsGwangju || 0),
            overallErrorRate: stats.data.overallErrorRate || 0,
            errorRateTrend: 0, // TODO: 전일 대비 계산
            targetAchievement: 0, // TODO: 목표 달성률 계산
            improvedAgents: 0, // TODO: 개선 상담사 수 계산
            needsAttention: stats.data.watchlistYongsan + stats.data.watchlistGwangju || 0,
          },
          topIssues: [],
          centerComparison: [],
          dailyTrend: [],
          groupRanking: [],
        },
      };
    } else if (type === 'agents') {
      const agents = await getAgents({ center, service, channel });
      return agents;
    } else if (type === 'errors') {
      const errors = await getDailyErrors({ startDate, endDate, center, service, channel });
      return errors;
    } else {
      // 기본 리포트 데이터
      const stats = await getDashboardStats(startDate);
      if (!stats.success || !stats.data) {
        return stats;
      }
      return {
        success: true,
        data: {
          summary: {
            totalEvaluations: stats.data.totalEvaluations || 0,
            totalAgents: (stats.data.totalAgentsYongsan || 0) + (stats.data.totalAgentsGwangju || 0),
            overallErrorRate: stats.data.overallErrorRate || 0,
            errorRateTrend: 0,
            targetAchievement: 0,
            improvedAgents: 0,
            needsAttention: stats.data.watchlistYongsan + stats.data.watchlistGwangju || 0,
          },
          topIssues: [],
          centerComparison: [],
          dailyTrend: [],
          groupRanking: [],
        },
      };
    }
  } catch (error) {
    console.error('[BigQuery] getReportData error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================
// 액션 플랜 CRUD
// ============================================

export async function getActionPlans(filters?: { center?: string; status?: string }): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    let whereClause = 'WHERE 1=1';
    const params: any = {};

    if (filters?.center) {
      whereClause += ' AND center = @center';
      params.center = filters.center;
    }
    if (filters?.status) {
      whereClause += ' AND status = @status';
      params.status = filters.status;
    }

    const query = `
      SELECT
        id,
        agent_id as agentId,
        agent_name as agentName,
        center,
        group_name as groupName,
        issue,
        plan,
        status,
        FORMAT_TIMESTAMP('%Y-%m-%d', created_at) as createdAt,
        FORMAT_DATE('%Y-%m-%d', target_date) as targetDate,
        result,
        improvement,
        manager_feedback as managerFeedback,
        FORMAT_DATE('%Y-%m-%d', feedback_date) as feedbackDate
      FROM ${ACTION_PLANS_TABLE}
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT 100
    `;

    const [rows] = await bigquery.query({ query, params, location: GCP_LOCATION });
    return { success: true, data: rows };
  } catch (error) {
    console.error('[BigQuery] getActionPlans error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function saveActionPlan(data: {
  id: string;
  agentId: string;
  agentName: string;
  center: string;
  group: string;
  issue: string;
  plan: string;
  status: string;
  targetDate: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    const query = `
      INSERT INTO ${ACTION_PLANS_TABLE} (
        id, agent_id, agent_name, center, group_name,
        issue, plan, status, target_date, created_at
      ) VALUES (
        @id, @agentId, @agentName, @center, @groupName,
        @issue, @plan, @status, @targetDate, CURRENT_TIMESTAMP()
      )
    `;

    await bigquery.query({
      query,
      params: {
        id: data.id,
        agentId: data.agentId,
        agentName: data.agentName,
        center: data.center,
        groupName: data.group,
        issue: data.issue,
        plan: data.plan,
        status: data.status,
        targetDate: data.targetDate,
      },
      location: GCP_LOCATION,
    });

    return { success: true };
  } catch (error) {
    console.error('[BigQuery] saveActionPlan error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function updateActionPlan(id: string, updates: Record<string, any>): Promise<{ success: boolean; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    const setClauses: string[] = [];
    const params: any = { id };

    if (updates.status) {
      setClauses.push('status = @status');
      params.status = updates.status;
    }
    if (updates.result) {
      setClauses.push('result = @result');
      params.result = updates.result;
    }
    if (updates.improvement) {
      setClauses.push('improvement = @improvement');
      params.improvement = updates.improvement;
    }
    if (updates.managerFeedback) {
      setClauses.push('manager_feedback = @managerFeedback');
      params.managerFeedback = updates.managerFeedback;
    }
    if (updates.feedbackDate) {
      setClauses.push('feedback_date = @feedbackDate');
      params.feedbackDate = updates.feedbackDate;
    }

    if (setClauses.length === 0) {
      return { success: false, error: 'No fields to update' };
    }

    const query = `
      UPDATE ${ACTION_PLANS_TABLE}
      SET ${setClauses.join(', ')}
      WHERE id = @id
    `;

    await bigquery.query({ query, params, location: GCP_LOCATION });
    return { success: true };
  } catch (error) {
    console.error('[BigQuery] updateActionPlan error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export default {
  getDashboardStats,
  getCenterStats,
  getDailyTrend,
  getAgents,
  getEvaluations,
  getWatchList,
  getGoals,
  getDailyErrors,
  getWeeklyErrors,
  getItemErrorStats,
  getTenureStats,
  saveEvaluationsToBigQuery,
  checkAgentExists,
  getAgentAnalysisData,
  getGroupAnalysisData,
  getGoalCurrentRate,
  saveGoalToBigQuery,
  getReportData,
  getActionPlans,
  saveActionPlan,
  updateActionPlan,
  getBigQueryClient,
};
