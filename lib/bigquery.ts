import { BigQuery } from '@google-cloud/bigquery';

/**
 * BigQuery 클라이언트 초기화
 * 
 * 인증 방법:
 * 1. BIGQUERY_CREDENTIALS 환경 변수 (JSON 문자열)
 * 2. GOOGLE_APPLICATION_CREDENTIALS 환경 변수 (파일 경로)
 * 3. 기본 애플리케이션 인증 (GCP 환경)
 */
function initializeBigQuery(): BigQuery {
  const projectId = process.env.BIGQUERY_PROJECT_ID || 'splyquizkm';
  
  // 환경 변수에서 credentials JSON 파싱
  if (process.env.BIGQUERY_CREDENTIALS) {
    try {
      const credentials = JSON.parse(process.env.BIGQUERY_CREDENTIALS);
      return new BigQuery({
        projectId,
        credentials,
      });
    } catch (error) {
      console.error('[BigQuery] Failed to parse BIGQUERY_CREDENTIALS:', error);
      throw new Error('Invalid BIGQUERY_CREDENTIALS format');
    }
  }
  
  // GOOGLE_APPLICATION_CREDENTIALS 환경 변수 또는 기본 인증 사용
  return new BigQuery({ projectId });
}

// BigQuery 클라이언트 싱글톤
let bigqueryClient: BigQuery | null = null;

function getBigQueryClient(): BigQuery {
  if (!bigqueryClient) {
    bigqueryClient = initializeBigQuery();
  }
  return bigqueryClient;
}

// 데이터셋 ID
const DATASET_ID = process.env.BIGQUERY_DATASET_ID || 'KMCC_QC';

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
}

