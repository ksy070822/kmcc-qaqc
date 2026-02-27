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

  // 추가 메타 (2026-02 리빌드)
  workHours?: string              // 근무시간 (e.g. "09:00~18:00")
  startDate?: string              // 투입일 YYYY-MM-DD
  tenureGroup?: string            // 근속그룹 (e.g. "3개월미만")
  slaIncluded?: boolean           // SLA 포함여부
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
  rawMaxScore: number  // 실제 배점 (e.g., 15 for 업무지식)
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

// QA 회차별 통계
export interface QARoundStats {
  round: number             // 1~5
  evaluations: number       // 평가 건수
  avgScore: number          // 평균 점수
  yongsanAvg: number
  gwangjuAvg: number
  voiceAvg: number
  chatAvg: number
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
  // 신규: 평가 현황
  totalConsults: number       // 상담완료건수 (TODO: 별도 쿼리)
  totalRequests: number       // 평가요청수
  reviewRate: number          // 응답율 (리뷰/요청, %)
  lowScoreCount: number       // 1~2점 건수
  score1Count: number         // 1점 건수
  score2Count: number         // 2점 건수
  lowScoreRate: number        // 저점비율 (%)
  // 전주대비
  prevTotalReviews?: number
  prevLowScoreCount?: number
  prevTotalRequests?: number
  reviewsTrend?: number       // 평가수 전주대비 (%)
  lowScoreTrend?: number      // 저점건수 전주대비 (%)
  requestsTrend?: number      // 평가요청 전주대비 (%)
  consultsTrend?: number      // 상담완료 전주대비 (%)
}

export interface CSATTrendData {
  date: string          // YYYY-MM-DD
  용산: number          // 저점비율 (%)
  광주: number          // 저점비율 (%)
  전체: number          // 저점비율 (%)
  totalCount?: number   // 일별 전체 리뷰수
  lowCount?: number     // 일별 저점건수
  yongsanTotal?: number
  yongsanLow?: number
  gwangjuTotal?: number
  gwangjuLow?: number
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

export interface CSATWeeklyRow {
  period: string          // "02/12-02/18"
  avgScore: number
  reviewCount: number
  responseRate: number    // 응답율 (%)
  score5Rate: number
  score1Rate: number
  score2Rate: number
  consultReviewRate: number  // 상담대비 평가율 (%)
}

export interface CSATLowScoreWeekly {
  period: string          // "02/12-02/18"
  totalReviews: number
  lowCount: number
  lowRate: number         // 저점비율 (%)
  prevLowRate?: number    // 전주 저점비율 (전주대비 계산용)
  score1Count: number
  score2Count: number
  score1Services: Array<{ service: string; count: number; rate: number }>
  score2Services: Array<{ service: string; count: number; rate: number }>
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

  // 입사 정보
  tenureMonths?: number

  // 종합 리스크
  compositeRiskScore?: number
  riskLevel?: "low" | "medium" | "high" | "critical"
  activeDomainCount?: number  // 리스크 계산에 사용된 도메인 수 (1~4)
  aiComment?: string

