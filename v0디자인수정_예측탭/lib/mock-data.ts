import type { Agent, EvaluationItem, DailyEvaluation, GroupStats, AlertSetting, ActionPlan, Goal } from "./types"

// 평가항목 16개 (로우데이터 컬럼과 매핑)
export const evaluationItems: EvaluationItem[] = [
  // 상담태도 (5개)
  {
    id: "att1",
    category: "상담태도",
    name: "첫인사/끝인사 누락",
    shortName: "첫인사/끝인사",
    columnKey: "첫인사끝인사누락",
  },
  { id: "att2", category: "상담태도", name: "공감표현 누락", shortName: "공감표현", columnKey: "공감표현누락" },
  { id: "att3", category: "상담태도", name: "사과표현 누락", shortName: "사과표현", columnKey: "사과표현누락" },
  { id: "att4", category: "상담태도", name: "추가문의 누락", shortName: "추가문의", columnKey: "추가문의누락" },
  { id: "att5", category: "상담태도", name: "불친절", shortName: "불친절", columnKey: "불친절" },
  // 오상담/오처리 (11개)
  {
    id: "err1",
    category: "오상담/오처리",
    name: "상담유형 오설정",
    shortName: "상담유형 오설정",
    columnKey: "상담유형오설정",
  },
  {
    id: "err2",
    category: "오상담/오처리",
    name: "가이드 미준수",
    shortName: "가이드 미준수",
    columnKey: "가이드미준수",
  },
  {
    id: "err3",
    category: "오상담/오처리",
    name: "본인확인 누락",
    shortName: "본인확인 누락",
    columnKey: "본인확인누락",
  },
  {
    id: "err4",
    category: "오상담/오처리",
    name: "필수탐색 누락",
    shortName: "필수탐색 누락",
    columnKey: "필수탐색누락",
  },
  { id: "err5", category: "오상담/오처리", name: "오안내", shortName: "오안내", columnKey: "오안내" },
  {
    id: "err6",
    category: "오상담/오처리",
    name: "전산 처리 누락",
    shortName: "전산처리 누락",
    columnKey: "전산처리누락",
  },
  {
    id: "err7",
    category: "오상담/오처리",
    name: "전산 처리 미흡/정정",
    shortName: "전산처리 미흡",
    columnKey: "전산처리미흡정정",
  },
  {
    id: "err8",
    category: "오상담/오처리",
    name: "전산 조작 미흡/오류",
    shortName: "전산조작 오류",
    columnKey: "전산조작미흡오류",
  },
  {
    id: "err9",
    category: "오상담/오처리",
    name: "콜/픽/트립ID 매핑누락&오기재",
    shortName: "ID매핑 누락",
    columnKey: "콜픽트립ID매핑누락오기재",
  },
  {
    id: "err10",
    category: "오상담/오처리",
    name: "플래그/키워드 누락&오기재",
    shortName: "플래그/키워드",
    columnKey: "플래그키워드누락오기재",
  },
  {
    id: "err11",
    category: "오상담/오처리",
    name: "상담이력 기재 미흡",
    shortName: "상담이력 미흡",
    columnKey: "상담이력기재미흡",
  },
]

// 그룹 = 서비스 + 채널 조합
export const groups = {
  용산: ["택시/유선", "택시/채팅", "대리/유선", "대리/채팅", "배송/유선", "배송/채팅"],
  광주: [
    "택시/유선",
    "택시/채팅",
    "대리/유선",
    "대리/채팅",
    "배송/유선",
    "배송/채팅",
    "바이크&마스/유선",
    "바이크&마스/채팅",
    "주차&카오너/유선",
    "주차&카오너/채팅",
    "심야/유선",
    "심야/채팅",
  ],
}

export const serviceGroups = {
  용산: ["택시", "대리", "배송"] as const,
  광주: ["택시", "대리", "배송", "바이크&마스", "주차&카오너", "심야"] as const,
} as const

export const channelTypes = ["유선", "채팅"] as const

// 근속기간 구분
export const tenureCategories = ["3개월 미만", "3개월 이상", "6개월 이상", "12개월 이상"] as const
export const tenures = tenureCategories

export const getTenureCategory = (months: number): string => {
  if (months < 3) return "3개월 미만"
  if (months < 6) return "3개월 이상"
  if (months < 12) return "6개월 이상"
  return "12개월 이상"
}

