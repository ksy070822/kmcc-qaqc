// QC Management System Types

// 로우데이터 구조 (Google Spreadsheet 연동용)
export interface RawEvaluationData {
  rowIndex: number
  서비스: string // 택시, 대리, 퀵 등
  채널: "유선" | "채팅"
  이름: string
  ID: string
  입사일: string
  근속개월: number
  그룹변경정보?: string
  평가회차: string
  평가일: string
  상담일시?: string
  상담ID: string
  유선채팅: "유선" | "채팅"
  // 상담유형 1~4뎁스
  뎁스1_1: string
  뎁스1_2: string
  뎁스1_3: string
  뎁스1_4: string
  뎁스2_1?: string
  뎁스2_2?: string
  뎁스2_3?: string
  뎁스2_4?: string
  // 16개 평가항목 (Y/N)
  첫인사끝인사누락: "Y" | "N"
  공감표현누락: "Y" | "N"
  사과표현누락: "Y" | "N"
  추가문의누락: "Y" | "N"
  불친절: "Y" | "N"
  상담유형오설정: "Y" | "N"
  가이드미준수: "Y" | "N"
  본인확인누락: "Y" | "N"
  필수탐색누락: "Y" | "N"
  오안내: "Y" | "N"
  전산처리누락: "Y" | "N"
  전산처리미흡정정: "Y" | "N"
  전산조작미흡오류: "Y" | "N"
  콜픽트립ID매핑누락오기재: "Y" | "N"
  플래그키워드누락오기재: "Y" | "N"
  상담이력기재미흡: "Y" | "N"
  // 합계
  항목별오류건: number
  Comment?: string
  AI평가여부?: "Y" | "N"
  AI오류여부?: "Y" | "N"
  내용?: string
  진행일?: string
  진행자?: string
  태도미흡: number
  오상담오처리: number
}

export interface Agent {
  id: string
  name: string
  odooId: string
  center: "용산" | "광주"
  service: string // 택시, 대리, 퀵 등
  channel: "유선" | "채팅"
  group: string // service/channel 조합
  tenure: string // 근속기간
  tenureMonths: number
  hireDate: string
  manager: string
}

export interface EvaluationItem {
  id: string
  category: "상담태도" | "오상담/오처리"
  name: string
  shortName: string
  columnKey: string // 로우데이터 컬럼명
}

export interface DailyEvaluation {
  date: string
  agentId: string
  items: Record<string, number> // evaluationItemId -> error count
  totalCalls: number
  errorRate: number
  attitudeErrorRate: number // 상담태도 오류율
  processErrorRate: number // 오상담/오처리 오류율
}

export interface GroupStats {
  group: string
  center: "용산" | "광주"
  totalAgents: number
  errorRate: number
  attitudeErrorRate: number
  processErrorRate: number
  trend: number // 전일대비 변화
  targetRate: number
  achievementRate: number
}

export interface AlertSetting {
  id: string
  group: string
  center: "용산" | "광주"
  attitudeThreshold: number // 태도 임계값
  processThreshold: number // 업무 임계값
  totalThreshold: number // 전체 임계값
  consecutiveDays: number // N일 연속
  weeklyChangeThreshold: number // 전주대비 변화율
  manager: string
  managerSlackId: string
  enabled: boolean
}

export interface ActionPlan {
  id: string
  agentId: string
  agentName: string
  createdAt: string
  issue: string
  plan: string
  targetDate: string
  status: "진행중" | "완료" | "지연"
  result?: string
  completedAt?: string
  managerFeedback?: string
  feedbackDate?: string
}

export interface Goal {
  id: string
  type: "태도" | "오상담/오처리" | "합계"
  center: "용산" | "광주" | "전체"
  group?: string
  targetErrorRate: number
  currentRate: number
  period: "daily" | "weekly" | "monthly" | "quarterly" | "yearly"
  startDate: string
  endDate: string
}

