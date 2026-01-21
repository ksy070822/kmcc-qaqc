import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

// CORS 헤더
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// BigQuery 클라이언트 초기화
function getBigQueryClient(): BigQuery {
  const projectId = process.env.BIGQUERY_PROJECT_ID || 'splyquizkm';
  
  if (process.env.BIGQUERY_CREDENTIALS) {
    try {
      const credentials = JSON.parse(process.env.BIGQUERY_CREDENTIALS);
      return new BigQuery({ projectId, credentials });
    } catch (error) {
      console.error('[BigQuery] Failed to parse credentials');
    }
  }
  
  return new BigQuery({ projectId });
}

const DATASET_ID = process.env.BIGQUERY_DATASET_ID || 'KMCC_QC';

// 예측 함수들
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
  
  const weeklyChange = weeklyRates[weeklyRates.length - 1] - weeklyRates[weeklyRates.length - 2];
  const w4Predicted = Math.max(0, weeklyRates[weeklyRates.length - 1] + weeklyChange);
  const predicted = (currentRate * daysPassed + w4Predicted * daysRemaining) / totalDays;
  
  return { predicted, w4Predicted };
}

function determineTrend(weeklyRates: number[]): 'improving' | 'stable' | 'worsening' {
  if (weeklyRates.length < 2) return 'stable';
  
  const recentChange = weeklyRates[weeklyRates.length - 1] - weeklyRates[weeklyRates.length - 2];
  
  if (recentChange < -0.3) return 'improving';
  if (recentChange > 0.3) return 'worsening';
  return 'stable';
}

function calculateAchievementProb(
  predicted: number,
  target: number,
  weeklyRates: number[]
): number {
  if (weeklyRates.length < 2) {
    return predicted <= target ? 70 : 30;
  }
  
  const mean = weeklyRates.reduce((a, b) => a + b, 0) / weeklyRates.length;
  const variance = weeklyRates.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / weeklyRates.length;
  const stdDev = Math.sqrt(variance) || 0.5;
  const zScore = (target - predicted) / stdDev;
  const prob = 0.5 * (1 + Math.tanh(0.797885 * zScore));
  
  return Math.round(prob * 100);
}

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