// 목업 상담사 데이터
export const generateAgents = (): Agent[] => {
  const agents: Agent[] = []
  let id = 1

  Object.entries(groups).forEach(([center, groupList]) => {
    groupList.forEach((group) => {
      const agentCount = Math.floor(Math.random() * 20) + 15
      const [service, channel] = group.split("/")

      for (let i = 0; i < agentCount; i++) {
        const tenureMonths = Math.floor(Math.random() * 36) + 1
        agents.push({
          id: `AGT${String(id++).padStart(4, "0")}`,
          name: `상담사${id}`,
          odooId: `agent${id}.itx`,
          center: center as "용산" | "광주",
          service,
          channel: channel as "유선" | "채팅",
          group,
          tenureMonths,
          tenure: getTenureCategory(tenureMonths),
          hireDate: `202${Math.floor(Math.random() * 4)}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, "0")}-01`,
          manager: `${group} 관리자`,
        })
      }
    })
  })

  return agents
}

// 목업 일일 평가 데이터
export const generateDailyEvaluations = (agents: Agent[], days = 30): DailyEvaluation[] => {
  const evaluations: DailyEvaluation[] = []
  const today = new Date()

  for (let d = 0; d < days; d++) {
    const date = new Date(today)
    date.setDate(date.getDate() - d)
    const dateStr = date.toISOString().split("T")[0]

    agents.forEach((agent) => {
      const items: Record<string, number> = {}
      let attitudeErrors = 0
      let processErrors = 0

      evaluationItems.forEach((item) => {
        const errorCount = Math.random() > 0.85 ? Math.floor(Math.random() * 2) + 1 : 0
        items[item.id] = errorCount
        if (item.category === "상담태도") {
          attitudeErrors += errorCount
        } else {
          processErrors += errorCount
        }
      })

      const totalCalls = Math.floor(Math.random() * 30) + 20
      const totalErrors = attitudeErrors + processErrors

      evaluations.push({
        date: dateStr,
        agentId: agent.id,
        items,
        totalCalls,
        errorRate: totalCalls > 0 ? (totalErrors / totalCalls) * 100 : 0,
        attitudeErrorRate: totalCalls > 0 ? (attitudeErrors / totalCalls) * 100 : 0,
        processErrorRate: totalCalls > 0 ? (processErrors / totalCalls) * 100 : 0,
      })
    })
  }

  return evaluations
}

// 그룹별 통계
export const generateGroupStats = (agents: Agent[], evaluations: DailyEvaluation[]): GroupStats[] => {
  const stats: GroupStats[] = []
  const today = new Date().toISOString().split("T")[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0]

  Object.entries(groups).forEach(([center, groupList]) => {
    groupList.forEach((group) => {
      const groupAgents = agents.filter((a) => a.center === center && a.group === group)
      const todayEvals = evaluations.filter((e) => e.date === today && groupAgents.some((a) => a.id === e.agentId))
      const yesterdayEvals = evaluations.filter(
        (e) => e.date === yesterday && groupAgents.some((a) => a.id === e.agentId),
      )

      const todayRate =
        todayEvals.length > 0
          ? todayEvals.reduce((sum, e) => sum + e.errorRate, 0) / todayEvals.length
          : Math.random() * 4 + 1
      const yesterdayRate =
        yesterdayEvals.length > 0
          ? yesterdayEvals.reduce((sum, e) => sum + e.errorRate, 0) / yesterdayEvals.length
          : Math.random() * 4 + 1

      const attitudeRate =
        todayEvals.length > 0
          ? todayEvals.reduce((sum, e) => sum + e.attitudeErrorRate, 0) / todayEvals.length
          : Math.random() * 2 + 0.5
      const processRate =
        todayEvals.length > 0
          ? todayEvals.reduce((sum, e) => sum + e.processErrorRate, 0) / todayEvals.length
          : Math.random() * 3 + 1

      const targetRate = 3.0

      stats.push({
        group,
        center: center as "용산" | "광주",
        totalAgents: groupAgents.length,
        errorRate: Number(todayRate.toFixed(2)),
        attitudeErrorRate: Number(attitudeRate.toFixed(2)),
        processErrorRate: Number(processRate.toFixed(2)),
        trend: Number((todayRate - yesterdayRate).toFixed(2)),
        targetRate,
        achievementRate: Number(((targetRate / todayRate) * 100).toFixed(1)),
      })
    })
  })

  return stats
}

export const defaultAlertSettings: AlertSetting[] = [
  ...groups["용산"].map((group, i) => ({
    id: `alert-yongsan-${i}`,
    group,
    center: "용산" as const,
    attitudeThreshold: 2.0,
    processThreshold: 3.0,
    totalThreshold: 5.0,
    consecutiveDays: 3,
    weeklyChangeThreshold: 5,
    manager: `@may.0${(i % 9) + 1}`,
    managerSlackId: `@may.0${(i % 9) + 1}`,
    enabled: true,
  })),
  ...groups["광주"].map((group, i) => ({
    id: `alert-gwangju-${i}`,
    group,
    center: "광주" as const,
    attitudeThreshold: 2.0,
    processThreshold: 3.0,
    totalThreshold: 5.0,
    consecutiveDays: 3,
    weeklyChangeThreshold: 5,
    manager: `@may.0${(i % 9) + 1}`,
    managerSlackId: `@may.0${(i % 9) + 1}`,
    enabled: true,
  })),
]

