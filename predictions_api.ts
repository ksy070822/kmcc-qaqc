/**
 * 예측 모델 로직
 * /app/api/predictions/route.ts 에 추가할 코드
 * 
 * 기능:
 * - 월말 예측값 계산
 * - 위험도 판정
 * - 밀접관리 대상 자동 식별
 */

import { BigQuery } from '@google-cloud/bigquery';

// ============================================================
// 타입 정의
// ============================================================

interface WeeklyMetrics {
  week: string;  // W1, W2, W3, W4
  checks: number;
  attitudeRate: number;
  opsRate: number;
}

interface PredictionResult {
  dimensionType: string;
  dimensionValue: string;
  center: string;
  
  // 현재 상태
  currentChecks: number;
  currentAttitudeRate: number;
  currentOpsRate: number;
  
  // 주차별 추이
  weeklyMetrics: WeeklyMetrics[];
  
  // 예측
  predictedAttitudeRate: number;
  predictedOpsRate: number;
  w4PredictedAttitude: number;
  w4PredictedOps: number;
  
  // 목표
  targetAttitudeRate: number;
  targetOpsRate: number;
  
  // 판정
  attitudeGap: number;
  opsGap: number;
  attitudeAchievementProb: number;
  opsAchievementProb: number;
  attitudeTrend: 'improving' | 'stable' | 'worsening';
  opsTrend: 'improving' | 'stable' | 'worsening';
  attitudeRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  opsRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  
  // 밀접관리
  alertFlag: boolean;
  alertReason: string | null;
}

interface WatchListItem {
  dimensionType: string;
  dimensionValue: string;
  center: string;
  agentId?: string;
  agentName?: string;
  service?: string;
  channel?: string;
  reason: string;
  riskFactors: string[];
  currentChecks: number;
  attitudeRate: number;
  opsRate: number;
  rateChangeFromPrev: number;
}

// ============================================================
// 예측 함수들
// ============================================================

/**
 * 월말 예측값 계산
 */
function predictMonthEnd(
  currentRate: number,
  weeklyRates: number[],
  daysPassed: number = 19,
  daysRemaining: number = 12
): { predicted: number; w4Predicted: number } {
  const totalDays = 31;
  
  if (weeklyRates.length < 2) {
    return { predicted: currentRate, w4Predicted: currentRate };
  }
  
  // W4 예측: 최근 추세 반영
  const weeklyChange = weeklyRates[weeklyRates.length - 1] - weeklyRates[weeklyRates.length - 2];
  const w4Predicted = Math.max(0, weeklyRates[weeklyRates.length - 1] + weeklyChange);
  
  // 월말 예측: 가중 평균
  const predicted = (currentRate * daysPassed + w4Predicted * daysRemaining) / totalDays;
  
  return { predicted, w4Predicted };
}

/**
 * 추세 판정
 */
function determineTrend(weeklyRates: number[]): 'improving' | 'stable' | 'worsening' {
  if (weeklyRates.length < 2) return 'stable';
  
  const recentChange = weeklyRates[weeklyRates.length - 1] - weeklyRates[weeklyRates.length - 2];
  
  if (recentChange < -0.3) return 'improving';
  if (recentChange > 0.3) return 'worsening';
  return 'stable';
}

/**
 * 목표 달성 확률 계산 (정규분포 가정)
 */
function calculateAchievementProb(
  predicted: number,
  target: number,
  weeklyRates: number[]
): number {
  if (weeklyRates.length < 2) {
    return predicted <= target ? 70 : 30;
  }
  
  // 표준편차 계산
  const mean = weeklyRates.reduce((a, b) => a + b, 0) / weeklyRates.length;
  const variance = weeklyRates.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / weeklyRates.length;
  const stdDev = Math.sqrt(variance) || 0.5;
  
  // Z-score
  const zScore = (target - predicted) / stdDev;
  
  // 정규분포 CDF 근사 (간단한 근사식)
  const prob = 0.5 * (1 + Math.tanh(0.797885 * zScore));
  
  return Math.round(prob * 100);
}

/**
 * 위험도 레벨 판정
 */
function determineRiskLevel(
  predicted: number,
  target: number,
  trend: 'improving' | 'stable' | 'worsening',
  achievementProb: number
): 'low' | 'medium' | 'high' | 'critical' {
  if (achievementProb >= 70 && (trend === 'improving' || trend === 'stable')) {
    return 'low';
  }
  if (achievementProb >= 40 && predicted <= target * 1.1) {
    return 'medium';
  }
  if (achievementProb >= 20 || predicted <= target * 1.3) {
    return 'high';
  }
  return 'critical';
}

/**
 * 밀접관리 대상 여부 판정
 */
