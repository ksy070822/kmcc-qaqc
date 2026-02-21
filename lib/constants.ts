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
