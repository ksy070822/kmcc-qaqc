import { type NextRequest, NextResponse } from "next/server"
import { saveBatchToFirestore, saveEvaluationsToFirestore } from "@/lib/firebase-admin"

// CORS 헤더 설정
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

// OPTIONS 요청 처리 (CORS preflight)
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

// Google Apps Script에서 POST로 데이터를 받는 API
export async function POST(request: NextRequest) {
  try {
    // 요청 본문 읽기
    let data
    try {
      const body = await request.text()
      if (!body) {
        return NextResponse.json(
          { success: false, error: "Request body is empty" },
          { status: 400, headers: corsHeaders }
        )
      }
      data = JSON.parse(body)

      // 디버깅: 수신된 데이터 구조 로깅
      console.log("[API] 수신된 데이터 타입:", typeof data)
      console.log("[API] 데이터 키:", Object.keys(data || {}))
      if (data && typeof data === 'object') {
        console.log("[API] yonsan 존재:", 'yonsan' in data, "타입:", Array.isArray(data.yonsan))
        console.log("[API] gwangju 존재:", 'gwangju' in data, "타입:", Array.isArray(data.gwangju))
        console.log("[API] batch:", data.batch)
        if (data.yonsan) {
          console.log("[API] yonsan 길이:", Array.isArray(data.yonsan) ? data.yonsan.length : "배열 아님")
        }
        if (data.gwangju) {
          console.log("[API] gwangju 길이:", Array.isArray(data.gwangju) ? data.gwangju.length : "배열 아님")
        }
      }
    } catch (parseError) {
      console.error("[API] JSON parse error:", parseError)
      return NextResponse.json(
        { success: false, error: "Invalid JSON format", details: String(parseError) },
        { status: 400, headers: corsHeaders }
      )
    }

    // 데이터 형식 확인 및 처리
    let parsedData

    // 형식 1: Apps Script 형식 { yonsan: [...], gwangju: [...] } (배치 지원)
    // data가 객체이고 yonsan 또는 gwangju 속성이 있는지 확인
    const isObject = data && typeof data === 'object' && !Array.isArray(data)
    const hasYonsan = isObject && (data.yonsan !== undefined || 'yonsan' in data)
    const hasGwangju = isObject && (data.gwangju !== undefined || 'gwangju' in data)

    console.log(`[API] 데이터 검증: isObject=${isObject}, hasYonsan=${hasYonsan}, hasGwangju=${hasGwangju}, isArray=${Array.isArray(data)}, type=${typeof data}`)
    if (isObject) {
      console.log(`[API] 데이터 키: ${Object.keys(data).join(', ')}`)
      console.log(`[API] yonsan 타입: ${typeof data.yonsan}, isArray: ${Array.isArray(data.yonsan)}`)
      console.log(`[API] gwangju 타입: ${typeof data.gwangju}, isArray: ${Array.isArray(data.gwangju)}`)
    }

    if (hasYonsan || hasGwangju) {
      const batchNumber = data.batch || 0
      const isLast = data.isLast === true
      const processedSoFar = data.processedSoFar || 0
      const totalRecords = data.totalRecords || 0

      console.log(`[API] Apps Script 배치 데이터 수신: 배치 ${batchNumber}, ${isLast ? '마지막' : '진행중'}`)

      const yonsanRecords = Array.isArray(data.yonsan) ? data.yonsan : []
      const gwangjuRecords = Array.isArray(data.gwangju) ? data.gwangju : []

      console.log(`[API] 배치 데이터: 용산 ${yonsanRecords.length}건, 광주 ${gwangjuRecords.length}건`)

      // 빈 배치도 허용 (배치 처리 중일 수 있음)
      if (yonsanRecords.length === 0 && gwangjuRecords.length === 0) {
        return NextResponse.json(
          {
            success: true,
            message: `배치 ${batchNumber}: 빈 배치 (스킵)`,
            timestamp: new Date().toISOString(),
            batch: {
              batchNumber,
              isLast,
              processedSoFar,
              totalRecords,
              currentBatch: { evaluations: 0, agents: 0 },
            },
          },
          { headers: corsHeaders }
        )
      }

      parsedData = parseAppsScriptData(yonsanRecords, gwangjuRecords)

      // 배치 정보 포함
      ;(parsedData as any).batchInfo = {
        batchNumber,
        isLast,
        processedSoFar,
        totalRecords,
        currentBatchSize: yonsanRecords.length + gwangjuRecords.length,
      }
    }
    // 형식 2: 로우 배열 형식 [[headers], [row1], [row2], ...]
    else if (Array.isArray(data) && data.length > 0) {
      console.log("[API] 로우 배열 형식 데이터 수신")
      const headers = data[0] as string[]
      const rows = data.slice(1)
      parsedData = parseQCData(headers, rows)
    }
    // 형식 3: 테스트 요청
    else if (data.test === true) {
      return NextResponse.json(
        {
          success: true,
          message: "연결 테스트 성공",
          timestamp: new Date().toISOString(),
          received: data,
        },
        { headers: corsHeaders }
      )
    }
    else {
      return NextResponse.json(
        { success: false, error: "Invalid data format: expected {yonsan, gwangju} or array" },
        { status: 400, headers: corsHeaders }
      )
    }

    // Firebase에 데이터 저장
    const batchInfo = (parsedData as any).batchInfo

    if (batchInfo) {
      // 배치 처리 - Firebase에 저장
      console.log(`[API] 배치 ${batchInfo.batchNumber} Firebase 저장 시작: ${parsedData.evaluations.length}건`)

      const saveResult = await saveBatchToFirestore(
        parsedData.evaluations,
        parsedData.agents,
        batchInfo.batchNumber
      )

      if (!saveResult.success) {
        console.error(`[API] 배치 ${batchInfo.batchNumber} Firebase 저장 실패:`, saveResult.error)
        return NextResponse.json(
          {
            success: false,
            error: `Firebase 저장 실패: ${saveResult.error}`,
            batch: batchInfo,
          },
          { status: 500, headers: corsHeaders }
        )
      }

      console.log(`[API] 배치 ${batchInfo.batchNumber} Firebase 저장 완료: ${saveResult.savedCount}건`)

      return NextResponse.json(
        {
          success: true,
          message: `배치 ${batchInfo.batchNumber} 처리 완료: ${parsedData.evaluations.length}건 (Firebase 저장됨)`,
          timestamp: new Date().toISOString(),
          batch: {
            batchNumber: batchInfo.batchNumber,
            isLast: batchInfo.isLast,
            processedSoFar: batchInfo.processedSoFar + parsedData.evaluations.length,
            totalRecords: batchInfo.totalRecords,
            currentBatch: {
              evaluations: parsedData.evaluations.length,
              agents: parsedData.agents.length,
            },
          },
          firebase: {
            saved: saveResult.savedCount,
            agents: saveResult.agents,
          },
        },
        { headers: corsHeaders }
      )
    } else {
      // 일반 처리 - Firebase에 저장
      console.log(`[API] Firebase 저장 시작: ${parsedData.evaluations.length} evaluations, ${parsedData.agents.length} agents`)

      const saveResult = await saveEvaluationsToFirestore(
        parsedData.evaluations,
        parsedData.agents
      )

      if (!saveResult.success) {
        console.error(`[API] Firebase 저장 실패:`, saveResult.error)
        return NextResponse.json(
          {
            success: false,
            error: `Firebase 저장 실패: ${saveResult.error}`,
          },
          { status: 500, headers: corsHeaders }
        )
      }

      console.log(`[API] Firebase 저장 완료: ${saveResult.evaluations}건`)

      return NextResponse.json(
        {
          success: true,
          message: `${parsedData.evaluations.length}건의 평가 데이터가 동기화되었습니다. (Firebase 저장됨)`,
          timestamp: new Date().toISOString(),
          summary: {
            agents: parsedData.agents.length,
            evaluations: parsedData.evaluations.length,
          },
          firebase: {
            saved: saveResult.evaluations,
            agents: saveResult.agents,
          },
        },
        { headers: corsHeaders }
      )
    }
  } catch (error) {
    console.error("[API] Sync error:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        success: false,
        error: "데이터 동기화 중 오류가 발생했습니다.",
        details: errorMessage,
      },
      { status: 500, headers: corsHeaders }
    )
  }
}