export async function getDashboardStats(targetDate?: string): Promise<{ success: boolean; data?: DashboardStats; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    
    // 날짜가 없으면 어제 날짜 사용
    let queryDate = targetDate;
    if (!queryDate) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      queryDate = yesterday.toISOString().split('T')[0];
    }
    
    console.log(`[BigQuery] getDashboardStats: ${queryDate}`);
    
    const query = `
      WITH daily_stats AS (
        SELECT
          center,
          COUNT(*) as evaluation_count,
          COUNT(DISTINCT agent_id) as agent_count,
          SUM(attitude_error_count) as total_attitude_errors,
          SUM(business_error_count) as total_ops_errors
        FROM \`${DATASET_ID}.evaluations\`
        WHERE evaluation_date = @queryDate
        GROUP BY center
      ),
      watchlist_counts AS (
        SELECT
          center,
          COUNT(DISTINCT agent_id) as watchlist_count
        FROM \`${DATASET_ID}.evaluations\`
        WHERE evaluation_date = @queryDate
          AND (
            (attitude_error_count / 5.0 * 100) > 5
            OR (business_error_count / 11.0 * 100) > 6
          )
        GROUP BY center
      )
      SELECT
        COALESCE(SUM(CASE WHEN ds.center = '용산' THEN ds.agent_count ELSE 0 END), 0) as totalAgentsYongsan,
        COALESCE(SUM(CASE WHEN ds.center = '광주' THEN ds.agent_count ELSE 0 END), 0) as totalAgentsGwangju,
        COALESCE(SUM(ds.evaluation_count), 0) as totalEvaluations,
        COALESCE(SUM(CASE WHEN wc.center = '용산' THEN wc.watchlist_count ELSE 0 END), 0) as watchlistYongsan,
        COALESCE(SUM(CASE WHEN wc.center = '광주' THEN wc.watchlist_count ELSE 0 END), 0) as watchlistGwangju,
        ROUND(SAFE_DIVIDE(SUM(ds.total_attitude_errors), SUM(ds.evaluation_count) * 5) * 100, 2) as attitudeErrorRate,
        ROUND(SAFE_DIVIDE(SUM(ds.total_ops_errors), SUM(ds.evaluation_count) * 11) * 100, 2) as businessErrorRate
      FROM daily_stats ds
      LEFT JOIN watchlist_counts wc ON ds.center = wc.center
    `;
    
    const options = {
      query,
      params: { queryDate },
      location: 'asia-northeast3',
    };
    
    const [rows] = await bigquery.query(options);
    
    if (rows.length === 0) {
      return {
        success: true,
        data: {
          totalAgentsYongsan: 0,
          totalAgentsGwangju: 0,
          totalEvaluations: 0,
          watchlistYongsan: 0,
          watchlistGwangju: 0,
          attitudeErrorRate: 0,
          businessErrorRate: 0,
          overallErrorRate: 0,
          date: queryDate,
        },
      };
    }
    
    const row = rows[0];
    const attitudeErrorRate = Number(row.attitudeErrorRate) || 0;
    const businessErrorRate = Number(row.businessErrorRate) || 0;
    
    return {
      success: true,
      data: {
        totalAgentsYongsan: Number(row.totalAgentsYongsan) || 0,
        totalAgentsGwangju: Number(row.totalAgentsGwangju) || 0,
        totalEvaluations: Number(row.totalEvaluations) || 0,
        watchlistYongsan: Number(row.watchlistYongsan) || 0,
        watchlistGwangju: Number(row.watchlistGwangju) || 0,
        attitudeErrorRate,
        businessErrorRate,
        overallErrorRate: Number((attitudeErrorRate + businessErrorRate).toFixed(2)),
        date: queryDate,
      },
    };
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
        FROM \`${DATASET_ID}.evaluations\`
        WHERE evaluation_date BETWEEN @startDate AND @endDate
        GROUP BY center
      ),
      service_stats AS (
        SELECT
          center,
          service,
          COUNT(DISTINCT agent_id) as agent_count,
          COUNT(*) as evaluations,
          SUM(attitude_error_count + business_error_count) as total_errors
        FROM \`${DATASET_ID}.evaluations\`
        WHERE evaluation_date BETWEEN @startDate AND @endDate
        GROUP BY center, service
      )
      SELECT
        cs.center,
        cs.evaluations,
        ROUND(SAFE_DIVIDE(cs.attitude_errors, cs.evaluations * 5) * 100, 2) as attitudeErrorRate,
        ROUND(SAFE_DIVIDE(cs.ops_errors, cs.evaluations * 11) * 100, 2) as businessErrorRate,
        ARRAY_AGG(
          STRUCT(
            ss.service as name,
            ss.agent_count as agentCount,
            ROUND(SAFE_DIVIDE(ss.total_errors, ss.evaluations * 16) * 100, 2) as errorRate
          )
        ) as services
      FROM center_stats cs
      LEFT JOIN service_stats ss ON cs.center = ss.center
      GROUP BY cs.center, cs.evaluations, cs.attitude_errors, cs.ops_errors
    `;
    
    const options = {
      query,
      params: { startDate, endDate },
      location: 'asia-northeast3',
    };
    
    const [rows] = await bigquery.query(options);
    
    const result: CenterStats[] = rows.map((row: any) => ({
      name: row.center,
      evaluations: Number(row.evaluations) || 0,
      attitudeErrorRate: Number(row.attitudeErrorRate) || 0,
      businessErrorRate: Number(row.businessErrorRate) || 0,
      errorRate: Number((Number(row.attitudeErrorRate) + Number(row.businessErrorRate)).toFixed(2)),
      services: (row.services || []).map((svc: any) => ({
        name: svc.name,
        agentCount: Number(svc.agentCount) || 0,
        errorRate: Number(svc.errorRate) || 0,
      })),
    }));
    
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
  yongsan: number;
  gwangju: number;
  overall: number;
}