// GET /api/predictions?month=2026-01&center=용산
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);
  const center = searchParams.get('center');
  
  try {
    console.log('[API] Predictions request:', { month, center });
    
    const bigquery = getBigQueryClient();
    
    // 현재 날짜 기준 경과일/잔여일 계산
    const today = new Date();
    const daysPassed = today.getDate();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysRemaining = lastDay - daysPassed;
    
    // 목표값 조회
    const targetQuery = `
      SELECT center, target_type, target_rate
      FROM \`${DATASET_ID}.targets\`
      WHERE period_type = 'monthly'
        AND period_start <= CURRENT_DATE()
        AND period_end >= CURRENT_DATE()
        AND is_active = TRUE
    `;
    
    const [targetRows] = await bigquery.query({
      query: targetQuery,
      location: 'asia-northeast3',
    });
    
    const targets: Record<string, { attitude: number; ops: number }> = {};
    targetRows.forEach((row: any) => {
      if (!targets[row.center || 'all']) {
        targets[row.center || 'all'] = { attitude: 3.0, ops: 3.0 };
      }
      if (row.target_type === 'attitude') {
        targets[row.center || 'all'].attitude = Number(row.target_rate);
      } else if (row.target_type === 'ops') {
        targets[row.center || 'all'].ops = Number(row.target_rate);
      }
    });
    
    // 기본 목표값 (targets 테이블에 없는 경우)
    if (!targets['용산']) targets['용산'] = { attitude: 3.3, ops: 3.9 };
    if (!targets['광주']) targets['광주'] = { attitude: 2.7, ops: 1.7 };
    if (!targets['all']) targets['all'] = { attitude: 3.0, ops: 3.0 };
    
    // 주차별 데이터 조회
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
          ROUND(SAFE_DIVIDE(SUM(attitude_error_count), COUNT(*) * 5) * 100, 2) as attitude_rate,
          ROUND(SAFE_DIVIDE(SUM(business_error_count), COUNT(*) * 11) * 100, 2) as ops_rate
        FROM \`${DATASET_ID}.evaluations\`
        WHERE FORMAT_DATE('%Y-%m', evaluation_date) = @month
        GROUP BY center, service_channel, week
      ),
      current_totals AS (
        SELECT
          center,
          CONCAT(service, '_', channel) as service_channel,
          COUNT(*) as total_checks,
          ROUND(SAFE_DIVIDE(SUM(attitude_error_count), COUNT(*) * 5) * 100, 2) as current_attitude_rate,
          ROUND(SAFE_DIVIDE(SUM(business_error_count), COUNT(*) * 11) * 100, 2) as current_ops_rate
        FROM \`${DATASET_ID}.evaluations\`
        WHERE FORMAT_DATE('%Y-%m', evaluation_date) = @month
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
    
    const [rows] = await bigquery.query({
      query,
      params: { month },
      location: 'asia-northeast3',
    });
    
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
    const predictions: any[] = [];
    
    for (const [key, data] of groupedData) {
      const centerTargets = targets[data.center] || targets['all'];
      
      const weeklyAttRates = data.weeklyAttitude
        .sort((a: any, b: any) => a.week.localeCompare(b.week))
        .map((w: any) => w.rate);
      const weeklyOpsRates = data.weeklyOps
        .sort((a: any, b: any) => a.week.localeCompare(b.week))
        .map((w: any) => w.rate);
      
      const attPred = predictMonthEnd(data.currentAttitudeRate, weeklyAttRates, daysPassed, daysRemaining);
      const opsPred = predictMonthEnd(data.currentOpsRate, weeklyOpsRates, daysPassed, daysRemaining);
      
      const attTrend = determineTrend(weeklyAttRates);
      const opsTrend = determineTrend(weeklyOpsRates);
      
      const attProb = calculateAchievementProb(attPred.predicted, centerTargets.attitude, weeklyAttRates);
      const opsProb = calculateAchievementProb(opsPred.predicted, centerTargets.ops, weeklyOpsRates);
      
      const attRisk = determineRiskLevel(attPred.predicted, centerTargets.attitude, attTrend, attProb);
      const opsRisk = determineRiskLevel(opsPred.predicted, centerTargets.ops, opsTrend, opsProb);
      
      const riskPriority: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
      const overallRisk = riskPriority[attRisk] >= riskPriority[opsRisk] ? attRisk : opsRisk;
      
      const alertFlag = attProb < 30 || opsProb < 30 || overallRisk === 'critical';
      
      predictions.push({
        center: data.center,
        serviceChannel: data.serviceChannel,
        currentChecks: data.totalChecks,
        currentAttitudeRate: data.currentAttitudeRate,
        currentOpsRate: data.currentOpsRate,
        predictedAttitudeRate: Math.round(attPred.predicted * 100) / 100,
        predictedOpsRate: Math.round(opsPred.predicted * 100) / 100,
        w4PredictedAttitude: Math.round(attPred.w4Predicted * 100) / 100,
        w4PredictedOps: Math.round(opsPred.w4Predicted * 100) / 100,
        targetAttitudeRate: centerTargets.attitude,
        targetOpsRate: centerTargets.ops,
        attitudeGap: Math.round((attPred.predicted - centerTargets.attitude) * 100) / 100,
        opsGap: Math.round((opsPred.predicted - centerTargets.ops) * 100) / 100,
        attitudeAchievementProb: attProb,
        opsAchievementProb: opsProb,
        attitudeTrend: attTrend,
        opsTrend: opsTrend,
        attitudeRiskLevel: attRisk,
        opsRiskLevel: opsRisk,
        overallRiskLevel: overallRisk,
        alertFlag,
        weeklyMetrics: data.weeklyAttitude.map((w: any, i: number) => ({
          week: w.week,
          attitudeRate: w.rate,
          opsRate: data.weeklyOps[i]?.rate || 0,
        })),
      });
    }
    
    // 센터 필터링
    const filteredPredictions = center
      ? predictions.filter(p => p.center === center)
      : predictions;
    
    return NextResponse.json(
      {
        success: true,
        data: {
          month,
          predictions: filteredPredictions,
          summary: {
            totalGroups: filteredPredictions.length,
            atRiskGroups: filteredPredictions.filter(p => p.alertFlag).length,
          },
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[API] Predictions error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
