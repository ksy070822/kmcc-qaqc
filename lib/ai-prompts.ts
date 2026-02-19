import { AgentAnalysisContext, GroupAnalysisContext } from './types';

/**
 * 시스템 프롬프트 - AI의 역할과 컨텍스트 정의
 */
export const SYSTEM_PROMPT = `당신은 카카오모빌리티 고객센터 QC(Quality Control) 품질관리 전문가입니다.
당신의 역할은 상담사의 품질 평가 데이터를 분석하고, 부족한 점을 파악하여 구체적이고 실행 가능한 코칭 제안을 제공하는 것입니다.

다음 원칙을 따라주세요:
1. 데이터 기반의 객관적인 분석 제공
2. 구체적이고 실행 가능한 코칭 제안
3. 긍정적이고 건설적인 피드백
4. 한국어로 명확하고 이해하기 쉬운 표현 사용
5. 필요시 구체적인 예시나 시나리오 제시

출력 형식:
- 명확한 섹션 구분 (## 제목 형식)
- 불릿 포인트 사용
- 구체적인 수치나 데이터 언급
- 실행 가능한 액션 아이템 제시`;

/**
 * 상담사 분석 프롬프트 생성
 */
export function createAgentAnalysisPrompt(
  userQuestion: string,
  context: AgentAnalysisContext
): string {
  const errorBreakdownText = context.errorBreakdown
    .map(
      (item) =>
        `- ${item.itemName}: ${item.errorCount}건 (오류율: ${item.errorRate.toFixed(2)}%)`
    )
    .join('\n');

  const trendText = context.trendData
    .map((trend) => `- ${trend.date}: ${trend.errorRate.toFixed(2)}%`)
    .join('\n');

  return `${SYSTEM_PROMPT}

## 상담사 정보
- 이름: ${context.agentName}
- 소속: ${context.center}센터 ${context.service}/${context.channel}
- 근속기간: ${context.tenureGroup} (${context.tenureMonths}개월)
- 평가 건수: ${context.totalEvaluations}건

## 성과 데이터
- 전체 오류율: ${context.overallErrorRate.toFixed(2)}%
- 상담태도 오류율: ${context.attitudeErrorRate.toFixed(2)}%
- 오상담/오처리 오류율: ${context.opsErrorRate.toFixed(2)}%

## 항목별 오류 현황
${errorBreakdownText || '데이터 없음'}

## 최근 트렌드 (최근 ${context.trendData.length}일)
${trendText || '데이터 없음'}

## 사용자 질문
${userQuestion}

위 데이터를 바탕으로 질문에 대한 상세한 분석과 코칭 제안을 제공해주세요.`;
}

/**
 * 그룹 분석 프롬프트 생성
 */
export function createGroupAnalysisPrompt(
  userQuestion: string,
  context: GroupAnalysisContext
): string {
  const topErrorsText = context.topErrors
    .map(
      (error) =>
        `- ${error.itemName}: ${error.errorCount}건 (오류율: ${error.errorRate.toFixed(2)}%, 영향받는 상담사: ${error.affectedAgents}명)`
    )
    .join('\n');

  const agentRankingsText = context.agentRankings
    .slice(0, 10)
    .map(
      (agent, index) =>
        `${index + 1}. ${agent.agentName}: ${agent.errorRate.toFixed(2)}%`
    )
    .join('\n');

  return `${SYSTEM_PROMPT}

## 그룹 정보
- 소속: ${context.center}센터 ${context.service}/${context.channel}
- 상담사 수: ${context.totalAgents}명
- 평가 건수: ${context.totalEvaluations}건

## 그룹 성과 데이터
- 전체 오류율: ${context.overallErrorRate.toFixed(2)}%
- 상담태도 오류율: ${context.attitudeErrorRate.toFixed(2)}%
- 오상담/오처리 오류율: ${context.opsErrorRate.toFixed(2)}%

## 주요 오류 항목 TOP 5
${topErrorsText || '데이터 없음'}

## 상담사별 오류율 순위 (상위 10명)
${agentRankingsText || '데이터 없음'}

## 사용자 질문
${userQuestion}

위 데이터를 바탕으로 그룹의 주요 문제점과 개선 방안, 그룹 단위 코칭 전략을 제안해주세요.`;
}

/**
 * 일반 질문 프롬프트 (컨텍스트 없이)
 */