function determineAlertStatus(
  prediction: Partial<PredictionResult>,
  prevWeekRate?: number
): { alertFlag: boolean; alertReason: string | null } {
  const reasons: string[] = [];
  
  // 1. 목표 달성 확률 30% 미만
  if (prediction.attitudeAchievementProb! < 30 || prediction.opsAchievementProb! < 30) {
    reasons.push('목표 달성 확률 30% 미만');
  }
  
  // 2. 급격한 악화 (전주 대비 50% 이상 증가)
  if (prevWeekRate && prediction.currentAttitudeRate!) {
    const changeRate = (prediction.currentAttitudeRate! - prevWeekRate) / prevWeekRate;
    if (changeRate > 0.5) {
      reasons.push('전주 대비 50% 이상 급등');
    }
  }
  
  // 3. 악화 추세 + 목표 초과
  if (prediction.attitudeTrend === 'worsening' && prediction.attitudeGap! > 0) {
    reasons.push('악화 추세 + 목표 초과');
  }
  if (prediction.opsTrend === 'worsening' && prediction.opsGap! > 0) {
    reasons.push('오상담 악화 추세 + 목표 초과');
  }
  
  // 4. Critical 위험도
  if (prediction.overallRiskLevel === 'critical') {
    reasons.push('위험도 Critical');
  }
  
  return {
    alertFlag: reasons.length > 0,
    alertReason: reasons.length > 0 ? reasons.join(', ') : null
  };
}

// ============================================================
// 메인 예측 함수
// ============================================================

/**
 * 그룹/상담사별 월말 예측 계산
 */