// GET 요청으로 동기화 상태 확인
export async function GET() {
  return NextResponse.json(
    {
      status: "ready",
      lastSync: new Date().toISOString(),
      message: "동기화 API가 정상 작동 중입니다.",
    },
    { headers: corsHeaders }
  )
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

// Apps Script 형식 데이터 파싱
function parseAppsScriptData(yonsanRecords: any[], gwangjuRecords: any[]) {
  const agents: any[] = []
  const evaluations: any[] = []
  const agentMap = new Map()

  // 용산 + 광주 데이터 처리
  const allRecords = [...yonsanRecords, ...gwangjuRecords]

  allRecords.forEach((record, index) => {
    try {
      const agentId = record.id || `AGT${index}`
      const agentName = record.name || ""

      // 상담사 정보 저장
      if (!agentMap.has(agentId) && agentName) {
        agentMap.set(agentId, {
          id: agentId,
          name: agentName,
          center: record.center || "",
          group: record.service || "",
          tenure: record.tenure || "",
          hireDate: record.hireDate || "",
          manager: `${record.service || ""}장`,
        })
      }

      // 평가 항목 매핑
      const items: Record<string, number> = {}
      if (Array.isArray(record.evaluationItems)) {
        // 평가 항목 인덱스를 이름으로 매핑
        const itemNames = [
          "첫인사/끝인사 누락",
          "공감표현 누락",
          "사과표현 누락",
          "추가문의 누락",
          "불친절",
          "상담유형 오설정",
          "가이드 미준수",
          "본인확인 누락",
          "필수탐색 누락",
          "오안내",
          "전산 처리 누락",
          "전산 처리 미흡/정정",
          "전산 조작 미흡/오류",
          "콜/픽/트립ID 매핑누락&오기재",
          "플래그/키워드 누락&오기재",
          "상담이력 기재 미흡",
        ]

        record.evaluationItems.forEach((value: number, idx: number) => {
          if (idx < itemNames.length) {
            items[itemNames[idx]] = value || 0
          }
        })
      }

      // 평가 데이터 추가
      if (record.evalDate && agentId) {
        evaluations.push({
          date: record.evalDate,
          agentId,
          agentName,
          center: record.center || "",
          service: record.service || "",
          tenure: record.tenure || "",
          items,
          totalCalls: 0, // Apps Script 데이터에 없으면 0
          errorRate: record.totalErrors || 0,
          attitudeErrors: record.attitudeErrors || 0,
          businessErrors: record.businessErrors || 0,
        })
      }
    } catch (e) {
      console.error(`[API] Record ${index} parsing error:`, e)
    }
  })

  return {
    agents: Array.from(agentMap.values()),
    evaluations,
  }
}
