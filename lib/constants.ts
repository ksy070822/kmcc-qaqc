/**
 * KMCC QC 대시보드 상수 정의
 * 평가 항목, 센터/서비스/채널/근속 구분 등
 * 컴포넌트에서 공통으로 사용하는 상수
 */
import type { EvaluationItem } from "./types"

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

// 서비스 정렬 순서 (센터비교 표에서 항상 이 순서)
export const SERVICE_ORDER = ["택시", "대리", "배송", "바이크/마스", "주차/카오너", "화물", "심야"] as const

// 서비스명 정규화 맵 (BQ 원본 / 변형 → 표준 표시명)
export const SERVICE_NORMALIZE_MAP: Record<string, string> = {
  // 배송 변형
  "퀵": "배송",
  "퀵배송": "배송",
  "퀵·배송": "배송",
  "도보배송": "배송",
  "한차배송": "배송",
  // 택시 변형
  "심사": "택시",
  // 바이크/마스 변형 (1depth 언더바 앞 추출 결과)
  "바이크": "바이크/마스",
  "마스": "바이크/마스",
  "MaaS": "바이크/마스",
  "바이크&MaaS": "바이크/마스",
  "바이크/MaaS": "바이크/마스",
  // 주차/카오너 변형
  "주차": "주차/카오너",
  "카오너": "주차/카오너",
  "주차/카오너 채팅": "주차/카오너",
  "주차&카오너": "주차/카오너",
  // combined service+channel 폴백 (BQ 미마이그레이션분)
  "택시 / 유선": "택시",
  "택시 / 채팅": "택시",
  "대리 / 유선": "대리",
  "대리 / 채팅": "대리",
  "주차&카오너 / 채팅": "주차/카오너",
  "주차&카오너 / 유선": "주차/카오너",
  "바이크&MaaS / 채팅": "바이크/마스",
  "바이크&MaaS / 유선": "바이크/마스",
}

// combined service+channel → 채널 추출 (service 필드에 채널이 포함된 경우)
export const SERVICE_CHANNEL_EXTRACT: Record<string, string> = {
  "택시 / 유선": "유선",
  "택시 / 채팅": "채팅",
  "대리 / 유선": "유선",
  "대리 / 채팅": "채팅",
  "주차&카오너 / 채팅": "채팅",
  "주차&카오너 / 유선": "유선",
  "바이크&MaaS / 채팅": "채팅",
  "바이크&MaaS / 유선": "유선",
}

// 유효 채널 (이 외의 값은 센터비교에서 제외: 게시판/보드, 팀장, 모니터링, QC 등)
export const VALID_CHANNELS = ["유선", "채팅"] as const

// 잘못된 서비스명 (필터링/폴백 대상)
export const INVALID_SERVICE_NAMES = ["파트너가이드", "카카오 T", "카카오T", "#VALUE!", "", "지금여기", "Staff"]

// 서비스명 표시 매핑 (BQ 원본 → 화면 표시명)
export function displayServiceName(rawName: string, center?: string): string {
  if (!rawName) return rawName
  return SERVICE_NORMALIZE_MAP[rawName] || rawName
}

// 그룹 = 서비스 + 채널 조합
export const groups = {
  용산: ["택시/유선", "택시/채팅", "배송/유선", "배송/채팅"],
  광주: [
    "택시/유선",
    "택시/채팅",
    "대리/유선",
    "대리/채팅",
    "배송/유선",
    "배송/채팅",
    "바이크/마스/유선",
    "바이크/마스/채팅",
    "주차/카오너/유선",
    "주차/카오너/채팅",
    "화물/유선",
    "화물/채팅",
    "심야",
  ],
}