export async function calculatePredictions(
  bigquery: BigQuery,
  targetMonth: string,  // '2026-01'
  targets: { attitude: number; ops: number }
): Promise<PredictionResult[]> {
  const projectId = process.env.BIGQUERY_PROJECT_ID || 'csopp-25f2';
  const datasetId = process.env.BIGQUERY_DATASET_ID || 'KMCC_QC';
  
  // 현재 날짜 기준 경과일/잔여일 계산
  const today = new Date();
  const daysPassed = today.getDate();
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysRemaining = lastDay - daysPassed;
  
  // 주차 계산 함수
  const getWeek = (day: number): string => {
    if (day <= 5) return 'W1';
    if (day <= 12) return 'W2';
    if (day <= 19) return 'W3';
    return 'W4';
  };
  
  // 쿼리: 서비스_채널별 주차별 집계
  const query = `
    WITH weekly_data AS (
      SELECT
        center,
        CONCAT(service, '_', channel) as service_channel,
        CASE
          WHEN EXTRACT(DAY FROM evaluation_date) <= 5 THEN 'W1'
          WHEN EXTRACT(DAY FROM evaluation_date) <= 12 THEN 'W2'
          WHEN EXTRACT(DAY FROM evaluation_date) <= 19 THEN 'W3'
          ELSE 'W4'
        END as week,
        COUNT(*) as checks,
        ROUND(SUM(attitude_error_count) / (COUNT(*) * 5) * 100, 2) as attitude_rate,
        ROUND(SUM(business_error_count) / (COUNT(*) * 11) * 100, 2) as ops_rate
      FROM \`${projectId}.${datasetId}.evaluations\`
      WHERE FORMAT_DATE('%Y-%m', evaluation_date) = '${targetMonth}'
      GROUP BY center, service_channel, week
    ),
    current_totals AS (
      SELECT
        center,
        CONCAT(service, '_', channel) as service_channel,
        COUNT(*) as total_checks,
        ROUND(SUM(attitude_error_count) / (COUNT(*) * 5) * 100, 2) as current_attitude_rate,
        ROUND(SUM(business_error_count) / (COUNT(*) * 11) * 100, 2) as current_ops_rate
      FROM \`${projectId}.${datasetId}.evaluations\`
      WHERE FORMAT_DATE('%Y-%m', evaluation_date) = '${targetMonth}'
      GROUP BY center, service_channel
    )
    SELECT
      ct.center,
      ct.service_channel,
      ct.total_checks,
      ct.current_attitude_rate,
      ct.current_ops_rate,
      wd.week,
      wd.checks as week_checks,
      wd.attitude_rate as week_attitude_rate,
      wd.ops_rate as week_ops_rate
    FROM current_totals ct
    LEFT JOIN weekly_data wd
      ON ct.center = wd.center AND ct.service_channel = wd.service_channel
    ORDER BY ct.center, ct.service_channel, wd.week
  `;
  
  const [rows] = await bigquery.query({ query });
  
  // 결과 처리
  const groupedData: Map<string, any> = new Map();
  
  for (const row of rows) {
    const key = `${row.center}_${row.service_channel}`;
    
    if (!groupedData.has(key)) {
      groupedData.set(key, {
        center: row.center,
        serviceChannel: row.service_channel,
        totalChecks: row.total_checks,
        currentAttitudeRate: row.current_attitude_rate,
        currentOpsRate: row.current_ops_rate,
        weeklyAttitude: [],
        weeklyOps: []
      });
    }
    
    if (row.week) {
      const data = groupedData.get(key);
      data.weeklyAttitude.push({ week: row.week, rate: row.week_attitude_rate });
      data.weeklyOps.push({ week: row.week, rate: row.week_ops_rate });
    }
  }
  
  // 예측 계산
  const predictions: PredictionResult[] = [];
  
  for (const [key, data] of groupedData) {
    // 주차별 오류율 배열
    const weeklyAttRates = data.weeklyAttitude
      .sort((a: any, b: any) => a.week.localeCompare(b.week))
      .map((w: any) => w.rate);
    const weeklyOpsRates = data.weeklyOps
      .sort((a: any, b: any) => a.week.localeCompare(b.week))
      .map((w: any) => w.rate);
    
    // 월말 예측
    const attPred = predictMonthEnd(data.currentAttitudeRate, weeklyAttRates, daysPassed, daysRemaining);
    const opsPred = predictMonthEnd(data.currentOpsRate, weeklyOpsRates, daysPassed, daysRemaining);
    
    // 추세 판정
    const attTrend = determineTrend(weeklyAttRates);
    const opsTrend = determineTrend(weeklyOpsRates);
    
    // 달성 확률
    const attProb = calculateAchievementProb(attPred.predicted, targets.attitude, weeklyAttRates);
    const opsProb = calculateAchievementProb(opsPred.predicted, targets.ops, weeklyOpsRates);
    
    // 위험도
    const attRisk = determineRiskLevel(attPred.predicted, targets.attitude, attTrend, attProb);
    const opsRisk = determineRiskLevel(opsPred.predicted, targets.ops, opsTrend, opsProb);
    
    // 종합 위험도
    const riskPriority = { critical: 4, high: 3, medium: 2, low: 1 };
    const overallRisk = riskPriority[attRisk] >= riskPriority[opsRisk] ? attRisk : opsRisk;
    
    const prediction: PredictionResult = {
      dimensionType: 'service_channel',
      dimensionValue: data.serviceChannel,
      center: data.center,
      
      currentChecks: data.totalChecks,
      currentAttitudeRate: data.currentAttitudeRate,
      currentOpsRate: data.currentOpsRate,
      
      weeklyMetrics: data.weeklyAttitude.map((w: any, i: number) => ({
        week: w.week,
        checks: 0,  // TODO: 주차별 건수
        attitudeRate: w.rate,
        opsRate: data.weeklyOps[i]?.rate || 0
      })),
      
      predictedAttitudeRate: Math.round(attPred.predicted * 100) / 100,
      predictedOpsRate: Math.round(opsPred.predicted * 100) / 100,
      w4PredictedAttitude: Math.round(attPred.w4Predicted * 100) / 100,
      w4PredictedOps: Math.round(opsPred.w4Predicted * 100) / 100,
      
      targetAttitudeRate: targets.attitude,
      targetOpsRate: targets.ops,
      
      attitudeGap: Math.round((attPred.predicted - targets.attitude) * 100) / 100,
      opsGap: Math.round((opsPred.predicted - targets.ops) * 100) / 100,
      attitudeAchievementProb: attProb,
      opsAchievementProb: opsProb,
      attitudeTrend: attTrend,
      opsTrend: opsTrend,
      attitudeRiskLevel: attRisk,
      opsRiskLevel: opsRisk,
      overallRiskLevel: overallRisk,
      
      alertFlag: false,
      alertReason: null
    };
    
    // 밀접관리 여부
    const alertStatus = determineAlertStatus(prediction);
    prediction.alertFlag = alertStatus.alertFlag;
    prediction.alertReason = alertStatus.alertReason;
    
    predictions.push(prediction);
  }
  
  return predictions;
}

/**
 * 밀접관리 대상 상담사 목록 조회
 */