  // 최근 3개월 이력 태그
  watchTags?: string[]   // e.g. ["집중관리", "부진"]
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
    qcRate: number | null
    csatScore: number | null
    qaScore: number | null
    quizScore: number | null
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
  coachingFeedback?: Array<{ date: string; category: string; title: string; comment: string }>
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
  sentimentPositive?: Array<{ label: string; value: number }>
  sentimentNegative?: Array<{ label: string; value: number }>
  sentimentTags?: Array<{ label: string; count: number; type: 'positive' | 'negative' }>
  coachingGuide?: Array<{ type: 'strength' | 'improvement'; title: string; description: string }>
}

export interface MypageQADetail {
  empathyCareAvg: number
  businessSystemAvg: number
  totalScore: number
  evalCount: number
  prevMonthScore: number
  centerAvg: number
  targetScore?: number
  prevEmpathy?: number
  prevBusiness?: number
  monthlyTrend: Array<{ month: string; agentScore: number; centerAvg: number }>
  radarData: Array<{ label: string; value: number; groupAvg: number; fullMark: number }>
  itemComparison: Array<{
    itemName: string
    currentScore: number
    prevScore: number
    gap: number
    comment?: string
  }>
  coachingGuide?: Array<{ type: 'strength' | 'opportunity'; title: string; description: string }>
}

export interface MypageQuizDetail {
  attemptCount: number
  avgScore: number
  prevMonthScore: number
  centerAvg: number
  groupPercentile: number
  passed: boolean
  wrongAnswerCount?: number
  topWrongCategory?: string
  monthlyTrend: Array<{ month: string; agentScore: number; centerAvg: number }>
  radarData: Array<{ label: string; value: number; groupAvg: number; fullMark: number }>
  knowledgeRadar?: Array<{ label: string; value: number; fullMark: number }>
  attempts: Array<{
    date: string
    service: string
    score: number
    passed: boolean
    centerAvg: number
  }>
  wrongAnswers?: Array<{ questionNo: string; summary: string; myAnswer: string; correctAnswer: string; centerWrongRate: number }>
  centerTopWrong?: Array<{ rank: number; topic: string; wrongRate: number; trend: 'up' | 'down' | 'same' }>
  coachingGuide?: Array<{ type: string; title: string; description: string }>
}

// ── 상담사 관리 (HR 기반) ──

export interface HrAgent {
  agentId: string
  name: string | null
  center: string
  hireDate: string | null
  tenureMonths: number
}

export interface AgentSummaryRow {
  agentId: string
  name: string | null
  center: string
  hireDate: string | null
  tenureMonths: number
  attRate: number | null
  opsRate: number | null
  quizScore: number | null
}

// ============================================================
// 코칭 시스템 타입
// ============================================================

// 8개 코칭 카테고리 ID
export type CoachingCategoryId =
  | 'greeting'        // 인사/예절
  | 'empathy'         // 공감/감성케어
  | 'inquiry'         // 문의파악/탐색
  | 'knowledge'       // 업무지식/안내
  | 'processing'      // 전산처리
  | 'records'         // 이력/기록관리
  | 'satisfaction'    // 체감만족/신속성
  | 'communication'   // 의사소통

// 코칭 카테고리 정의
export interface CoachingCategoryDef {
  id: CoachingCategoryId
  label: string
  qcItems: string[]         // QC 오류 항목 columnKey 목록
  qaItems: string[]         // QA 항목 columnKey 목록
  qcWeight: number          // QC 비중 (0~1)
  qaWeight: number          // QA 비중 (0~1)
  otherWeight?: number      // 기타 (Quiz/CSAT) 비중
  otherSource?: 'quiz' | 'csat'
}

// 코칭 티어
export type CoachingTier = '일반' | '주의' | '위험' | '심각' | '긴급'

// 코칭 티어 설정
export interface CoachingTierConfig {
  tier: CoachingTier
  minRisk: number
  maxRisk: number
  frequency: string       // 코칭 빈도 설명
}

// 근속 구간
export type TenureBand = 'new_hire' | 'early' | 'standard' | 'experienced'

// 채널별 리스크 가중치
export interface ChannelRiskWeights {
  qa: number
  qc: number
  csat: number
  quiz: number
}

// 7도메인 채널별 리스크 가중치 (Pulse 2)
export interface ChannelRiskWeightsV3 {
  qa: number
  qc: number
  csat: number
  quiz: number
  productivity: number
  attendance: number
  sla: number
}

// 카테고리별 취약점 분석 결과
export interface CategoryWeakness {
  categoryId: CoachingCategoryId
  label: string
  score: number           // 0~100 (100=완벽)
  severity: 'normal' | 'weak' | 'critical'
  qcEvidence: {
    errorItems: string[]
    errorCount: number
    totalEvals: number
    errorRate: number
  }
  qaEvidence: {
    items: Array<{ name: string; score: number; maxScore: number }>
    avgRate: number       // 점수/만점 비율
  }
  confidence: 'low' | 'moderate' | 'high'
}

// 상담유형별 오류 분석 (업무지식 드릴다운)
export interface ConsultTypeErrorAnalysis {
  depth2: string
  depth3: string | null
  errorCount: number
  errorPct: number        // 해당 상담사의 오류 중 비율
  groupAvgErrorPct: number
  isHighlighted: boolean  // 그룹 평균 대비 이상
}

// 상담유형 오설정 분석
export interface ConsultTypeCorrectionAnalysis {
  correctionCount: number
  totalEvals: number
  correctionRate: number  // %
  topMisclassifications: Array<{
    originalDepth1: string
    originalDepth2: string
    correctedDepth1: string
    correctedDepth2: string
    count: number
  }>
}

// 코칭 처방
export interface CoachingPrescription {
  categoryId: CoachingCategoryId
  categoryLabel: string
  severity: 'weak' | 'critical'
  description: string     // 처방 내용
  consultTypeDetail?: string  // 업무지식 부진 시 취약 상담유형
  evidence: string        // 근거 요약
}

// 상담사 코칭 플랜
export interface AgentCoachingPlan {
  agentId: string
  agentName: string
  center: string
  service: string
  channel: string
  tenureMonths: number
  tenureBand: TenureBand
  month: string           // YYYY-MM
  tier: CoachingTier
  riskScore: number
  riskScoreV1?: number    // 기존 v1 점수 (비교용)
  tierReason: string      // 티어 판정 근거
  weaknesses: CategoryWeakness[]
  prescriptions: CoachingPrescription[]
  consultTypeErrors?: ConsultTypeErrorAnalysis[]
  consultTypeCorrections?: ConsultTypeCorrectionAnalysis
  coachingFrequency: string  // 자율/격주/주1회/주2회
  status: 'planned' | 'in_progress' | 'completed'
}

// 신입 상담사 프로파일
export interface NewHireProfile {
  agentId: string
  agentName: string
  center: string
  service: string
  channel: string
  hireDate: string
  tenureDays: number
  // QC 현황 (데일리)
  weeklyQcEvals: number
  weeklyQcErrors: number
  weeklyQcErrorRate: number
  dailyQcTrend: Array<{ date: string; errorRate: number; evalCount: number }>
  categoryErrors: Array<{ categoryId: CoachingCategoryId; label: string; count: number }>
  // CSAT (채팅 신입만)
  csatAvg?: number
  csatLowRate?: number    // 1-2점 비율
  // 코호트 대비
  cohortWeek: number      // 입사 후 주차
  cohortAvgErrorRate: number  // 같은 주차의 과거 코호트 평균
  isSlowStabilization: boolean  // 코호트 대비 안정화 지연
}

// 코칭 경보
export type AlertType =
  | 'deterioration'     // 주간 오류율 급등
  | 'no_improvement'    // 2주간 미개선
  | 'new_issue'         // 신규 오류 카테고리 발생
  | 'coaching_overdue'  // 코칭 미실시
  | 'new_hire_slow'     // 신입 안정화 지연

export interface CoachingAlert {
  alertId: string
  alertType: AlertType
  agentId: string
  agentName: string
  center: string
  severity: 'warning' | 'critical'
  message: string
  detail: string
  createdAt: string
  acknowledged: boolean
}

// 코칭 효과 측정
export interface CoachingEffectiveness {
  month: string
  totalCoached: number
  improvedCount: number
  improvementRate: number // %
  categoryBreakdown: Array<{
    categoryId: CoachingCategoryId
    label: string
    coached: number
    improved: number
    rate: number
  }>
  newHireStabilizationRate: number // 2개월 내 주의 이하 도달 비율
  avgSessionsPerAgent: number
}

// 베이지안 조정 QC 오류율
export interface BayesianQcRate {
  rawRate: number
  adjustedRate: number
  evalCount: number
  confidence: 'low' | 'moderate' | 'high'
  priorRate: number       // 그룹 평균 (사전분포)
}

// 추세 분석 결과
export interface TrendAnalysis {
  direction: 'improving' | 'stable' | 'deteriorating'
  slope: number           // WLS 회귀 기울기
  pValue: number
  isSignificant: boolean
  recentWeeks: number     // 분석 기간 (주)
}

// ============================================================
// 미흡상담사 관리 (24.04.01~ 시행)
// ============================================================

// 미흡상담사 선정 항목 4가지
export type UnderperformingCriterionId =
  | 'qa_knowledge'        // QA 업무지식 ≤7점 (월)
  | 'qc_attitude'         // QC 상담태도 ≥15% (주, 검수 10건↑)
  | 'qc_ops'              // QC 오상담/오처리 ≥10% (주, 검수 10건↑)
  | 'csat_low_score'      // 상담평가 저점(1·2점) ≥12건(월)/≥3건(주)

// 개별 항목 판정 결과
export interface UnderperformingCriterionResult {
  criterionId: UnderperformingCriterionId
  label: string
  period: 'weekly' | 'monthly'
  flagged: boolean        // 선정 기준 충족 여부
  value: number           // 실측값 (오류율 %, 점수, 건수)
  threshold: number       // 기준값
  evalCount?: number      // 검수 건수 (QC 항목용)
  minEvals?: number       // 최소 검수 건수 요건
  excluded?: boolean      // 제외 사유 (1개월 미만, 검수 부족 등)
  excludeReason?: string
}

// 상담사 미흡상담사 종합 판정
export interface UnderperformingStatus {
  agentId: string
  agentName: string
  center: string
  service: string
  channel: string
  tenureMonths: number
  // 판정 결과
  criteria: UnderperformingCriterionResult[]
  flaggedCount: number          // 적발 항목 수 (0~4)
  isFlagged: boolean            // 1개 이상 적발
  // 연속 적발 추적 (저품질 판정용)
  consecutiveWeeks: number      // 연속 주 적발 횟수
  isLowQuality: boolean         // 저품질 상담사 여부 (3주 연속 or 3항목 동시)
  lowQualityReason?: string     // 저품질 판정 사유
  isNewHireExempt: boolean      // 신입 유예 여부 (3개월 미만: 전배/배제 유예)
  // 해소 판정
  resolvedCriteria: UnderperformingCriterionId[]  // 해소된 항목
  allResolved: boolean          // 모든 항목 해소됨
}

// 미흡상담사 기준 설정
export interface UnderperformingCriterionConfig {
  id: UnderperformingCriterionId
  label: string
  category: string              // QA / QC / CSAT
  period: 'weekly' | 'monthly'
  threshold: number             // 선정 기준값
  direction: 'gte' | 'lte'     // gte=이상이면 적발, lte=이하이면 적발
  minEvals?: number             // 최소 검수 건수 (QC: 10건)
  minTenureMonths?: number      // 최소 근속 (QA: 1개월)
  resolution: {
    threshold: number           // 해소 기준값
    consecutiveWeeks?: number   // 해소에 필요한 연속 주수 (QC: 2주)
    nextMonth?: boolean         // M+1 기준 (QA: true)
  }
}

// ============================================================
// 근태 현황 (Attendance) 타입
// ============================================================

export interface AttendanceOverview {
  center: "용산" | "광주"
  date: string
  total?: number            // 총인원 (재직 상담사 전체)
  planned: number           // 계획인원 (재직 상담사 중 근무예정)
  actual: number            // 출근인원
  absent: number            // 미출근
  attendanceRate: number    // 출근율 %
}

export interface AttendanceDetail {
  center: "용산" | "광주"
  channel: string           // 유선, 채팅
  vertical: string          // 택시, 대리, 퀵/배송 등
  shiftType: string         // 주간, 야간
  planned: number
  actual: number
  absent: number
  attendanceRate: number
}

export interface AttendanceDailyTrend {
  date: string
  center: "용산" | "광주"
  planned: number
  actual: number
  attendanceRate: number
}

/** 상담사별 미출근 현황 */
export interface AgentAbsence {
  center: "용산" | "광주"
  name: string
  id: string
  group: string           // 서비스(택시, 대리 등)
  position: string        // 유선, 채팅
  absenceDates: string[]  // 미출근 일자 목록
  absenceCount: number    // 미출근 건수
}

// ============================================================
// 생산성 (Productivity) 타입
// ============================================================

/** 버티컬(서비스) 분류 */
export type ProductivityVertical = "택시" | "대리" | "바이크" | "주차" | "퀵" | "배송" | "퀵/배송" | "내비" | "비즈" | "기타"

/** 채널 분류 */
export type ProductivityChannel = "유선" | "채팅"

/** 센터 분류 */
export type CenterName = "용산" | "광주"

/** 생산성 KPI 요약 */
export interface ProductivityOverview {
  center: CenterName | "전체"
  channel: ProductivityChannel
  responseRate: number          // 응대율 (%)
  totalIncoming: number         // 총 인입
  totalAnswered: number         // 총 응답
  totalOutbound: number         // 총 OB
  avgCPH: number                // 평균 CPH/TPH (시간당 처리건)
  avgCPD: number                // 평균 CPD/TPD (일 처리건)
  headcount: number             // 실투입 인원
  prevResponseRate?: number     // 전기간 응대율
  responseTrend?: number        // 응대율 증감 (pp)
}

/** 버티컬별 생산성 통계 */
export interface ProductivityVerticalStats {
  vertical: ProductivityVertical
  center: CenterName | "전체"
  channel: ProductivityChannel
  responseRate: number          // 응대율 (%)
  incoming: number              // 인입
  answered: number              // 응답
  outbound: number              // OB
  cpd: number                   // 인당 일 처리량
  headcount: number             // 실투입
  prevResponseRate?: number
}

/** 처리시간 통계 */
export interface ProductivityProcessingTime {
  vertical: ProductivityVertical
  center: CenterName | "전체"
  channel: ProductivityChannel
  avgWaitTime: number           // 평균 대기시간 (초) - ASA
  avgAbandonTime: number        // 평균 포기시간 (초) - ABA (포기자 평균 대기시간)
  avgTalkTime: number           // 평균 통화/채팅시간 (초) - ATT
  avgAfterWork: number          // 평균 후처리시간 (초) - ACW
  avgHandlingTime: number       // 상담처리시간 ATT+ACW (초) - SLA 핵심
  prevHandlingTime?: number
}

/** 일별 생산성 추이 */
export interface ProductivityDailyTrend {
  date: string                  // YYYY-MM-DD
  channel: ProductivityChannel
  center: CenterName | "전체"
  incoming: number
  answered: number
  outbound: number
  responseRate: number
}

/** 주간 생산성 추이 */
export interface ProductivityWeeklyTrend {
  weekStart: string             // YYYY-MM-DD (목요일)
  period: string                // "02/13-02/19"
  channel: ProductivityChannel
  center: CenterName | "전체"
  incoming: number
  answered: number
  outbound: number
  responseRate: number
  avgHandlingTime: number
}

/** 게시판 현황 */
export interface BoardStats {
  date: string
  center: CenterName | "전체"
  received: number              // 접수
  processed: number             // 처리
  remaining: number             // 잔여
}

/** 주간 요약 행 (3주 추이 테이블용) */
export interface WeeklySummaryRow {
  weekStart: string        // YYYY-MM-DD (목요일)
  weekEnd: string          // YYYY-MM-DD (수요일)
  weekLabel: string        // "01/29-02/04"
  channel: "유선" | "채팅"
  center: CenterName
  responseRate: number
  incoming: number
  answered: number
  outbound: number
  dayCount: number         // 해당 주 실제 데이터 일수 (7 미만이면 진행중)
}

/** 외국어 응대율 일별 통계 */
export interface ForeignLangStats {
  date: string
  center: CenterName
  incoming: number
  answered: number
  responseRate: number
}

/** 생산성 대시보드 전체 데이터 */
export interface ProductivityDashboardData {
  overview: ProductivityOverview[]
  verticalStats: ProductivityVerticalStats[]
  processingTime: ProductivityProcessingTime[]
  dailyTrend: ProductivityDailyTrend[]
  weeklyTrend: ProductivityWeeklyTrend[]
  boardStats: BoardStats[]
}

// ============================================================
// SLA 평가 타입
// ============================================================

/** SLA 등급 */
export type SLAGrade = "S" | "A" | "B" | "C" | "D" | "E"

/** SLA 배점 구간 */
export interface SLATier {
  label: string                 // "85% 초과", "280초 이하" 등
  minValue?: number             // 이 값 이상이면 적용 (응대율 등)
  maxValue?: number             // 이 값 이하이면 적용 (처리시간 등)
  score: number                 // 획득 점수
}

/** SLA 개별 지표 설정 */
export interface SLAMetric {
  id: string                    // "voice_response_rate"
  name: string                  // "응대율(유선)"
  category: "생산성" | "품질" | "인력관리"
  maxScore: number              // 배점 (15, 10, 9 등)
  tiers: SLATier[]              // 구간별 점수 (높은 점수부터)
  unit: "%" | "초" | "점"       // 단위
  direction: "higher_better" | "lower_better"  // 응대율=높을수록, 처리시간=낮을수록
}

/** SLA 가감점 항목 */
export interface SLADeduction {
  id: string                    // "turnover_rate"
  name: string                  // "퇴사율"
  score: number                 // 가감 점수 (+, -)
  reason?: string               // 사유
}

/** 센터별 SLA 설정 */
export interface SLAConfig {
  center: CenterName
  year: number
  productivity: SLAMetric[]     // 생산성 60점
  quality: SLAMetric[]          // 품질 40점
  personnel: SLAMetric[]        // 인력관리 (상담사 퇴사율 등)
  deductions: SLADeduction[]    // 가감점 (관리자 퇴사, 오처리, 보안)
}

/** SLA 항목별 점수 상세 */
export interface SLAScoreDetail {
  metricId: string
  name: string
  category: "생산성" | "품질" | "인력관리"
  maxScore: number              // 배점
  actualValue: number           // 실적값
  score: number                 // 획득 점수
  unit: string
  achievementRate: number       // 달성률 (%)
  direction: "higher_better" | "lower_better"
}

/** SLA 산정 결과 */
export interface SLAResult {
  center: CenterName
  month: string                 // YYYY-MM
  productivityScore: number     // 생산성 소계 (60점 만점)
  qualityScore: number          // 품질 소계 (40점 만점)
  personnelScore: number        // 인력관리 소계 (상담사 퇴사율 등)
  deductionScore: number        // 가감점 합계 (관리자 퇴사, 오처리, 보안)
  totalScore: number            // 총점
  grade: SLAGrade               // 등급
  rate: number                  // 요율 (1.03 ~ 0.97)
  details: SLAScoreDetail[]     // 항목별 상세
  deductions: SLADeduction[]    // 가감점 내역
}

/** SLA 월별 추이 */
export interface SLAMonthlyTrend {
  month: string                 // YYYY-MM
  center: CenterName
  totalScore: number
  grade: SLAGrade
  productivityScore: number
  qualityScore: number
}

/** 일별 SLA 누적 데이터 포인트 */
export interface SLADailyPoint {
  date: string                  // YYYY-MM-DD
  center: CenterName
  totalScore: number
  productivityScore: number
  qualityScore: number
  grade: SLAGrade
  voiceResponseRate: number     // 누적 응대율(유선)
  chatResponseRate: number      // 누적 응대율(채팅)
  voiceIncoming: number         // 누적 인입
  voiceAnswered: number         // 누적 응답
  chatIncoming: number
  chatAnswered: number
}

/** 데일리 트래킹 전체 응답 */
export interface SLADailyTrackingData {
  center: CenterName
  month: string
  dailyPoints: SLADailyPoint[]
  projection: { date: string; score: number; grade: SLAGrade }[]
  prevMonthScore: number
  prevMonthGrade: SLAGrade
  latestScore: number
  latestGrade: SLAGrade
  projectedEndScore: number
  projectedEndGrade: SLAGrade
  elapsedDays: number
  totalDays: number
  atRiskMetrics: {
    metricId: string
    name: string
    currentValue: number
    prevValue: number
    currentScore: number
    maxScore: number
    direction: "higher_better" | "lower_better"
    trend: "improving" | "stable" | "declining"
  }[]
}

// ═══════════════════════════════════════════════════════════════
// ═══ Pulse 2 Types ═══
// ═══════════════════════════════════════════════════════════════

// ============================================================
// 코칭 세션 (Coaching Sessions)
// ============================================================

/** 코칭 액션 아이템 */
export interface CoachingActionItem {
  description: string
  due_date?: string
  completed: boolean
}

/** 코칭 세션 — 강사 ↔ 상담사 1:1 코칭 기록 */
export interface CoachingSession {
  session_id: string
  agent_id: string
  agent_name: string
  instructor_id: string
  instructor_name: string
  center: string
  service?: string
  channel?: string
  session_date: string                          // YYYY-MM-DD
  session_type: 'scheduled' | 'ad_hoc' | 'follow_up'
  duration_minutes?: number
  target_month: string                          // YYYY-MM
  weakness_categories: string[]                 // 코칭 대상 카테고리 배열
  coaching_content?: string
  action_items?: CoachingActionItem[]
  // 성과 스냅샷 (코칭 시점)
  snapshot_qc_att_rate?: number
  snapshot_qc_ops_rate?: number
  snapshot_qa_score?: number
  snapshot_csat_score?: number
  snapshot_risk_score?: number
  status: 'scheduled' | 'completed' | 'cancelled'
  created_by: string
  created_at: string
  updated_at: string
}

// ============================================================
// 코칭 피드백 (Coaching Feedback)
// ============================================================

/** 양방향 코칭 피드백 (강사→상담사, 상담사→강사) */
export interface CoachingFeedback {
  feedback_id: string
  session_id: string
  direction: 'instructor_to_agent' | 'agent_to_instructor'
  from_user_id: string
  to_user_id: string
  feedback_date: string
  rating?: number                               // 1~5
  content: string
  improvement_noted: boolean
  created_at: string
}

// ============================================================
// 활동 계획 (Activity Plans)
// ============================================================

/** 상담사 활동 계획 — 주간 개선 과제 */
export interface ActivityPlan {
  plan_id: string
  agent_id: string
  agent_name: string
  center: string
  plan_week: string                             // 목요일 시작 "YYYY-MM-DD"
  plan_date: string
  target_category_id: string
  target_description: string
  target_metric?: string
  actual_result?: string
  actual_metric_value?: number
  achievement_status: 'pending' | 'in_progress' | 'completed' | 'missed'
  coaching_session_id?: string
  approved_by?: string
  approved_at?: string
  created_by: string
  created_at: string
  updated_at: string
}

// ============================================================
// AI 리포트 (AI-Generated Reports)
// ============================================================

/** AI 생성 리포트 — LLM 기반 자동 분석 보고서 */
export interface AIReport {
  report_id: string
  report_type: 'agent_daily' | 'agent_weekly' | 'center_weekly' | 'company_monthly'
  scope_type: 'agent' | 'center' | 'all'
  scope_id?: string
  target_month?: string
  target_week?: string
  report_date: string
  title: string
  summary: string
  full_content: string
  data_snapshot?: string                        // JSON stringified
  model_id?: string
  prompt_tokens?: number
  completion_tokens?: number
  visibility: 'internal' | 'shared'
  center?: string
  status: 'generating' | 'generated' | 'failed'
  created_by: string
  created_at: string
}

// ============================================================
// 자동 리스크 평가 (Risk Assessment — 7도메인)
// ============================================================

/** 5단계 리스크 레벨 (Pulse 2) */
export type RiskLevel5 = 'normal' | 'caution' | 'warning' | 'severe' | 'critical'

/** QC 신뢰도 */
export type QcConfidence = 'low' | 'moderate' | 'high'

/** 추세 방향 */
export type TrendDirection = 'improving' | 'stable' | 'deteriorating'

/** 자동 리스크 평가 — 7도메인(QC/QA/CSAT/Quiz/생산성/근태/SLA) 종합 */
export interface RiskAssessment {
  assessment_id: string
  agent_id: string
  center: string
  assessment_date: string
  assessment_month: string
  // 원시 점수
  raw_qc_att_rate?: number
  raw_qc_ops_rate?: number
  raw_qa_score?: number
  raw_csat_score?: number
  raw_quiz_score?: number
  raw_productivity_rate?: number
  raw_attendance_rate?: number
  raw_sla_score?: number
  // 베이지안 보정
  adjusted_qc_rate?: number
  qc_confidence?: QcConfidence
  // 가중 리스크
  risk_score: number
  risk_level: RiskLevel5
  coaching_tier?: string
  coaching_frequency?: string
  top_weaknesses?: string[]
  trend_direction?: TrendDirection
  prev_risk_score?: number
  is_underperforming: boolean
  consecutive_flagged_weeks: number
  created_at: string
}

// ============================================================
// 확장된 월간 요약 (7도메인 AgentMonthlySummaryV2)
// ============================================================

/** AgentMonthlySummary 확장 — 생산성/근태/SLA + 코칭 메타 추가 */
export interface AgentMonthlySummaryV2 extends AgentMonthlySummary {
  // 생산성
  productivity_cph?: number
  productivity_response_rate?: number
  // 근태
  attendance_rate?: number
  // SLA
  sla_score?: number
  sla_grade?: string
  // 종합 성과
  performance_score?: number
  active_domain_count_v2?: number               // 7도메인 기준 활성 도메인 수
  // 코칭 연동
  coaching_session_count?: number
  last_coaching_date?: string
}