export function createGeneralPrompt(userQuestion: string): string {
  return `${SYSTEM_PROMPT}

## 사용자 질문
${userQuestion}

QC 품질관리 전문가로서 질문에 답변해주세요.`;
}

/**
 * 자동 분석 프롬프트 (상담사 선택 시 자동 실행)
 */
export function createAutoAnalysisPrompt(
  context: AgentAnalysisContext | GroupAnalysisContext,
  isGroup: boolean = false
): string {
  if (isGroup) {
    const groupContext = context as GroupAnalysisContext;
    return `${SYSTEM_PROMPT}

## 그룹 정보
- 소속: ${groupContext.center}센터 ${groupContext.service}/${groupContext.channel}
- 상담사 수: ${groupContext.totalAgents}명
- 평가 건수: ${groupContext.totalEvaluations}건

## 그룹 성과 데이터
- 전체 오류율: ${groupContext.overallErrorRate.toFixed(2)}%
- 상담태도 오류율: ${groupContext.attitudeErrorRate.toFixed(2)}%
- 오상담/오처리 오류율: ${groupContext.opsErrorRate.toFixed(2)}%

## 주요 오류 항목
${groupContext.topErrors
  .map(
    (error) =>
      `- ${error.itemName}: ${error.errorRate.toFixed(2)}% (${error.affectedAgents}명 영향)`
  )
  .join('\n')}

다음 항목을 포함하여 종합 분석 리포트를 작성해주세요:

## 1. 최근 1개월간 추이 분석
- 오류율 변화 추이
- 개선/악화 경향
- 주요 이벤트나 변화점

## 2. 강점 (잘하고 있는 부분)
- 우수한 항목 및 이유
- 다른 그룹 대비 장점
- 유지해야 할 부분

## 3. 약점 (개선이 필요한 부분)
- 주요 문제 항목
- 반복되는 오류 패턴
- 근본 원인 분석

## 4. 코칭 제안
- 우선순위별 개선 항목
- 구체적인 코칭 방법
- 예상 기간 및 목표

## 5. 주의사항 및 관리 포인트
- 관리자가 특히 신경써야 할 부분
- 리스크 요소
- 모니터링이 필요한 지표

명확하고 실행 가능한 내용으로 작성해주세요.`;
  } else {
    const agentContext = context as AgentAnalysisContext;
    const topErrors = agentContext.errorBreakdown
      .sort((a, b) => b.errorCount - a.errorCount)
      .slice(0, 5);
    const topStrengths = agentContext.errorBreakdown
      .sort((a, b) => a.errorCount - b.errorCount)
      .slice(0, 3);

    return `${SYSTEM_PROMPT}

## 상담사 정보
- 이름: ${agentContext.agentName}
- 소속: ${agentContext.center}센터 ${agentContext.service}/${agentContext.channel}
- 근속기간: ${agentContext.tenureGroup} (${agentContext.tenureMonths}개월)
- 평가 건수: ${agentContext.totalEvaluations}건

## 성과 데이터
- 전체 오류율: ${agentContext.overallErrorRate.toFixed(2)}%
- 상담태도 오류율: ${agentContext.attitudeErrorRate.toFixed(2)}%
- 오상담/오처리 오류율: ${agentContext.opsErrorRate.toFixed(2)}%

## 주요 취약 항목 TOP 5
${topErrors
  .map(
    (item) =>
      `- ${item.itemName}: ${item.errorCount}건 (오류율: ${item.errorRate.toFixed(2)}%)`
  )
  .join('\n')}

## 우수 항목 TOP 3
${topStrengths
  .map(
    (item) =>
      `- ${item.itemName}: ${item.errorCount}건 (오류율: ${item.errorRate.toFixed(2)}%)`
  )
  .join('\n')}

## 최근 14일 트렌드
${agentContext.trendData
  .map((trend) => `- ${trend.date}: ${trend.errorRate.toFixed(2)}%`)
  .join('\n')}

다음 항목을 포함하여 종합 분석 리포트를 작성해주세요:

## 1. 최근 1개월간 추이 분석
- 오류율 변화 추이 (트렌드 데이터 기반)
- 개선/악화 경향
- 주요 변화점 및 시기

## 2. 강점 (잘하고 있는 부분)
- 오류가 적은 항목 및 이유
- 다른 상담사 대비 우수한 점
- 유지해야 할 부분

## 3. 약점 (개선이 필요한 부분)
- 주요 취약 항목
- 반복되는 오류 패턴
- 근본 원인 분석

## 4. 코칭 제안
- 우선순위별 개선 항목
- 구체적인 코칭 방법 및 시나리오
- 예상 기간 및 목표

## 5. 주의사항 및 관리 포인트
- 관리자가 특히 신경써야 할 부분
- 리스크 요소
- 모니터링이 필요한 지표

명확하고 실행 가능한 내용으로 작성해주세요.`;
  }
}