export interface Report {
  id: string
  type: "weekly" | "monthly" | "quarterly" | "half-yearly" | "yearly" | "custom"
  period: string
  startDate: string
  endDate: string
  filters: {
    center?: "용산" | "광주" | "전체"
    channel?: "유선" | "채팅" | "전체"
    service?: string
    tenure?: string
  }
  generatedAt: string
  summary: {
    totalEvaluations: number
    overallErrorRate: number
    attitudeErrorRate: number
    processErrorRate: number
    topIssues: Array<{ item: string; count: number; rate: number }>
    improvedAgents: number
    needsAttention: number
  }
}

// AI 챗봇 관련 타입
export interface AIChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

export interface AIChatRequest {
  message: string
  agentId?: string
  group?: {
    center?: string
    service?: string
    channel?: string
  }
  context?: Record<string, any>
  conversationHistory?: AIChatMessage[]
}

export interface AIChatResponse {
  success: boolean
  message?: string
  error?: string
}

export interface AgentAnalysisContext {
  agentId: string
  agentName: string
  center: string
  service: string
  channel: string
  tenureMonths: number
  tenureGroup: string
  totalEvaluations: number
  attitudeErrorRate: number
  opsErrorRate: number
  overallErrorRate: number
  errorBreakdown: Array<{
    itemName: string
    errorCount: number
    errorRate: number
  }>
  trendData: Array<{
    date: string
    errorRate: number
  }>
}

export interface GroupAnalysisContext {
  center: string
  service: string
  channel: string
  totalAgents: number
  totalEvaluations: number
  attitudeErrorRate: number
  opsErrorRate: number
  overallErrorRate: number
  topErrors: Array<{
    itemName: string
    errorCount: number
    errorRate: number
    affectedAgents: number
  }>
  agentRankings: Array<{
    agentId: string
    agentName: string
    errorRate: number
  }>
  trendData: Array<{
    date: string
    errorRate: number
  }>
}

// ============================================================
// 주간보고 관련 타입
// ============================================================

export interface WeeklyReportItem {
  reportId: string
  reportWeek: string
  reportDate: string
  center: string
  service: string
  weekEvaluations: number
  weekAttitudeRate: number
  weekOpsRate: number
  prevWeekAttitudeRate: number
  prevWeekOpsRate: number
  prevWeekActivities: string
  currentWeekIssues: string
  causeAnalysis: string
  nextWeekPlan: string
  registeredAgentCount: number
  managerId: string
  managerName: string
  status: 'draft' | 'submitted' | 'reviewed'
  reviewedBy?: string
  reviewComment?: string
  createdAt: string
  updatedAt: string
}

export interface WeeklyReportInput {
  reportId?: string
  reportWeek: string
  center: string
  service: string
  weekEvaluations?: number
  weekAttitudeRate?: number
  weekOpsRate?: number
  prevWeekAttitudeRate?: number
  prevWeekOpsRate?: number
  prevWeekActivities?: string
  currentWeekIssues?: string
  causeAnalysis?: string
  nextWeekPlan?: string
  managerId?: string
  managerName?: string
  status?: 'draft' | 'submitted' | 'reviewed'
  registeredAgents?: UnderperformingRegistration[]
}

// ============================================================
// 부진상담사 관리 타입
// ============================================================

export interface CoachingRecord {
  week: string
  attitudeRate: number
  opsRate: number
  evaluationCount: number
  coachingNote?: string
  improvementPlan?: string
  improved?: boolean
  recordedAt: string
}

export interface UnderperformingRegistration {
  agentId: string
  agentName: string
  center: string
  service: string
  channel: string
  registrationReason: string
  problematicItems: string[]
  baselineAttitudeRate: number
  baselineOpsRate: number
  baselineEvaluationCount: number
  coachingNote?: string
  improvementPlan?: string
}