// 액션플랜 목업
export const generateActionPlans = (agents: Agent[]): ActionPlan[] => {
  const watchAgents = agents.slice(0, 15)
  return watchAgents.map((agent, i) => ({
    id: `plan-${i}`,
    agentId: agent.id,
    agentName: agent.name,
    createdAt: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString().split("T")[0],
    issue: ["오류율 지속 상승", "불친절 반복", "전산처리 오류 다발", "본인확인 누락"][i % 4],
    plan: ["1:1 코칭 진행", "모니터링 강화", "재교육 실시", "업무 프로세스 점검"][i % 4],
    targetDate: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
    status: (["진행중", "완료", "지연"] as const)[i % 3],
    result: i % 3 === 1 ? "오류율 2% 감소" : undefined,
    completedAt: i % 3 === 1 ? new Date().toISOString().split("T")[0] : undefined,
    managerFeedback: i % 3 === 1 ? "코칭 후 명확한 개선 확인됨. 지속적인 모니터링 필요." : undefined,
    feedbackDate: i % 3 === 1 ? new Date().toISOString().split("T")[0] : undefined,
  }))
}

export const defaultGoals: Goal[] = [
  // 전체 목표
  {
    id: "goal-total-att",
    type: "태도",
    center: "전체",
    targetErrorRate: 2.0,
    currentRate: 1.85,
    period: "monthly",
    startDate: "2024-12-01",
    endDate: "2024-12-31",
  },
  {
    id: "goal-total-proc",
    type: "오상담/오처리",
    center: "전체",
    targetErrorRate: 3.0,
    currentRate: 2.45,
    period: "monthly",
    startDate: "2024-12-01",
    endDate: "2024-12-31",
  },
  {
    id: "goal-total-sum",
    type: "합계",
    center: "전체",
    targetErrorRate: 3.0,
    currentRate: 2.94,
    period: "monthly",
    startDate: "2024-12-01",
    endDate: "2024-12-31",
  },
  // 용산 목표
  {
    id: "goal-yongsan-att",
    type: "태도",
    center: "용산",
    targetErrorRate: 2.0,
    currentRate: 1.92,
    period: "monthly",
    startDate: "2024-12-01",
    endDate: "2024-12-31",
  },
  {
    id: "goal-yongsan-proc",
    type: "오상담/오처리",
    center: "용산",
    targetErrorRate: 3.0,
    currentRate: 2.58,
    period: "monthly",
    startDate: "2024-12-01",
    endDate: "2024-12-31",
  },
  {
    id: "goal-yongsan-sum",
    type: "합계",
    center: "용산",
    targetErrorRate: 3.0,
    currentRate: 2.85,
    period: "monthly",
    startDate: "2024-12-01",
    endDate: "2024-12-31",
  },
  // 광주 목표
  {
    id: "goal-gwangju-att",
    type: "태도",
    center: "광주",
    targetErrorRate: 2.0,
    currentRate: 1.75,
    period: "monthly",
    startDate: "2024-12-01",
    endDate: "2024-12-31",
  },
  {
    id: "goal-gwangju-proc",
    type: "오상담/오처리",
    center: "광주",
    targetErrorRate: 3.0,
    currentRate: 3.12,
    period: "monthly",
    startDate: "2024-12-01",
    endDate: "2024-12-31",
  },
  {
    id: "goal-gwangju-sum",
    type: "합계",
    center: "광주",
    targetErrorRate: 3.0,
    currentRate: 3.12,
    period: "monthly",
    startDate: "2024-12-01",
    endDate: "2024-12-31",
  },
]

export const generateTrendData = (days = 14) => {
  const data = []
  const today = new Date()

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    data.push({
      date: `${date.getMonth() + 1}/${date.getDate()}`,
      fullDate: date.toISOString().split("T")[0],
      용산_태도: Number((Math.random() * 1.5 + 1).toFixed(2)),
      용산_오상담: Number((Math.random() * 2 + 2).toFixed(2)),
      용산_합계: Number((Math.random() * 2 + 2.5).toFixed(2)),
      광주_태도: Number((Math.random() * 1.5 + 0.8).toFixed(2)),
      광주_오상담: Number((Math.random() * 2 + 1.5).toFixed(2)),
      광주_합계: Number((Math.random() * 2 + 2).toFixed(2)),
      목표: 3.0,
    })
  }

  return data
}

// 항목별 오류 분포 데이터
export const generateItemDistribution = () => {
  return evaluationItems.map((item) => ({
    name: item.shortName,
    fullName: item.name,
    category: item.category,
    용산: Math.floor(Math.random() * 50) + 10,
    광주: Math.floor(Math.random() * 50) + 10,
  }))
}
