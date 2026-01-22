import { BigQuery } from '@google-cloud/bigquery';
import { AgentAnalysisContext, GroupAnalysisContext } from './types';

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

export function getBigQueryClient(): BigQuery {
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
  용산_태도: number;
  용산_오상담: number;
  용산_합계: number;
  광주_태도: number;
  광주_오상담: number;
  광주_합계: number;
  목표: number;
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
        -- 용산 데이터
        SUM(CASE WHEN center = '용산' THEN attitude_error_count ELSE 0 END) as yongsan_attitude_errors,
        SUM(CASE WHEN center = '용산' THEN business_error_count ELSE 0 END) as yongsan_business_errors,
        SUM(CASE WHEN center = '용산' THEN 1 ELSE 0 END) as yongsan_count,
        -- 광주 데이터
        SUM(CASE WHEN center = '광주' THEN attitude_error_count ELSE 0 END) as gwangju_attitude_errors,
        SUM(CASE WHEN center = '광주' THEN business_error_count ELSE 0 END) as gwangju_business_errors,
        SUM(CASE WHEN center = '광주' THEN 1 ELSE 0 END) as gwangju_count
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
  trend: number;
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
        FROM \`${DATASET_ID}.evaluations\`
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
        FROM \`${DATASET_ID}.evaluations\`
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
      location: 'asia-northeast3',
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
        service: row.service,
        channel: row.channel,
        attitudeRate: attRate,
        opsRate: opsRate,
        totalRate: totalRate,
        trend: trend,
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
      whereClause += ' AND service = @service'
      params.service = filters.service
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
      FROM \`${DATASET_ID}.evaluations\`
      ${whereClause}
      GROUP BY evaluation_date
      
      UNION ALL
      
      SELECT
        evaluation_date as date,
        'att2' as item_id,
        '공감표현 누락' as item_name,
        SUM(CAST(empathy_error AS INT64)) as error_count
      FROM \`${DATASET_ID}.evaluations\`
      ${whereClause}
      GROUP BY evaluation_date
      
      UNION ALL
      
      SELECT
        evaluation_date as date,
        'att3' as item_id,
        '사과표현 누락' as item_name,
        SUM(CAST(apology_error AS INT64)) as error_count
      FROM \`${DATASET_ID}.evaluations\`
      ${whereClause}
      GROUP BY evaluation_date
      
      UNION ALL
      
      SELECT
        evaluation_date as date,
        'att4' as item_id,
        '추가문의 누락' as item_name,
        SUM(CAST(additional_inquiry_error AS INT64)) as error_count
      FROM \`${DATASET_ID}.evaluations\`
      ${whereClause}
      GROUP BY evaluation_date
      
      UNION ALL
      
      SELECT
        evaluation_date as date,
        'att5' as item_id,
        '불친절' as item_name,
        SUM(CAST(unkind_error AS INT64)) as error_count
      FROM \`${DATASET_ID}.evaluations\`
      ${whereClause}
      GROUP BY evaluation_date
      
      UNION ALL
      
      SELECT
        evaluation_date as date,
        'err1' as item_id,
        '상담유형 오설정' as item_name,
        SUM(CAST(consult_type_error AS INT64)) as error_count
      FROM \`${DATASET_ID}.evaluations\`
      ${whereClause}
      GROUP BY evaluation_date
      
      UNION ALL
      
      SELECT
        evaluation_date as date,
        'err2' as item_id,
        '가이드 미준수' as item_name,
        SUM(CAST(guide_error AS INT64)) as error_count
      FROM \`${DATASET_ID}.evaluations\`
      ${whereClause}
      GROUP BY evaluation_date
      
      UNION ALL
      
      SELECT
        evaluation_date as date,
        'err3' as item_id,
        '본인확인 누락' as item_name,
        SUM(CAST(identity_check_error AS INT64)) as error_count
      FROM \`${DATASET_ID}.evaluations\`
      ${whereClause}
      GROUP BY evaluation_date
      
      UNION ALL
      
      SELECT
        evaluation_date as date,
        'err4' as item_id,
        '필수탐색 누락' as item_name,
        SUM(CAST(required_search_error AS INT64)) as error_count
      FROM \`${DATASET_ID}.evaluations\`
      ${whereClause}
      GROUP BY evaluation_date
      
      UNION ALL
      
      SELECT
        evaluation_date as date,
        'err5' as item_id,
        '오안내' as item_name,
        SUM(CAST(wrong_guide_error AS INT64)) as error_count
      FROM \`${DATASET_ID}.evaluations\`
      ${whereClause}
      GROUP BY evaluation_date
      
      UNION ALL
      
      SELECT
        evaluation_date as date,
        'err6' as item_id,
        '전산 처리 누락' as item_name,
        SUM(CAST(process_missing_error AS INT64)) as error_count
      FROM \`${DATASET_ID}.evaluations\`
      ${whereClause}
      GROUP BY evaluation_date
      
      UNION ALL
      
      SELECT
        evaluation_date as date,
        'err7' as item_id,
        '전산 처리 미완료' as item_name,
        SUM(CAST(process_incomplete_error AS INT64)) as error_count
      FROM \`${DATASET_ID}.evaluations\`
      ${whereClause}
      GROUP BY evaluation_date
      
      UNION ALL
      
      SELECT
        evaluation_date as date,
        'err8' as item_id,
        '전산 조작 미흡' as item_name,
        SUM(CAST(system_error AS INT64)) as error_count
      FROM \`${DATASET_ID}.evaluations\`
      ${whereClause}
      GROUP BY evaluation_date
      
      UNION ALL
      
      SELECT
        evaluation_date as date,
        'err9' as item_id,
        '콜픽트림ID 매핑 누락' as item_name,
        SUM(CAST(id_mapping_error AS INT64)) as error_count
      FROM \`${DATASET_ID}.evaluations\`
      ${whereClause}
      GROUP BY evaluation_date
      
      UNION ALL
      
      SELECT
        evaluation_date as date,
        'err10' as item_id,
        '플래그키워드 누락' as item_name,
        SUM(CAST(flag_keyword_error AS INT64)) as error_count
      FROM \`${DATASET_ID}.evaluations\`
      ${whereClause}
      GROUP BY evaluation_date
      
      UNION ALL
      
      SELECT
        evaluation_date as date,
        'err11' as item_id,
        '상담이력 기재 미흡' as item_name,
        SUM(CAST(history_error AS INT64)) as error_count
      FROM \`${DATASET_ID}.evaluations\`
      ${whereClause}
      GROUP BY evaluation_date
      
      ORDER BY date DESC, item_id
    `
    
    const options = {
      query,
      params,
      location: 'asia-northeast3',
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
      whereClause += ' AND service = @service'
      params.service = filters.service
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
        FROM \`${DATASET_ID}.evaluations\`
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
        FROM \`${DATASET_ID}.evaluations\`
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
        FROM \`${DATASET_ID}.evaluations\`
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
        FROM \`${DATASET_ID}.evaluations\`
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
        FROM \`${DATASET_ID}.evaluations\`
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
        FROM \`${DATASET_ID}.evaluations\`
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
        FROM \`${DATASET_ID}.evaluations\`
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
        FROM \`${DATASET_ID}.evaluations\`
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
        FROM \`${DATASET_ID}.evaluations\`
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
        FROM \`${DATASET_ID}.evaluations\`
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
        FROM \`${DATASET_ID}.evaluations\`
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
        FROM \`${DATASET_ID}.evaluations\`
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
        FROM \`${DATASET_ID}.evaluations\`
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
        FROM \`${DATASET_ID}.evaluations\`
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
        FROM \`${DATASET_ID}.evaluations\`
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
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        GROUP BY week, year, week_num
      )
      SELECT
        week,
        year,
        week_num,
        item_id,
        item_name,
        error_count,
        ROUND(SAFE_DIVIDE(error_count, total_evaluations) * 100, 1) as error_rate
      FROM weekly_data
      ORDER BY year DESC, week_num DESC, item_id
    `
    
    const options = {
      query,
      params,
      location: 'asia-northeast3',
    }
    
    const [rows] = await bigquery.query(options)
    
    // 주차별로 그룹화
    const weekMap = new Map<string, WeeklyErrorData>()
    
    rows.forEach((row: any) => {
      const week = row.week
      const weekLabel = `${row.year}년 ${row.week_num}주차`
      
      if (!weekMap.has(week)) {
        weekMap.set(week, {
          week,
          weekLabel,
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
      whereClause += ' AND service = @service'
      params.service = filters.service
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
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        
        UNION ALL
        
        SELECT
          'att2' as item_id,
          '공감표현 누락' as item_name,
          '상담태도' as category,
          SUM(CAST(empathy_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        
        UNION ALL
        
        SELECT
          'att3' as item_id,
          '사과표현 누락' as item_name,
          '상담태도' as category,
          SUM(CAST(apology_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        
        UNION ALL
        
        SELECT
          'att4' as item_id,
          '추가문의 누락' as item_name,
          '상담태도' as category,
          SUM(CAST(additional_inquiry_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        
        UNION ALL
        
        SELECT
          'att5' as item_id,
          '불친절' as item_name,
          '상담태도' as category,
          SUM(CAST(unkind_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        
        UNION ALL
        
        SELECT
          'err1' as item_id,
          '상담유형 오설정' as item_name,
          '오상담/오처리' as category,
          SUM(CAST(consult_type_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        
        UNION ALL
        
        SELECT
          'err2' as item_id,
          '가이드 미준수' as item_name,
          '오상담/오처리' as category,
          SUM(CAST(guide_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        
        UNION ALL
        
        SELECT
          'err3' as item_id,
          '본인확인 누락' as item_name,
          '오상담/오처리' as category,
          SUM(CAST(identity_check_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        
        UNION ALL
        
        SELECT
          'err4' as item_id,
          '필수탐색 누락' as item_name,
          '오상담/오처리' as category,
          SUM(CAST(required_search_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        
        UNION ALL
        
        SELECT
          'err5' as item_id,
          '오안내' as item_name,
          '오상담/오처리' as category,
          SUM(CAST(wrong_guide_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        
        UNION ALL
        
        SELECT
          'err6' as item_id,
          '전산 처리 누락' as item_name,
          '오상담/오처리' as category,
          SUM(CAST(process_missing_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        
        UNION ALL
        
        SELECT
          'err7' as item_id,
          '전산 처리 미완료' as item_name,
          '오상담/오처리' as category,
          SUM(CAST(process_incomplete_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        
        UNION ALL
        
        SELECT
          'err8' as item_id,
          '전산 조작 미흡' as item_name,
          '오상담/오처리' as category,
          SUM(CAST(system_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        
        UNION ALL
        
        SELECT
          'err9' as item_id,
          '콜픽트림ID 매핑 누락' as item_name,
          '오상담/오처리' as category,
          SUM(CAST(id_mapping_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        
        UNION ALL
        
        SELECT
          'err10' as item_id,
          '플래그키워드 누락' as item_name,
          '오상담/오처리' as category,
          SUM(CAST(flag_keyword_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM \`${DATASET_ID}.evaluations\`
        ${whereClause}
        
        UNION ALL
        
        SELECT
          'err11' as item_id,
          '상담이력 기재 미흡' as item_name,
          '오상담/오처리' as category,
          SUM(CAST(history_error AS INT64)) as error_count,
          COUNT(*) as total_evaluations
        FROM \`${DATASET_ID}.evaluations\`
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
      location: 'asia-northeast3',
    }
    
    const [rows] = await bigquery.query(options)
    
    // 전일 데이터로 trend 계산 (간단히 0으로 설정, 추후 개선 가능)
    const result: ItemErrorStats[] = rows.map((row: any) => ({
      itemId: row.item_id,
      itemName: row.item_name,
      category: row.category as "상담태도" | "오상담/오처리",
      errorCount: Number(row.error_count) || 0,
      errorRate: Number(row.error_rate) || 0,
      trend: 0, // TODO: 전일 대비 계산
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
      FROM \`${DATASET_ID}.evaluations\`
      ${whereClause}
      LIMIT 10
    `;
    
    const options = {
      query,
      params,
      location: 'asia-northeast3',
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
      FROM \`${DATASET_ID}.evaluations\`
      WHERE agent_id = @agentId
        AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
      GROUP BY agent_id, agent_name, center, service, channel
      LIMIT 1
    `;
    
    const [rows] = await bigquery.query({
      query,
      params: { agentId, month },
      location: 'asia-northeast3',
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
      service: row.service,
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
      FROM \`${DATASET_ID}.evaluations\`
      WHERE center = @center
        AND service = @service
        AND channel = @channel
        AND FORMAT_DATE('%Y-%m', evaluation_date) = @month
      GROUP BY center, service, channel
      LIMIT 1
    `;
    
    const [rows] = await bigquery.query({
      query,
      params: { center, service, channel, month },
      location: 'asia-northeast3',
    });
    
    if (rows.length === 0) {
      return { success: false, error: 'Group not found' };
    }
    
    const row = rows[0];
    const attitudeRate = Number(row.attitude_error_rate) || 0;
    const opsRate = Number(row.ops_error_rate) || 0;
    
    const context: GroupAnalysisContext = {
      center: row.center,
      service: row.service,
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
    
    if (center) {
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
      FROM \`${DATASET_ID}.evaluations\`
      ${whereClause}
    `;
    
    const [rows] = await bigquery.query({
      query,
      params,
      location: 'asia-northeast3',
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
  type: string;
  targetRate: number;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  isActive: boolean;
}): Promise<{ success: boolean; saved?: number; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    
    const isUpdate = !!goal.id;
    
    if (isUpdate) {
      const query = `
        UPDATE \`${DATASET_ID}.targets\`
        SET
          target_name = @name,
          center = @center,
          target_type = @type,
          target_rate = @targetRate,
          period_type = @periodType,
          period_start = @periodStart,
          period_end = @periodEnd,
          is_active = @isActive
        WHERE target_id = @id
      `;
      
      const [result] = await bigquery.query({
        query,
        params: {
          id: goal.id,
          name: goal.name,
          center: goal.center,
          type: goal.type,
          targetRate: goal.targetRate,
          periodType: goal.periodType,
          periodStart: goal.periodStart,
          periodEnd: goal.periodEnd,
          isActive: goal.isActive,
        },
        types: {
          id: 'STRING',
          name: 'STRING',
          center: 'STRING',
          type: 'STRING',
          targetRate: 'FLOAT64',
          periodType: 'STRING',
          periodStart: 'DATE',
          periodEnd: 'DATE',
          isActive: 'BOOL',
        },
        location: 'asia-northeast3',
      });
      
      return { success: true, saved: 1 };
    } else {
      const query = `
        INSERT INTO \`${DATASET_ID}.targets\`
        (target_name, center, target_type, target_rate, period_type, period_start, period_end, is_active)
        VALUES
        (@name, @center, @type, @targetRate, @periodType, @periodStart, @periodEnd, @isActive)
      `;
      
      const [result] = await bigquery.query({
        query,
        params: {
          name: goal.name,
          center: goal.center,
          type: goal.type,
          targetRate: goal.targetRate,
          periodType: goal.periodType,
          periodStart: goal.periodStart,
          periodEnd: goal.periodEnd,
          isActive: goal.isActive,
        },
        types: {
          name: 'STRING',
          center: 'STRING',
          type: 'STRING',
          targetRate: 'FLOAT64',
          periodType: 'STRING',
          periodStart: 'DATE',
          periodEnd: 'DATE',
          isActive: 'BOOL',
        },
        location: 'asia-northeast3',
      });
      
      return { success: true, saved: 1 };
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
  center?: string,
  service?: string,
  channel?: string,
  startDate?: string,
  endDate?: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const bigquery = getBigQueryClient();
    
    // 리포트 타입에 따라 다른 쿼리 실행
    // 기본적으로 대시보드 통계를 반환
    if (type === 'dashboard') {
      const stats = await getDashboardStats(startDate);
      return stats;
    } else if (type === 'agents') {
      const agents = await getAgents({ center, service, channel });
      return agents;
    } else if (type === 'errors') {
      const errors = await getDailyErrors({ startDate, endDate, center, service, channel });
      return errors;
    } else {
      // 기본 리포트 데이터
      const stats = await getDashboardStats(startDate);
      return stats;
    }
  } catch (error) {
    console.error('[BigQuery] getReportData error:', error);
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
  getDailyErrors,
  getWeeklyErrors,
  getItemErrorStats,
  saveEvaluationsToBigQuery,
  checkAgentExists,
  getAgentAnalysisData,
  getGroupAnalysisData,
  getGoalCurrentRate,
  saveGoalToBigQuery,
  getReportData,
  getBigQueryClient,
};