export interface UnderperformingAgent {
  trackingId: string
  agentId: string
  agentName: string
  center: string
  service: string
  channel: string
  registeredWeek: string
  registeredDate: string
  sourceReportId?: string
  registrationReason: string
  problematicItems: string[]
  baselineAttitudeRate: number
  baselineOpsRate: number
  baselineEvaluationCount: number
  currentAttitudeRate: number
  currentOpsRate: number
  currentEvaluationCount: number
  weeksTracked: number
  consecutiveImprovedWeeks: number
  consecutiveWorsenedWeeks: number
  bestAttitudeRate: number
  bestOpsRate: number
  coachingRecords: CoachingRecord[]
  status: 'registered' | 'tracking' | 'improved' | 'resolved' | 'escalated'
  resolvedDate?: string
  escalatedDate?: string
  resolutionNote?: string
  managerId?: string
  createdAt: string
  updatedAt: string
}

// ============================================================
// QA(품질보증) 평가 관련 타입
// ============================================================

export interface QAEvaluation {
  qaEvalId: string          // "{agent_id}_{month}_{round}"
  evaluationDate: string    // YYYY-MM-DD (평가월 1일)
  evaluationMonth: string   // "2026-01"
  round: number             // 차시 1~5
  consultationId?: string

  // 상담사 정보
  center: "용산" | "광주"
  team?: string
  service: string
  channel: "유선" | "채팅"
  agentName: string
  agentId?: string
  tenureMonths?: number
  workType?: string         // 주간/야간

  // 총점
  totalScore: number        // 0~100

  // 공통 항목 (유선+채팅)
  greetingScore?: number          // 인사예절
  responseExpression?: number     // 화답표현
  inquiryComprehension?: number   // 문의내용파악
  identityCheck?: number          // 본인확인
  requiredSearch?: number         // 필수탐색
  businessKnowledge?: number      // 업무지식
  promptness?: number             // 신속성
  systemProcessing?: number       // 전산처리
  consultationHistory?: number    // 상담이력
  empathyCare?: number            // 감성케어
  languageExpression?: number     // 언어표현
  listeningFocus?: number         // 경청/집중태도
  explanationAbility?: number     // 설명능력
  perceivedSatisfaction?: number  // 체감만족
  praiseBonus?: number            // 칭찬접수(+10)

  // 유선 전용
  voicePerformance?: number       // 음성연출
  speechSpeed?: number            // 말속도/발음
  honorificError?: number         // 호칭오류(-1)

  // 채팅 전용
  spelling?: number               // 맞춤법
  closeRequest?: number           // 종료요청
  copyError?: number              // 복사오류(-1)
  operationError?: number         // 조작오류(-1)

  // 상담유형
  consultTypeDepth1?: string
  consultTypeDepth2?: string
  consultTypeDepth3?: string
  consultTypeDepth4?: string

  // 피드백
  knowledgeFeedback?: string
  satisfactionComment?: string
}

export interface QAEvaluationItem {
  id: string
  category: "공통" | "유선전용" | "채팅전용"
  name: string
  shortName: string
  columnKey: string       // QAEvaluation 필드명
  maxScore: number        // 배점
  channelScope: "all" | "voice" | "chat"
}

export interface QADashboardStats {
  avgScore: number            // 전체 평균 점수
  totalEvaluations: number    // 총 평가 건수
  evaluatedAgents: number     // 평가 대상 상담사 수
  yongsanAvgScore: number
  gwangjuAvgScore: number
  yongsanEvaluations: number
  gwangjuEvaluations: number
  voiceAvgScore: number       // 유선 평균
  chatAvgScore: number        // 채팅 평균
  monthLabel: string          // "2026-02"
  // 전월 대비
  prevMonthAvgScore?: number
  scoreTrend?: number         // 전월 대비 증감
  prevVoiceAvgScore?: number
  prevChatAvgScore?: number
  voiceTrend?: number
  chatTrend?: number
  // 센터+채널 교차
  yongsanVoiceAvg?: number
  yongsanChatAvg?: number
  gwangjuVoiceAvg?: number
  gwangjuChatAvg?: number
}

export interface QACenterStats {
  center: string
  avgScore: number
  evaluations: number
  services: Array<{
    name: string
    channel: "유선" | "채팅"
    avgScore: number
    evaluations: number
  }>
}