export async function getDailyTrend(days = 14): Promise<{ success: boolean; data?: TrendData[]; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    const query = `
      SELECT
        evaluation_date as date,
        SUM(CASE WHEN center = '용산' THEN attitude_error_count + business_error_count ELSE 0 END) as yongsan_errors,
        SUM(CASE WHEN center = '용산' THEN 1 ELSE 0 END) as yongsan_count,
        SUM(CASE WHEN center = '광주' THEN attitude_error_count + business_error_count ELSE 0 END) as gwangju_errors,
        SUM(CASE WHEN center = '광주' THEN 1 ELSE 0 END) as gwangju_count,
        SUM(attitude_error_count + business_error_count) as total_errors,
        COUNT(*) as total_count
      FROM \`${DATASET_ID}.evaluations\`
      WHERE evaluation_date BETWEEN @startDate AND @endDate
      GROUP BY evaluation_date
      ORDER BY evaluation_date ASC
    `;
    
    const options = {
      query,
      params: { startDate: startDateStr, endDate: endDateStr },
      location: 'asia-northeast3',
    };
    
    const [rows] = await bigquery.query(options);
    
    const result: TrendData[] = rows.map((row: any) => {
      const yongsanRate = row.yongsan_count > 0
        ? Number((Number(row.yongsan_errors) / (Number(row.yongsan_count) * 16) * 100).toFixed(2))
        : 0;
      const gwangjuRate = row.gwangju_count > 0
        ? Number((Number(row.gwangju_errors) / (Number(row.gwangju_count) * 16) * 100).toFixed(2))
        : 0;
      const overallRate = row.total_count > 0
        ? Number((Number(row.total_errors) / (Number(row.total_count) * 16) * 100).toFixed(2))
        : 0;
      
      return {
        date: row.date.value || row.date,
        yongsan: yongsanRate,
        gwangju: gwangjuRate,
        overall: overallRate,
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
}): Promise<{ success: boolean; data?: Agent[]; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    
    // 기본값: 이번 달
    const month = filters?.month || new Date().toISOString().slice(0, 7);
    
    let whereClause = 'WHERE 1=1';
    const params: any = { month };
    
    if (filters?.center && filters.center !== 'all') {
      whereClause += ' AND a.center = @center';
      params.center = filters.center;
    }
    if (filters?.service && filters.service !== 'all') {
      whereClause += ' AND e.service = @service';
      params.service = filters.service;
    }
    if (filters?.channel && filters.channel !== 'all') {
      whereClause += ' AND e.channel = @channel';
      params.channel = filters.channel;
    }
    // tenure 필터는 agents 테이블에 tenure_group 컬럼 있을 때만 활성화
    // if (filters?.tenure && filters.tenure !== 'all') {
    //   whereClause += ' AND a.tenure_group = @tenure';
    //   params.tenure = filters.tenure;
    // }
    
    // WHERE 절 재구성 (evaluations 테이블 기준)
    let evalWhereClause = 'WHERE FORMAT_DATE(\'%Y-%m\', evaluation_date) = @month';
    
    if (filters?.center && filters.center !== 'all') {
      evalWhereClause += ' AND center = @center';
    }
    if (filters?.service && filters.service !== 'all') {
      evalWhereClause += ' AND service = @service';
    }
    if (filters?.channel && filters.channel !== 'all') {
      evalWhereClause += ' AND channel = @channel';
    }
    
    const query = `
      SELECT
        agent_id as id,
        agent_name as name,
        center,
        service,
        channel,
        0 as tenureMonths,
        '' as tenureGroup,
        COUNT(*) as totalEvaluations,
        ROUND(SAFE_DIVIDE(SUM(attitude_error_count), COUNT(*) * 5) * 100, 2) as attitudeErrorRate,
        ROUND(SAFE_DIVIDE(SUM(business_error_count), COUNT(*) * 11) * 100, 2) as opsErrorRate
      FROM \`${DATASET_ID}.evaluations\`
      ${evalWhereClause}
      GROUP BY agent_id, agent_name, center, service, channel
      ORDER BY attitudeErrorRate + opsErrorRate DESC
    `;
    
    const options = {
      query,
      params,
      location: 'asia-northeast3',
    };
    
    const [rows] = await bigquery.query(options);
    
    const result: Agent[] = rows.map((row: any) => {
      const attRate = Number(row.attitudeErrorRate) || 0;
      const opsRate = Number(row.opsErrorRate) || 0;
      
      return {
        id: row.id,
        name: row.name,
        center: row.center,
        service: row.service,
        channel: row.channel,
        tenureMonths: Number(row.tenureMonths) || 0,
        tenureGroup: row.tenureGroup || '',
        isActive: true, // agents 테이블에 is_active 컬럼이 없으므로 기본값
        totalEvaluations: Number(row.totalEvaluations) || 0,
        attitudeErrorRate: attRate,
        opsErrorRate: opsRate,
        overallErrorRate: Number((attRate + opsRate).toFixed(2)),
      };
    });
    
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
      FROM \`${DATASET_ID}.evaluations\`
      WHERE evaluation_date BETWEEN @startDate AND @endDate
      ORDER BY evaluation_date DESC, agent_id
      LIMIT @limit
    `;
    
    const options = {
      query,
      params: { startDate, endDate, limit },
      location: 'asia-northeast3',
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
  evaluationCount: number;
  reason: string;
  topErrors: string[];
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
      WITH agent_errors AS (
        SELECT
          agent_id,
          agent_name,
          center,
          service,
          channel,
          COUNT(*) as evaluation_count,
          SUM(attitude_error_count) as attitude_errors,
          SUM(business_error_count) as ops_errors,
          ROUND(SAFE_DIVIDE(SUM(attitude_error_count), COUNT(*) * 5) * 100, 2) as attitude_rate,
          ROUND(SAFE_DIVIDE(SUM(business_error_count), COUNT(*) * 11) * 100, 2) as ops_rate,
          SUM(CAST(empathy_error AS INT64)) as empathy_errors,
          SUM(CAST(consult_type_error AS INT64)) as consult_type_errors,
          SUM(CAST(guide_error AS INT64)) as guide_errors,
          SUM(CAST(identity_check_error AS INT64)) as identity_check_errors,
          SUM(CAST(flag_keyword_error AS INT64)) as flag_keyword_errors
        FROM \`${DATASET_ID}.evaluations\`
        WHERE FORMAT_DATE('%Y-%m', evaluation_date) = @month
          ${filters?.center && filters.center !== 'all' ? 'AND center = @center' : ''}
          ${filters?.channel && filters.channel !== 'all' ? 'AND channel = @channel' : ''}
        GROUP BY agent_id, agent_name, center, service, channel
      )
      SELECT *
      FROM agent_errors
      WHERE attitude_rate > 5 OR ops_rate > 6
      ORDER BY (attitude_rate + ops_rate) DESC
    `;
    
    const options = {
      query,
      params,
      location: 'asia-northeast3',
    };
    
    const [rows] = await bigquery.query(options);
    
    const result: WatchListItem[] = rows.map((row: any) => {
      const attRate = Number(row.attitude_rate) || 0;
      const opsRate = Number(row.ops_rate) || 0;
      
      // 주요 오류 항목
      const errors = [
        { name: '공감표현누락', count: Number(row.empathy_errors) || 0 },
        { name: '상담유형오설정', count: Number(row.consult_type_errors) || 0 },
        { name: '가이드미준수', count: Number(row.guide_errors) || 0 },
        { name: '본인확인누락', count: Number(row.identity_check_errors) || 0 },
        { name: '플래그키워드누락', count: Number(row.flag_keyword_errors) || 0 },
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
        service: row.service,
        channel: row.channel,
        attitudeRate: attRate,
        opsRate: opsRate,
        totalRate: Number((attRate + opsRate).toFixed(2)),
        evaluationCount: Number(row.evaluation_count) || 0,
        reason,
        topErrors,
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
  periodType: string;
  periodStart: string;
  periodEnd: string;
  isActive: boolean;
}

export async function getGoals(filters?: {
  center?: string;
  periodType?: string;
  isActive?: boolean;
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
        target_name as name,
        center,
        target_type as type,
        target_rate as targetRate,
        period_type as periodType,
        period_start as periodStart,
        period_end as periodEnd,
        is_active as isActive
      FROM \`${DATASET_ID}.targets\`
      ${whereClause}
      ORDER BY period_start DESC, center, target_type
    `;
    
    const options = {
      query,
      params,
      location: 'asia-northeast3',
    };
    
    const [rows] = await bigquery.query(options);
    
    const result: Goal[] = rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      center: row.center,
      type: row.type,
      targetRate: Number(row.targetRate) || 0,
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
    const rows = evaluations.map(evalData => ({
      evaluation_id: `${evalData.agentId}_${evalData.date}_${Date.now()}`,
      evaluation_date: evalData.date,
      center: evalData.center,
      service: evalData.service || '',
      channel: evalData.channel || 'unknown',
      agent_id: evalData.agentId,
      agent_name: evalData.agentName,
      tenure_group: evalData.tenure || '',
      attitude_error_count: evalData.attitudeErrors || 0,
      business_error_count: evalData.businessErrors || 0,
      total_error_count: (evalData.attitudeErrors || 0) + (evalData.businessErrors || 0),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    
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

export default {
  getDashboardStats,
  getCenterStats,
  getDailyTrend,
  getAgents,
  getEvaluations,
  getWatchList,
  getGoals,
  saveEvaluationsToBigQuery,
};
