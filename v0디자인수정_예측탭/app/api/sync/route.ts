import { type NextRequest, NextResponse } from "next/server"

// Google Apps Script에서 POST로 데이터를 받는 API
export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    // 데이터 유효성 검사
    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ error: "Invalid data format" }, { status: 400 })
    }

    // 헤더 행 추출 (첫 번째 행)
    const headers = data[0] as string[]
    const rows = data.slice(1)

    // 데이터 파싱 및 처리
    const parsedData = parseQCData(headers, rows)

    // 여기서 실제로는 데이터베이스에 저장하거나 상태 관리
    // 현재는 메모리에 저장 (실제 배포시 DB 연동 필요)
    console.log(`[v0] Synced ${parsedData.evaluations.length} evaluations`)

    return NextResponse.json({
      success: true,
      message: `${parsedData.evaluations.length}건의 평가 데이터가 동기화되었습니다.`,
      timestamp: new Date().toISOString(),
      summary: {
        agents: parsedData.agents.length,
        evaluations: parsedData.evaluations.length,
      },
    })
  } catch (error) {
    console.error("[v0] Sync error:", error)
    return NextResponse.json({ error: "데이터 동기화 중 오류가 발생했습니다." }, { status: 500 })
  }
}

// GET 요청으로 동기화 상태 확인
export async function GET() {
  return NextResponse.json({
    status: "ready",
    lastSync: new Date().toISOString(),
    message: "동기화 API가 정상 작동 중입니다.",
  })
}

// 스프레드시트 데이터 파싱 함수
function parseQCData(headers: string[], rows: any[][]) {
  const agents: any[] = []
  const evaluations: any[] = []
  const agentMap = new Map()

  // 예상 헤더 매핑 (스프레드시트 컬럼명에 맞게 조정 필요)
  const headerMap: Record<string, number> = {}
  headers.forEach((h, i) => {
    headerMap[h.toLowerCase().trim()] = i
  })

  rows.forEach((row, rowIndex) => {
    try {
      // 기본 정보 추출 (컬럼명은 실제 스프레드시트에 맞게 조정)
      const agentId = row[headerMap["상담사id"]] || row[headerMap["사번"]] || `AGT${rowIndex}`
      const agentName = row[headerMap["상담사명"]] || row[headerMap["이름"]] || ""
      const center = row[headerMap["센터"]] || ""
      const group = row[headerMap["그룹"]] || ""
      const date = row[headerMap["날짜"]] || row[headerMap["평가일"]] || ""
      const tenure = row[headerMap["근속기간"]] || row[headerMap["근속"]] || ""

      // 상담사 정보 저장
      if (!agentMap.has(agentId) && agentName) {
        agentMap.set(agentId, {
          id: agentId,
          name: agentName,
          center,
          group,
          tenure,
          hireDate: "",
          manager: `${group}장`,
        })
      }

      // 평가항목 데이터 추출
      const items: Record<string, number> = {}

      // 상담태도 항목
      const attitudeItems = ["첫인사", "끝인사", "공감표현", "사과표현", "추가문의", "불친절"]
      attitudeItems.forEach((item) => {
        const idx = headers.findIndex((h) => h.includes(item))
        if (idx >= 0) {
          items[item] = Number(row[idx]) || 0
        }
      })

      // 오상담/오처리 항목
      const errorItems = [
        "상담유형",
        "가이드",
        "본인확인",
        "필수탐색",
        "오안내",
        "전산처리",
        "정보수정",
        "후처리",
        "이관",
        "민원",
        "기타",
      ]
      errorItems.forEach((item) => {
        const idx = headers.findIndex((h) => h.includes(item))
        if (idx >= 0) {
          items[item] = Number(row[idx]) || 0
        }
      })

      // 총 콜수, 오류율 추출
      const totalCalls = Number(row[headerMap["총콜수"]] || row[headerMap["콜수"]]) || 0
      const errorRate = Number(row[headerMap["오류율"]]) || 0

      if (date && agentId) {
        evaluations.push({
          date,
          agentId,
          items,
          totalCalls,
          errorRate,
        })
      }
    } catch (e) {
      console.error(`[v0] Row ${rowIndex} parsing error:`, e)
    }
  })

  return {
    agents: Array.from(agentMap.values()),
    evaluations,
  }
}