export interface QAItemStats {
  itemName: string
  shortName: string
  maxScore: number
  avgScore: number
  avgRate: number    // avgScore / maxScore * 100
  category: string
}

export interface QATrendData {
  month: string       // "2026-01"
  용산: number
  광주: number
  전체: number
}

export interface QAMonthlyRow {
  month: string
  center: string
  service: string
  channel: string
  evaluations: number
  avgScore: number
  minScore: number
  maxScore: number
}

export interface QAConsultTypeStats {
  depth1: string
  depth2?: string
  count: number
  avgScore: number
}

export interface QAAgentPerformance {
  agentName: string
  agentId?: string
  center: string
  service: string
  channel: string
  evaluations: number
  avgScore: number
  groupAvg: number
  diff: number           // avgScore - groupAvg
  groupTotal: number     // 그룹 전체 인원 (5회+ 평가 기준)
  weakItems: string[]    // 그룹 평균 대비 취약 항목명
}

// ============================================================
// CSAT(상담평점) 관련 타입
// ============================================================

export interface CSATDashboardStats {
  avgScore: number            // 평균 평점 (5점 만점)
  totalReviews: number        // 총 리뷰 수
  score5Rate: number          // 5점 비율 (%)
  score4Rate: number
  score3Rate: number
  score2Rate: number
  score1Rate: number
  yongsanAvgScore: number
  gwangjuAvgScore: number
  // 전일/전주 대비
  prevAvgScore?: number
  scoreTrend?: number
}

export interface CSATTrendData {
  date: string          // YYYY-MM-DD
  용산: number
  광주: number
  전체: number
}

export interface CSATDailyRow {
  date: string
  center: string
  reviewCount: number
  avgScore: number
  score5Count: number
  score4Count: number
  score3Count: number
  score2Count: number
  score1Count: number
}

export interface CSATServiceStats {
  service: string
  center: string
  avgScore: number
  reviewCount: number
  trend?: number
}

export interface CSATTagRow {
  tag: string
  optionType: "POSITIVE" | "NEGATIVE"
  count: number
  avgScore: number
}

// ============================================================
// 직무테스트(Quiz) 관련 타입
// ============================================================

export interface QuizDashboardStats {
  avgScore: number            // 평균 점수 (100점)
  totalSubmissions: number    // 총 응시 건수
  uniqueAgents: number        // 응시 상담사 수
  passRate: number            // 합격률 (90점 이상, %)
  yongsanAvgScore: number
  gwangjuAvgScore: number
  prevAvgScore?: number
  scoreTrend?: number
}

export interface QuizTrendData {
  month: string         // "2026-02"
  용산: number
  광주: number
  전체: number
  submissions: number
  passRate: number
}

export interface QuizAgentRow {
  userId: string
  userName?: string
  center: string
  month: string
  avgScore: number
  maxScore: number
  attemptCount: number
  passCount: number
}

export interface QuizServiceTrendRow {
  month: string
  service: string
  avgScore: number
  submissions: number
}

// ============================================================
// 통합 월간 요약 타입
// ============================================================

export interface AgentMonthlySummary {
  summaryId: string         // "{agent_id}_{month}"
  summaryMonth: string
  agentId: string
  agentName?: string
  center: string
  service?: string
  channel?: string
  workType?: string

  // QA 지표
  qaScore?: number          // QA 평균 점수 (100점)
  qaEvalCount?: number

  // QC 지표
  qcAttitudeRate?: number   // 태도 오류율 (%)
  qcOpsRate?: number        // 오상담 오류율 (%)
  qcTotalRate?: number
  qcEvalCount?: number

  // CSAT 지표
  csatAvgScore?: number     // 평균 평점 (5점)
  csatReviewCount?: number

  // 직무테스트
  knowledgeScore?: number
  knowledgeTestCount?: number

  // 종합 리스크
  compositeRiskScore?: number
  riskLevel?: "low" | "medium" | "high" | "critical"
  aiComment?: string
}

// ============================================================
// 통합분석 대시보드 타입
// ============================================================

