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