export async function getWatchListAgents(
  bigquery: BigQuery,
  targetMonth: string,
  targets: { attitude: number; ops: number }
): Promise<WatchListItem[]> {
  const projectId = process.env.BIGQUERY_PROJECT_ID || 'csopp-25f2';
  const datasetId = process.env.BIGQUERY_DATASET_ID || 'KMCC_QC';
  
  // 고위험 상담사 조회 (태도 5% 초과 또는 오상담 6% 초과)
  const query = `
    WITH agent_stats AS (
      SELECT
        agent_id,
        agent_name,
        center,
        service,
        channel,
        tenure_months,
        tenure_group,
        COUNT(*) as total_checks,
        SUM(attitude_error_count) as attitude_errors,
        SUM(business_error_count) as ops_errors,
        ROUND(SUM(attitude_error_count) / (COUNT(*) * 5) * 100, 2) as attitude_rate,
        ROUND(SUM(business_error_count) / (COUNT(*) * 11) * 100, 2) as ops_rate,
        -- 항목별 오류 건수
        SUM(CAST(greeting_error AS INT64)) as greeting_errors,
        SUM(CAST(empathy_error AS INT64)) as empathy_errors,
        SUM(CAST(apology_error AS INT64)) as apology_errors,
        SUM(CAST(additional_inquiry_error AS INT64)) as additional_inquiry_errors,
        SUM(CAST(unkind_error AS INT64)) as unkind_errors,
        SUM(CAST(consult_type_error AS INT64)) as consult_type_errors,
        SUM(CAST(guide_error AS INT64)) as guide_errors,
        SUM(CAST(identity_check_error AS INT64)) as identity_check_errors,
        SUM(CAST(flag_keyword_error AS INT64)) as flag_keyword_errors,
        SUM(CAST(history_error AS INT64)) as history_errors
      FROM \`${projectId}.${datasetId}.evaluations\`
      WHERE FORMAT_DATE('%Y-%m', evaluation_date) = '${targetMonth}'
      GROUP BY agent_id, agent_name, center, service, channel, tenure_months, tenure_group
    )
    SELECT *
    FROM agent_stats
    WHERE attitude_rate > 5 OR ops_rate > 6
    ORDER BY attitude_rate + ops_rate DESC
  `;
  
  const [rows] = await bigquery.query({ query });
  
  const watchList: WatchListItem[] = rows.map((row: any) => {
    // 주요 오류 항목 식별
    const errorItems: { name: string; count: number }[] = [
      { name: '공감표현누락', count: row.empathy_errors },
      { name: '상담유형오설정', count: row.consult_type_errors },
      { name: '플래그키워드누락', count: row.flag_keyword_errors },
      { name: '상담이력기재미흡', count: row.history_errors },
      { name: '본인확인누락', count: row.identity_check_errors },
      { name: '가이드미준수', count: row.guide_errors },
    ].filter(e => e.count > 0).sort((a, b) => b.count - a.count);
    
    const riskFactors = errorItems.slice(0, 3).map(e => `${e.name}(${e.count})`);
    
    // 등록 사유 판정
    let reason = '';
    if (row.attitude_rate > 10) {
      reason = '태도 오류율 10% 초과';
    } else if (row.ops_rate > 10) {
      reason = '오상담 오류율 10% 초과';
    } else if (row.attitude_rate > 5) {
      reason = '태도 오류율 5% 초과';
    } else {
      reason = '오상담 오류율 6% 초과';
    }
    
    return {
      dimensionType: 'agent',
      dimensionValue: row.agent_id,
      center: row.center,
      agentId: row.agent_id,
      agentName: row.agent_name,
      service: row.service,
      channel: row.channel,
      reason,
      riskFactors,
      currentChecks: row.total_checks,
      attitudeRate: row.attitude_rate,
      opsRate: row.ops_rate,
      rateChangeFromPrev: 0  // TODO: 전주 대비 계산
    };
  });
  
  return watchList;
}

// ============================================================
// API Route Handler (Next.js)
// ============================================================

/*
// /app/api/predictions/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { calculatePredictions, getWatchListAgents } from '@/lib/predictions';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);
  const center = searchParams.get('center');
  
  try {
    const bigquery = new BigQuery({
      projectId: process.env.BIGQUERY_PROJECT_ID,
      credentials: JSON.parse(process.env.BIGQUERY_CREDENTIALS || '{}')
    });
    
    // 목표값 (TODO: targets 테이블에서 조회)
    const targets = center === '광주' 
      ? { attitude: 2.7, ops: 1.7 }
      : { attitude: 3.3, ops: 3.9 };
    
    const predictions = await calculatePredictions(bigquery, month, targets);
    const watchList = await getWatchListAgents(bigquery, month, targets);
    
    // 센터 필터
    const filteredPredictions = center 
      ? predictions.filter(p => p.center === center)
      : predictions;
    
    const filteredWatchList = center
      ? watchList.filter(w => w.center === center)
      : watchList;
    
    return NextResponse.json({
      success: true,
      data: {
        month,
        predictions: filteredPredictions,
        watchList: filteredWatchList,
        summary: {
          totalGroups: filteredPredictions.length,
          atRiskGroups: filteredPredictions.filter(p => p.alertFlag).length,
          totalWatchList: filteredWatchList.length
        }
      }
    });
  } catch (error) {
    console.error('Prediction error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to calculate predictions' },
      { status: 500 }
    );
  }
}
*/