// 통합 대시보드 KPI
export interface IntegratedDashboardStats {
  month: string
  totalAgents: number
  agentsWithData: number
  avgRiskScore: number
  riskDistribution: { low: number; medium: number; high: number; critical: number }
  domainAverages: { qa: number; qcRate: number; csat: number; quiz: number }
  centerComparison: Array<{
    center: string
    avgRisk: number
    agents: number
    qa: number
    qcRate: number
    csat: number
    quiz: number
  }>
}

// 상담사 통합 프로파일 (모달용)
export interface AgentIntegratedProfile {
  agentId: string
  agentName: string
  center: string
  service?: string
  channel?: string
  current: AgentMonthlySummary
  monthlyTrend: Array<{
    month: string
    qaScore?: number
    qcRate?: number
    csatScore?: number
    quizScore?: number
    riskScore?: number
  }>
  domainCoverage: { qa: boolean; qc: boolean; csat: boolean; quiz: boolean }
  strengthWeakness: Array<{
    domain: string
    level: "strong" | "normal" | "weak" | "nodata"
    note: string
  }>
}

// 교차분석 결과
export interface CrossAnalysisResult {
  correlations: Array<{
    domainA: string
    domainB: string
    correlation: number
    sampleSize: number
  }>
  weakInOnlyOne: Array<AgentMonthlySummary & { weakDomain: string }>
  riskDistribution: Record<string, number>
}

// ============================================================
// Mypage 상담사 상세 타입
// ============================================================

export interface MypageProfile {
  qcRate: number
  qcPrevRate: number
  qcGroupAvg: number
  csatScore: number
  csatPrevScore: number
  csatGroupAvg: number
  qaScore: number
  qaPrevScore: number
  qaGroupAvg: number
  quizScore: number
  quizPrevScore: number
  quizGroupAvg: number
  trendData: Array<{
    month: string
    qcRate: number
    csatScore: number
    qaScore: number
    quizScore: number
  }>
}

export interface MypageQCDetail {
  evaluationCount: number
  attitudeErrorRate: number
  opsErrorRate: number
  totalErrorRate: number
  attitudeTarget: number
  opsTarget: number
  prevAttRate: number
  prevOpsRate: number
  centerAvgAttRate: number
  centerAvgOpsRate: number
  monthlyTrend: Array<{ month: string; attRate: number; opsRate: number }>
  topErrors: Array<{ item: string; count: number }>
  radarData: Array<{ label: string; value: number; groupAvg: number; fullMark: number }>
  recentEvaluations: Array<{
    evaluationDate: string
    consultId: string
    service: string
    errorItems: string[]
    result: string
  }>
}

export interface MypageCSATDetail {
  totalReviews: number
  avgScore: number
  score5Rate: number
  lowScoreRate: number
  prevMonthAvg: number
  centerAvg: number
  monthlyTrend: Array<{ month: string; agentAvg: number; centerAvg: number }>
  recentReviews: Array<{
    date: string
    consultId: string
    service: string
    score: number
    comment: string
  }>
}

export interface MypageQADetail {
  empathyCareAvg: number
  businessSystemAvg: number
  totalScore: number
  evalCount: number
  prevMonthScore: number
  centerAvg: number
  monthlyTrend: Array<{ month: string; agentScore: number; centerAvg: number }>
  radarData: Array<{ label: string; value: number; groupAvg: number; fullMark: number }>
  itemComparison: Array<{
    itemName: string
    currentScore: number
    prevScore: number
    gap: number
  }>
}

export interface MypageQuizDetail {
  attemptCount: number
  avgScore: number
  prevMonthScore: number
  centerAvg: number
  groupPercentile: number
  passed: boolean
  monthlyTrend: Array<{ month: string; agentScore: number; centerAvg: number }>
  radarData: Array<{ label: string; value: number; groupAvg: number; fullMark: number }>
  attempts: Array<{
    date: string
    service: string
    score: number
    passed: boolean
    centerAvg: number
  }>
}