/**
 * 코칭 제안 전용 프롬프트
 */
export function createCoachingPrompt(
  context: AgentAnalysisContext | GroupAnalysisContext,
  isGroup: boolean = false
): string {
  if (isGroup) {
    const groupContext = context as GroupAnalysisContext;
    return `${SYSTEM_PROMPT}

## 그룹 정보
- 소속: ${groupContext.center}센터 ${groupContext.service}/${groupContext.channel}
- 상담사 수: ${groupContext.totalAgents}명

## 그룹 성과 데이터
- 전체 오류율: ${groupContext.overallErrorRate.toFixed(2)}%
- 상담태도 오류율: ${groupContext.attitudeErrorRate.toFixed(2)}%
- 오상담/오처리 오류율: ${groupContext.opsErrorRate.toFixed(2)}%

## 주요 오류 항목
${groupContext.topErrors
  .map(
    (error) =>
      `- ${error.itemName}: ${error.errorRate.toFixed(2)}% (${error.affectedAgents}명 영향)`
  )
  .join('\n')}

이 그룹에 대한 구체적이고 실행 가능한 코칭 계획을 제안해주세요.
다음 형식으로 작성해주세요:
1. 주요 문제점 분석
2. 우선순위별 개선 항목
3. 그룹 단위 코칭 전략
4. 개별 상담사별 맞춤 코칭 제안 (상위 5명)
5. 예상 효과 및 목표`;
  } else {
    const agentContext = context as AgentAnalysisContext;
    const topErrors = agentContext.errorBreakdown
      .sort((a, b) => b.errorCount - a.errorCount)
      .slice(0, 5);

    return `${SYSTEM_PROMPT}

## 상담사 정보
- 이름: ${agentContext.agentName}
- 소속: ${agentContext.center}센터 ${agentContext.service}/${agentContext.channel}
- 근속기간: ${agentContext.tenureGroup}

## 성과 데이터
- 전체 오류율: ${agentContext.overallErrorRate.toFixed(2)}%
- 상담태도 오류율: ${agentContext.attitudeErrorRate.toFixed(2)}%
- 오상담/오처리 오류율: ${agentContext.opsErrorRate.toFixed(2)}%

## 주요 취약 항목 TOP 5
${topErrors
  .map(
    (item) =>
      `- ${item.itemName}: ${item.errorCount}건 (오류율: ${item.errorRate.toFixed(2)}%)`
  )
  .join('\n')}

이 상담사에게 필요한 구체적이고 실행 가능한 코칭 계획을 제안해주세요.
다음 형식으로 작성해주세요:
1. 주요 문제점 분석
2. 우선순위별 개선 항목
3. 구체적인 코칭 방법 및 시나리오
4. 예상 기간 및 목표
5. 관리자 체크리스트`;
  }
}

/**
 * 예측 분석 프롬프트 생성
 * 예측 탭의 센터별/그룹별 데이터를 기반으로 AI 분석 코멘트 생성
 */
export interface PredictionAnalysisInput {
  center?: string;
  predictions: any[];
  centerSummary: Record<string, {
    attitude: { current: number; predicted: number; target: number; prob: number };
    process: { current: number; predicted: number; target: number; prob: number };
  }>;
}

