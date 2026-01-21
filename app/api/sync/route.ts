import { type NextRequest, NextResponse } from "next/server"
import { saveEvaluationsToBigQuery } from "@/lib/bigquery"

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
    console.log("[API] ===== POST 요청 수신 =====")
    console.log("[API] 요청 URL:", request.url)
    console.log("[API] 요청 헤더:", Object.fromEntries(request.headers.entries()))
    
    // 요청 본문 읽기
    let data
    try {
      const body = await request.text()
      console.log("[API] 요청 본문 길이:", body.length)
      console.log("[API] 요청 본문 처음 500자:", body.substring(0, 500))
      
      if (!body) {
        console.error("[API] 요청 본문이 비어있음")
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
        console.log("[API] data 속성 존재:", 'data' in data, "타입:", typeof data.data, "isArray:", Array.isArray(data.data))
        console.log("[API] batch:", data.batch)
        if (data.yonsan) {
          console.log("[API] yonsan 길이:", Array.isArray(data.yonsan) ? data.yonsan.length : "배열 아님")
        }
        if (data.gwangju) {
          console.log("[API] gwangju 길이:", Array.isArray(data.gwangju) ? data.gwangju.length : "배열 아님")
        }
        if (data.data) {
          console.log("[API] data.data 길이:", Array.isArray(data.data) ? data.data.length : "배열 아님")
          if (Array.isArray(data.data) && data.data.length > 0) {
            console.log("[API] data.data 첫 번째 레코드:", JSON.stringify(data.data[0]).substring(0, 200))
          }
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

    // 형식 1: 새 데이터 구조 { data: [...], batch: ... } (agg_agent_daily 시트)
    const isObject = data && typeof data === 'object' && !Array.isArray(data)
    const hasDataArray = isObject && 'data' in data && Array.isArray(data.data)
    const hasBatch = isObject && 'batch' in data

    // 형식 2: 기존 Apps Script 형식 { yonsan: [...], gwangju: [...] } (배치 지원)
    const hasYonsan = isObject && 'yonsan' in data
    const hasGwangju = isObject && 'gwangju' in data

    console.log(`[API] 데이터 검증: isObject=${isObject}, hasDataArray=${hasDataArray}, hasBatch=${hasBatch}, hasYonsan=${hasYonsan}, hasGwangju=${hasGwangju}`)
    if (isObject) {
      console.log(`[API] 데이터 키: ${Object.keys(data).join(', ')}`)
      if ('data' in data) {
        console.log(`[API] data 속성 존재: true`)
        console.log(`[API] data 타입: ${typeof data.data}`)
        console.log(`[API] data isArray: ${Array.isArray(data.data)}`)
        console.log(`[API] data 값: ${typeof data.data === 'object' ? JSON.stringify(data.data).substring(0, 200) : String(data.data).substring(0, 200)}`)
        if (Array.isArray(data.data)) {
          console.log(`[API] data 배열 길이: ${data.data.length}`)
          if (data.data.length > 0) {
            console.log(`[API] data 첫 번째 요소: ${JSON.stringify(data.data[0]).substring(0, 200)}`)
          }
        }
      } else {
        console.log(`[API] data 속성이 없습니다!`)
      }
    }

    // 새 데이터 구조 처리 (agg_agent_daily)
    // hasDataArray가 false여도 batch가 있고 data 속성이 있으면 시도
    if (isObject && hasBatch && 'data' in data) {
      const dataArray = Array.isArray(data.data) ? data.data : []
      console.log(`[API] 새 데이터 구조 감지 시도: batch=${data.batch}, data 배열 길이=${dataArray.length}`)
      
      if (dataArray.length > 0) {
        const batchNumber = data.batch || 0
        const isLast = data.isLast === true
        const processedSoFar = data.processedSoFar || 0
        const totalRecords = data.totalRecords || 0
        const records = dataArray

        console.log(`[API] 새 데이터 구조 배치 수신: 배치 ${batchNumber}, ${records.length}건`)

        if (records.length === 0) {
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

        parsedData = parseNewStructureData(records)

        // 배치 정보 포함
        ;(parsedData as any).batchInfo = {
          batchNumber,
          isLast,
          processedSoFar,
          totalRecords,
          currentBatchSize: records.length,
        }
      } else {
        console.log(`[API] 새 데이터 구조이지만 data가 배열이 아니거나 비어있음: dataType=${typeof data.data}, isArray=${Array.isArray(data.data)}, length=${Array.isArray(data.data) ? data.data.length : 'N/A'}`)
      }
    }
    // 기존 Apps Script 형식 처리
    else if (isObject && (hasYonsan || hasGwangju)) {
      const batchNumber = data.batch || 0
      const isLast = data.isLast === true
      const processedSoFar = data.processedSoFar || 0
      const totalRecords = data.totalRecords || 0

      console.log(`[API] 기존 Apps Script 배치 데이터 수신: 배치 ${batchNumber}, ${isLast ? '마지막' : '진행중'}`)

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

    // BigQuery에 데이터 저장
    const batchInfo = (parsedData as any).batchInfo

    if (batchInfo) {
      // 배치 처리 - BigQuery에 저장
      console.log(`[API] 배치 ${batchInfo.batchNumber} BigQuery 저장 시작: ${parsedData.evaluations.length}건`)

      const saveResult = await saveEvaluationsToBigQuery(
        parsedData.evaluations
      )

      if (!saveResult.success) {
        console.error(`[API] 배치 ${batchInfo.batchNumber} BigQuery 저장 실패:`, saveResult.error)
        return NextResponse.json(
          {
            success: false,
            error: `BigQuery 저장 실패: ${saveResult.error}`,
            batch: batchInfo,
          },
          { status: 500, headers: corsHeaders }
        )
      }

      console.log(`[API] 배치 ${batchInfo.batchNumber} BigQuery 저장 완료: ${saveResult.saved}건`)

      return NextResponse.json(
        {
          success: true,
          message: `배치 ${batchInfo.batchNumber} 처리 완료: ${parsedData.evaluations.length}건 (BigQuery 저장됨)`,
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
          bigquery: {
            saved: saveResult.saved,
          },
        },
        { headers: corsHeaders }
      )
    } else {
      // 일반 처리 - BigQuery에 저장
      console.log(`[API] BigQuery 저장 시작: ${parsedData.evaluations.length} evaluations`)

      const saveResult = await saveEvaluationsToBigQuery(
        parsedData.evaluations
      )

      if (!saveResult.success) {
        console.error(`[API] BigQuery 저장 실패:`, saveResult.error)
        return NextResponse.json(
          {
            success: false,
            error: `BigQuery 저장 실패: ${saveResult.error}`,
          },
          { status: 500, headers: corsHeaders }
        )
      }

      console.log(`[API] BigQuery 저장 완료: ${saveResult.saved}건`)

      return NextResponse.json(
        {
          success: true,
          message: `${parsedData.evaluations.length}건의 평가 데이터가 동기화되었습니다. (BigQuery 저장됨)`,
          timestamp: new Date().toISOString(),
          summary: {
            agents: parsedData.agents.length,
            evaluations: parsedData.evaluations.length,
          },
          bigquery: {
            saved: saveResult.saved,
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
        // 날짜 형식 통일 (YYYY-MM-DD)
        let normalizedDate = record.evalDate
        
        // 날짜 정규화 함수: "2025. 12. 19", "2025.12.19", "2025-12-19" 등을 "2025-12-19"로 변환
        const normalizeDateString = (dateStr: string): string | null => {
          if (!dateStr) return null
          
          // 이미 YYYY-MM-DD 형식
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return dateStr
          }
          
          // "2025. 12. 19" 또는 "2025.12.19" 형식 처리
          const dotMatch = dateStr.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/)
          if (dotMatch) {
            const year = dotMatch[1]
            const month = String(parseInt(dotMatch[2], 10)).padStart(2, '0')
            const day = String(parseInt(dotMatch[3], 10)).padStart(2, '0')
            return `${year}-${month}-${day}`
          }
          
          // "2025/12/19" 형식 처리
          const slashMatch = dateStr.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/)
          if (slashMatch) {
            const year = slashMatch[1]
            const month = String(parseInt(slashMatch[2], 10)).padStart(2, '0')
            const day = String(parseInt(slashMatch[3], 10)).padStart(2, '0')
            return `${year}-${month}-${day}`
          }
          
          // Date 객체로 파싱 시도
          try {
            const dateObj = new Date(dateStr)
            if (!isNaN(dateObj.getTime())) {
              const year = dateObj.getFullYear()
              const month = String(dateObj.getMonth() + 1).padStart(2, '0')
              const day = String(dateObj.getDate()).padStart(2, '0')
              return `${year}-${month}-${day}`
            }
          } catch (e) {
            // Date 파싱 실패
          }
          
          return null
        }
        
        // 날짜 정규화
        if (typeof normalizedDate === 'string') {
          const normalized = normalizeDateString(normalizedDate)
          if (normalized) {
            normalizedDate = normalized
          } else {
            console.error(`[API] 날짜 변환 실패: ${normalizedDate}`)
            // 날짜 변환 실패 시 스킵
            return
          }
        } else {
          // Date 객체인 경우
          try {
            const dateObj = normalizedDate instanceof Date ? normalizedDate : new Date(normalizedDate)
            if (!isNaN(dateObj.getTime())) {
              const year = dateObj.getFullYear()
              const month = String(dateObj.getMonth() + 1).padStart(2, '0')
              const day = String(dateObj.getDate()).padStart(2, '0')
              normalizedDate = `${year}-${month}-${day}`
            } else {
              console.error(`[API] 날짜 변환 실패: ${normalizedDate}`)
              return
            }
          } catch (e) {
            console.error(`[API] 날짜 변환 실패: ${normalizedDate}`, e)
            return
          }
        }
        
        evaluations.push({
          date: normalizedDate, // 통일된 날짜 형식
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

// 새 데이터 구조 파싱 (agg_agent_daily 시트)
function parseNewStructureData(records: any[]) {
  const agents: any[] = []
  const evaluations: any[] = []
  const agentMap = new Map()

  records.forEach((record, index) => {
    try {
      const agentId = record.agentId || record.id || `AGT${index}`
      const agentName = record.agentName || record.name || ""
      const center = record.center || record.center_name || ""
      const group = record.group || record.service || record.group_name || ""
      const service = group // 그룹 = 서비스
      const tenure = record.tenure || ""

      // 상담사 정보 저장
      if (!agentMap.has(agentId) && agentName) {
        agentMap.set(agentId, {
          id: agentId,
          name: agentName,
          center: center,
          group: group,
          service: service,
          tenure: tenure,
          hireDate: "",
          manager: `${group || ""}장`,
        })
      }

      // 평가 데이터 추가
      if (record.date && agentId) {
        // 날짜 형식 통일 (YYYY-MM-DD)
        let normalizedDate = record.date
        
        // 날짜 정규화 함수
        const normalizeDateString = (dateStr: string): string | null => {
          if (!dateStr) return null
          
          // 이미 YYYY-MM-DD 형식
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return dateStr
          }
          
          // "2025. 12. 19" 또는 "2025.12.19" 형식 처리
          const dotMatch = dateStr.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/)
          if (dotMatch) {
            const year = dotMatch[1]
            const month = String(parseInt(dotMatch[2], 10)).padStart(2, '0')
            const day = String(parseInt(dotMatch[3], 10)).padStart(2, '0')
            return `${year}-${month}-${day}`
          }
          
          // "2025/12/19" 형식 처리
          const slashMatch = dateStr.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/)
          if (slashMatch) {
            const year = slashMatch[1]
            const month = String(parseInt(slashMatch[2], 10)).padStart(2, '0')
            const day = String(parseInt(slashMatch[3], 10)).padStart(2, '0')
            return `${year}-${month}-${day}`
          }
          
          // Date 객체로 파싱 시도
          try {
            const dateObj = new Date(dateStr)
            if (!isNaN(dateObj.getTime())) {
              const year = dateObj.getFullYear()
              const month = String(dateObj.getMonth() + 1).padStart(2, '0')
              const day = String(dateObj.getDate()).padStart(2, '0')
              return `${year}-${month}-${day}`
            }
          } catch (e) {
            // Date 파싱 실패
          }
          
          return null
        }
        
        // 날짜 정규화
        if (typeof normalizedDate === 'string') {
          const normalized = normalizeDateString(normalizedDate)
          if (normalized) {
            normalizedDate = normalized
          } else {
            console.error(`[API] 날짜 변환 실패: ${normalizedDate}`)
            return
          }
        } else {
          // Date 객체인 경우
          try {
            const dateObj = normalizedDate instanceof Date ? normalizedDate : new Date(normalizedDate)
            if (!isNaN(dateObj.getTime())) {
              const year = dateObj.getFullYear()
              const month = String(dateObj.getMonth() + 1).padStart(2, '0')
              const day = String(dateObj.getDate()).padStart(2, '0')
              normalizedDate = `${year}-${month}-${day}`
            } else {
              console.error(`[API] 날짜 변환 실패: ${normalizedDate}`)
              return
            }
          } catch (e) {
            console.error(`[API] 날짜 변환 실패: ${normalizedDate}`, e)
            return
          }
        }

        // 오류 건수 (새 구조에서는 이미 계산되어 있음)
        const attitudeErrors = record.attitudeErrors || record.attitude_err_cnt || 0
        const businessErrors = record.businessErrors || record.ops_err_cnt || 0
        const totalErrors = record.totalErrors || record.total_err_cnt || 0

        // 오류율 (비중)
        const attitudeErrorRate = record.attitudeErrorRate || record.attitude_err_rate || 0
        const businessErrorRate = record.businessErrorRate || record.ops_err_rate || 0
        const totalErrorRate = record.totalErrorRate || record.total_err_rate || 0

        evaluations.push({
          date: normalizedDate,
          agentId,
          agentName,
          center: center,
          service: service,
          tenure: tenure,
          items: {}, // 새 구조에서는 항목별 상세 정보 없음
          totalCalls: 0, // 새 구조에서는 총 콜수 정보 없을 수 있음
          errorRate: totalErrorRate,
          attitudeErrors: attitudeErrors,
          businessErrors: businessErrors,
          totalErrors: totalErrors,
          attitudeErrorRate: attitudeErrorRate,
          businessErrorRate: businessErrorRate,
          totalErrorRate: totalErrorRate,
        })
      }
    } catch (e) {
      console.error(`[API] Record ${index} parsing error (new structure):`, e)
    }
  })

  return {
    agents: Array.from(agentMap.values()),
    evaluations,
  }
}