export const serviceGroups = {
  용산: ["택시", "배송"] as const,
  광주: ["택시", "대리", "배송", "바이크/마스", "주차/카오너", "화물", "심야"] as const,
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

// ============================================================
// QA(품질보증) 평가항목 상수
// ============================================================

import type { QAEvaluationItem } from "./types"

// QA 평가항목 (유선+채팅 통합, channelScope로 구분)
export const QA_EVALUATION_ITEMS: QAEvaluationItem[] = [
  // 공통 항목
  { id: "qa_greeting", category: "공통", name: "인사예절", shortName: "인사", columnKey: "greetingScore", maxScore: 6, channelScope: "all" },
  { id: "qa_response", category: "공통", name: "화답표현", shortName: "화답", columnKey: "responseExpression", maxScore: 5, channelScope: "all" },
  { id: "qa_inquiry", category: "공통", name: "문의내용파악", shortName: "문의파악", columnKey: "inquiryComprehension", maxScore: 5, channelScope: "all" },
  { id: "qa_identity", category: "공통", name: "본인확인", shortName: "본인확인", columnKey: "identityCheck", maxScore: 5, channelScope: "all" },
  { id: "qa_search", category: "공통", name: "필수탐색", shortName: "필수탐색", columnKey: "requiredSearch", maxScore: 5, channelScope: "all" },
  { id: "qa_knowledge", category: "공통", name: "업무지식", shortName: "업무지식", columnKey: "businessKnowledge", maxScore: 15, channelScope: "all" },
  { id: "qa_promptness", category: "공통", name: "신속성", shortName: "신속성", columnKey: "promptness", maxScore: 3, channelScope: "all" },
  { id: "qa_system", category: "공통", name: "전산처리", shortName: "전산처리", columnKey: "systemProcessing", maxScore: 6, channelScope: "all" },
  { id: "qa_history", category: "공통", name: "상담이력", shortName: "상담이력", columnKey: "consultationHistory", maxScore: 5, channelScope: "all" },
  { id: "qa_empathy", category: "공통", name: "감성케어", shortName: "감성케어", columnKey: "empathyCare", maxScore: 17, channelScope: "all" },
  { id: "qa_language", category: "공통", name: "언어표현", shortName: "언어표현", columnKey: "languageExpression", maxScore: 5, channelScope: "all" },
  { id: "qa_listening", category: "공통", name: "경청/집중태도", shortName: "경청", columnKey: "listeningFocus", maxScore: 5, channelScope: "all" },
  { id: "qa_explain", category: "공통", name: "설명능력", shortName: "설명능력", columnKey: "explanationAbility", maxScore: 5, channelScope: "all" },
  { id: "qa_satisfaction", category: "공통", name: "체감만족", shortName: "체감만족", columnKey: "perceivedSatisfaction", maxScore: 3, channelScope: "all" },
  { id: "qa_praise", category: "공통", name: "칭찬접수", shortName: "칭찬", columnKey: "praiseBonus", maxScore: 10, channelScope: "all" },
  // 유선 전용
  { id: "qa_voice", category: "유선전용", name: "음성연출", shortName: "음성연출", columnKey: "voicePerformance", maxScore: 8, channelScope: "voice" },
  { id: "qa_speech", category: "유선전용", name: "말속도/발음", shortName: "말속도", columnKey: "speechSpeed", maxScore: 2, channelScope: "voice" },
  { id: "qa_honorific", category: "유선전용", name: "호칭오류", shortName: "호칭오류", columnKey: "honorificError", maxScore: -1, channelScope: "voice" },
  // 채팅 전용
  { id: "qa_spelling", category: "채팅전용", name: "맞춤법", shortName: "맞춤법", columnKey: "spelling", maxScore: 5, channelScope: "chat" },
  { id: "qa_close", category: "채팅전용", name: "종료요청", shortName: "종료요청", columnKey: "closeRequest", maxScore: 3, channelScope: "chat" },
  { id: "qa_copy_err", category: "채팅전용", name: "복사오류", shortName: "복사오류", columnKey: "copyError", maxScore: -1, channelScope: "chat" },
  { id: "qa_op_err", category: "채팅전용", name: "조작오류", shortName: "조작오류", columnKey: "operationError", maxScore: -1, channelScope: "chat" },
]

// 채널별 필터링 헬퍼
export const QA_COMMON_ITEMS = QA_EVALUATION_ITEMS.filter(i => i.channelScope === "all")
export const QA_VOICE_ONLY_ITEMS = QA_EVALUATION_ITEMS.filter(i => i.channelScope === "voice")
export const QA_CHAT_ONLY_ITEMS = QA_EVALUATION_ITEMS.filter(i => i.channelScope === "chat")

// QA 채널별 만점 기준
export const QA_VOICE_TOTAL = 100 // 유선 만점
export const QA_CHAT_TOTAL = 100  // 채팅 만점

// QA 점수 등급 구간
export const QA_SCORE_GRADES = [
  { label: "우수", min: 92, color: "#22c55e" },
  { label: "양호", min: 90, color: "#3b82f6" },
  { label: "보통", min: 88, color: "#f59e0b" },
  { label: "미흡", min: 85, color: "#f97316" },
  { label: "부진", min: 0, color: "#ef4444" },
] as const

export function getQAScoreGrade(score: number): typeof QA_SCORE_GRADES[number] {
  return QA_SCORE_GRADES.find(g => score >= g.min) || QA_SCORE_GRADES[QA_SCORE_GRADES.length - 1]
}

// ============================================================
// CSAT(상담평점) 상수
// ============================================================

// CSAT 점수 분포 색상
export const CSAT_SCORE_COLORS: Record<number, string> = {
  5: "#22c55e",
  4: "#3b82f6",
  3: "#f59e0b",
  2: "#f97316",
  1: "#ef4444",
}

// CSAT 목표 평점
export const CSAT_TARGET_SCORE = 4.5

// ============================================================
// 통합 리스크 가중치
// ============================================================

export const RISK_WEIGHTS = {
  qa: 0.30,     // QA 점수 (30%)
  qc: 0.30,     // QC 오류율 (30%)
  csat: 0.25,   // CSAT 평점 (25%)
  knowledge: 0.15, // 직무테스트 (15%)
} as const

export const RISK_THRESHOLDS = {
  low: 30,
  medium: 50,
  high: 70,
  critical: 85,
} as const

// 리스크 레벨 UI 설정
export const RISK_LEVEL_CONFIG = {
  low:      { label: "양호", color: "#22c55e" },
  medium:   { label: "주의", color: "#f59e0b" },
  high:     { label: "위험", color: "#f97316" },
  critical: { label: "심각", color: "#ef4444" },
} as const

// 도메인 라벨
export const DOMAIN_LABELS: Record<string, string> = {
  qa: "QA (SLA)",
  qc: "QC",
  csat: "상담평점",
  quiz: "직무테스트",
}

// QC 오류율 정규화 상한 (20% → 100점 환산)
export const QC_RATE_CAP = 20