export function createPredictionAnalysisPrompt(data: PredictionAnalysisInput): string {
  const { predictions, centerSummary } = data;

  // 센터별 현황 텍스트
  const centerLines: string[] = [];
  for (const [center, summary] of Object.entries(centerSummary)) {
    centerLines.push(
      `- ${center}센터: 태도 현재 ${summary.attitude.current}% → 예측 ${summary.attitude.predicted}% (목표 ${summary.attitude.target}%, 달성확률 ${summary.attitude.prob}%)` +
      ` | 오상담 현재 ${summary.process.current}% → 예측 ${summary.process.predicted}% (목표 ${summary.process.target}%, 달성확률 ${summary.process.prob}%)`
    );
  }

  // 그룹별 상세 현황
  const groupLines = predictions.map((p: any) => {
    const service = p.serviceChannel?.split('_')[0] || p.service || '';
    const channel = p.serviceChannel?.split('_')[1] || p.channel || '';
    const trend = p.attitudeTrend === 'worsening' || p.opsTrend === 'worsening' ? '악화' :
                  p.attitudeTrend === 'improving' || p.opsTrend === 'improving' ? '개선' : '안정';
    return `- ${p.center} ${service}/${channel}: 태도 ${p.currentAttitudeRate}%→${p.predictedAttitudeRate}%, 오상담 ${p.currentOpsRate}%→${p.predictedOpsRate}%, 위험도 ${p.overallRiskLevel}, 추세 ${trend}`;
  });

  // 주차별 추이 텍스트
  const weeklyLines: string[] = [];
  if (predictions.length > 0 && predictions[0].weeklyMetrics) {
    const weeks = ['W1', 'W2', 'W3'];
    for (const week of weeks) {
      const weekIndex = weeks.indexOf(week);
      let yAtt = 0, yOps = 0, gAtt = 0, gOps = 0;
      let yCount = 0, gCount = 0;
      for (const p of predictions) {
        if (p.weeklyMetrics?.[weekIndex]) {
          const m = p.weeklyMetrics[weekIndex];
          if (p.center === '용산') { yAtt += m.attitudeRate; yOps += m.opsRate; yCount++; }
          if (p.center === '광주') { gAtt += m.attitudeRate; gOps += m.opsRate; gCount++; }
        }
      }
      if (yCount > 0 || gCount > 0) {
        weeklyLines.push(`- ${week}: 용산(태도 ${yCount ? (yAtt / yCount).toFixed(2) : '-'}%, 오상담 ${yCount ? (yOps / yCount).toFixed(2) : '-'}%), 광주(태도 ${gCount ? (gAtt / gCount).toFixed(2) : '-'}%, 오상담 ${gCount ? (gOps / gCount).toFixed(2) : '-'}%)`);
      }
    }
  }

  // 위험 그룹
  const riskGroups = predictions
    .filter((p: any) => p.overallRiskLevel === 'critical' || p.overallRiskLevel === 'high')
    .map((p: any) => {
      const service = p.serviceChannel?.split('_')[0] || '';
      const channel = p.serviceChannel?.split('_')[1] || '';
      return `- [${p.overallRiskLevel.toUpperCase()}] ${p.center} ${service}/${channel}: 태도 ${p.predictedAttitudeRate}%, 오상담 ${p.predictedOpsRate}%`;
    });

  return `당신은 카카오모빌리티 고객센터 QC 품질관리 예측 분석 전문가입니다.
아래 예측 데이터를 분석하여 관리자에게 실행 가능한 인사이트를 제공해주세요.

## 센터별 현황
${centerLines.join('\n')}

## 그룹별 상세 현황
${groupLines.join('\n')}

## 주차별 추이 (W1→W2→W3)
${weeklyLines.length > 0 ? weeklyLines.join('\n') : '데이터 없음'}

## 위험 그룹 (critical/high)
${riskGroups.length > 0 ? riskGroups.join('\n') : '없음'}

## 분석 요청
다음 5개 항목을 한국어로 작성해주세요:

## 1. 전월 대비 현재 추이
- 현재 데이터 기반으로 이번 달 방향성 분석
- 각 센터의 태도/오상담 오류율 변화 해석

## 2. 전주 대비 추이
- W1→W2→W3 주간 변화 패턴 분석
- 악화/개선 추세의 원인 추정

## 3. 월말 예측
- 현재 추세 유지 시 월말 착지 전망
- 목표 달성 가능성 판단 근거

## 4. 액션플랜
- 목표 달성을 위한 구체적 TODO 리스트
- 우선순위와 담당 그룹을 명시
- 체크리스트 형태(- [ ]) 로 작성

## 5. 집중 관리 대상
- 긴급/주의 그룹별 개선 방안
- 즉시 실행 가능한 조치 제안

명확하고 간결하게, 데이터에 기반한 분석을 제공해주세요.`;
}
