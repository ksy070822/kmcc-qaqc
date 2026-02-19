import { type NextRequest, NextResponse } from "next/server";
import { readSheetData } from "@/lib/google-sheets";
import { getBigQueryClient } from "@/lib/bigquery";
import { getCorsHeaders } from "@/lib/cors";

const DATASET_ID = process.env.BIGQUERY_DATASET_ID || "KMCC_QC";
const SPREADSHEET_ID =
  process.env.GOOGLE_SHEETS_ID || "14pXr3QNz_xY3vm9QNaF2yOtle1M4dqAuGb7Z5ebpi2o";
const corsHeaders = getCorsHeaders();

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * GET: H열 데이터 확인 (디버그)
 * ?mode=headers  → 시트 헤더만 반환
 * ?mode=sample   → H열 그룹변경 정보 샘플 반환
 * ?mode=analyze  → 전체 그룹변경 데이터 분석
 */
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("mode") || "headers";
  const sheet = request.nextUrl.searchParams.get("sheet") || "all";

  try {
    const sheets = sheet === "all" ? ["용산", "광주", "용산2025", "광주2025"] : [sheet];
    const results: any = {};

    for (const sheetName of sheets) {
      // headers 모드에서는 첫 5행만 읽기 (빠른 응답)
      const fullRange = sheetName.includes("2025") ? `${sheetName}!A:BZ` : `${sheetName}!A:AZ`;
      const range = mode === "headers" ? `${sheetName}!A1:AZ5` : fullRange;
      const sheetResult = await readSheetData(SPREADSHEET_ID, range);

      if (!sheetResult.success || !sheetResult.data || sheetResult.data.length === 0) {
        results[sheetName] = { error: sheetResult.error || "no data" };
        continue;
      }

      const headers = sheetResult.data[0];
      const rows = sheetResult.data.slice(1);

      if (mode === "headers") {
        results[sheetName] = {
          headers: headers.map((h: string, i: number) => ({
            index: i,
            column: String.fromCharCode(65 + (i < 26 ? i : -1)) || `col_${i}`,
            name: h,
          })),
          rowCount: rows.length,
        };
      } else if (mode === "sample") {
        // H열(index 7) 근처의 그룹변경 정보를 가진 행 찾기
        const groupChangeRows: any[] = [];
        const headerMap: Record<string, number> = {};
        headers.forEach((h: string, i: number) => {
          headerMap[String(h || "").trim().toLowerCase()] = i;
        });

        // 이름, id 인덱스 찾기
        const getIdx = (names: string[]): number | null => {
          for (const n of names) {
            const key = n.toLowerCase().trim();
            if (headerMap[key] !== undefined) return headerMap[key];
            for (const k of Object.keys(headerMap)) {
              if (k.includes(key) || key.includes(k)) return headerMap[k];
            }
          }
          return null;
        };

        const nameIdx = getIdx(["이름", "상담사명"]);
        const idIdx = getIdx(["id", "상담사id"]);
        const serviceIdx = getIdx(["서비스"]);
        const channelIdx = getIdx(["채널", "유선/채팅"]);

        // 그룹변경 정보 열 찾기 - "그룹변경", "변경이력", "이동" 등 또는 H열(7번)
        let groupChangeIdx: number | null = null;
        for (const [key, idx] of Object.entries(headerMap)) {
          if (
            key.includes("변경") ||
            key.includes("이동") ||
            key.includes("그룹변경") ||
            key.includes("소속변경") ||
            key.includes("전환")
          ) {
            groupChangeIdx = idx;
            break;
          }
        }

        // 그룹변경 열을 못 찾으면, 각 열에서 "→", "->", "/" 포함된 전환 패턴 검색
        if (groupChangeIdx === null) {
          for (let colIdx = 0; colIdx < headers.length; colIdx++) {
            let matchCount = 0;
            for (let r = 0; r < Math.min(rows.length, 100); r++) {
              const cellVal = String(rows[r]?.[colIdx] || "");
              if (
                (cellVal.includes("->") || cellVal.includes("→")) &&
                cellVal.includes(",")
              ) {
                matchCount++;
              }
            }
            if (matchCount >= 3) {
              groupChangeIdx = colIdx;
              break;
            }
          }
        }

        // 샘플 수집
        for (let r = 0; r < rows.length && groupChangeRows.length < 30; r++) {
          const row = rows[r];
          // 그룹변경 열이 있고 값이 있는 행
          if (groupChangeIdx !== null) {
            const changeVal = String(row[groupChangeIdx] || "").trim();
            if (changeVal && changeVal.length > 5) {
              groupChangeRows.push({
                rowNum: r + 2,
                name: nameIdx !== null ? row[nameIdx] : null,
                id: idIdx !== null ? row[idIdx] : null,
                service: serviceIdx !== null ? row[serviceIdx] : null,
                channel: channelIdx !== null ? row[channelIdx] : null,
                groupChangeCol: groupChangeIdx,
                groupChangeHeader: headers[groupChangeIdx],
                groupChangeValue: changeVal,
              });
            }
          }
        }

        results[sheetName] = {
          groupChangeColumnIndex: groupChangeIdx,
          groupChangeColumnHeader:
            groupChangeIdx !== null ? headers[groupChangeIdx] : null,
          sampleCount: groupChangeRows.length,
          samples: groupChangeRows,
          // 전체 열 목록 (참고용)
          headersSummary: headers.slice(0, 20).map((h: string, i: number) => `${i}:${h}`),
        };
      } else if (mode === "analyze") {
        // 전체 그룹변경 데이터 분석 — 에이전트별 변경 히스토리 파싱
        const headerMap: Record<string, number> = {};
        headers.forEach((h: string, i: number) => {
          headerMap[String(h || "").trim().toLowerCase()] = i;
        });

        const getIdx = (names: string[]): number | null => {
          for (const n of names) {
            const key = n.toLowerCase().trim();
            if (headerMap[key] !== undefined) return headerMap[key];
            for (const k of Object.keys(headerMap)) {
              if (k.includes(key) || key.includes(k)) return headerMap[k];
            }
          }
          return null;
        };

        const idIdx = getIdx(["id", "상담사id"]);
        const nameIdx = getIdx(["이름", "상담사명"]);

        // 그룹변경 열 찾기 (위와 동일 로직)
        let groupChangeIdx: number | null = null;
        for (const [key, idx] of Object.entries(headerMap)) {
          if (key.includes("변경") || key.includes("이동") || key.includes("그룹변경") || key.includes("소속변경") || key.includes("전환")) {
            groupChangeIdx = idx;
            break;
          }
        }
        if (groupChangeIdx === null) {
          for (let colIdx = 0; colIdx < headers.length; colIdx++) {
            let matchCount = 0;
            for (let r = 0; r < Math.min(rows.length, 100); r++) {
              const cellVal = String(rows[r]?.[colIdx] || "");
              if ((cellVal.includes("->") || cellVal.includes("→")) && cellVal.includes(",")) {
                matchCount++;
              }
            }
            if (matchCount >= 3) {
              groupChangeIdx = colIdx;
              break;
            }
          }
        }

        // 에이전트별 변경 이력 파싱
        const agentChanges: Record<
          string,
          {
            name: string;
            changes: { date: string; from: { service: string; channel: string; shift: string }; to: { service: string; channel: string; shift: string } }[];
          }
        > = {};

        if (groupChangeIdx !== null) {
          for (const row of rows) {
            const agentId = idIdx !== null ? String(row[idIdx] || "").trim() : null;
            const agentName = nameIdx !== null ? String(row[nameIdx] || "").trim() : null;
            if (!agentId) continue;

            const changeStr = String(row[groupChangeIdx] || "").trim();
            if (!changeStr) continue;

            // 파싱: "2025-09-01 / 대리,유선,주간 -> 대리,게시판/보드,주간"
            // 또는 여러 줄: 각 줄마다 하나의 변경
            const lines = changeStr.split(/[\n\r]+/).filter((l) => l.trim());
            for (const line of lines) {
              const parsed = parseGroupChangeLine(line.trim());
              if (parsed) {
                if (!agentChanges[agentId]) {
                  agentChanges[agentId] = { name: agentName || "", changes: [] };
                }
                // 중복 방지
                const exists = agentChanges[agentId].changes.some(
                  (c) => c.date === parsed.date && c.from.service === parsed.from.service
                );
                if (!exists) {
                  agentChanges[agentId].changes.push(parsed);
                }
              }
            }
          }
        }

        // 날짜순 정렬
        for (const ag of Object.values(agentChanges)) {
          ag.changes.sort((a, b) => a.date.localeCompare(b.date));
        }

        results[sheetName] = {
          groupChangeColumnIndex: groupChangeIdx,
          groupChangeColumnHeader: groupChangeIdx !== null ? headers[groupChangeIdx] : null,
          agentsWithChanges: Object.keys(agentChanges).length,
          totalChanges: Object.values(agentChanges).reduce((s, a) => s + a.changes.length, 0),
          agents: agentChanges,
        };
      }
    }

    return NextResponse.json({ success: true, mode, results }, { headers: corsHeaders });
  } catch (error) {
    console.error("[Fix Groups] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST: 실제 BigQuery 데이터 보정 실행
 * body: { dryRun?: boolean }
 *   dryRun=true → 변경 사항만 미리보기 (실제 수정 안 함)
 *   dryRun=false → 실제 BigQuery UPDATE 실행
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun !== false; // 기본값: dryRun=true (안전)

    console.log(`[Fix Groups] ===== 그룹 보정 시작 (dryRun=${dryRun}) =====`);

    // 1. 모든 시트에서 그룹 변경 이력 수집
    const allAgentChanges: Record<
      string,
      {
        name: string;
        center: string;
        changes: { date: string; from: { service: string; channel: string; shift: string }; to: { service: string; channel: string; shift: string } }[];
      }
    > = {};

    for (const sheetInfo of [
      { name: "용산", center: "용산", range: "용산!A:AZ" },
      { name: "광주", center: "광주", range: "광주!A:AZ" },
      { name: "용산2025", center: "용산", range: "용산2025!A:BZ" },
      { name: "광주2025", center: "광주", range: "광주2025!A:BZ" },
    ]) {
      const sheetResult = await readSheetData(SPREADSHEET_ID, sheetInfo.range);
      if (!sheetResult.success || !sheetResult.data || sheetResult.data.length < 2) continue;

      const headers = sheetResult.data[0];
      const rows = sheetResult.data.slice(1);
      const headerMap: Record<string, number> = {};
      headers.forEach((h: string, i: number) => {
        headerMap[String(h || "").trim().toLowerCase()] = i;
      });

      const getIdx = (names: string[]): number | null => {
        for (const n of names) {
          const key = n.toLowerCase().trim();
          if (headerMap[key] !== undefined) return headerMap[key];
          for (const k of Object.keys(headerMap)) {
            if (k.includes(key) || key.includes(k)) return headerMap[k];
          }
        }
        return null;
      };

      const idIdx = getIdx(["id", "상담사id"]);
      const nameIdx = getIdx(["이름", "상담사명"]);

      // 그룹변경 열 찾기
      let groupChangeIdx: number | null = null;
      for (const [key, idx] of Object.entries(headerMap)) {
        if (key.includes("변경") || key.includes("이동") || key.includes("그룹변경") || key.includes("소속변경") || key.includes("전환")) {
          groupChangeIdx = idx;
          break;
        }
      }
      if (groupChangeIdx === null) {
        for (let colIdx = 0; colIdx < headers.length; colIdx++) {
          let matchCount = 0;
          for (let r = 0; r < Math.min(rows.length, 100); r++) {
            const cellVal = String(rows[r]?.[colIdx] || "");
            if ((cellVal.includes("->") || cellVal.includes("→")) && cellVal.includes(",")) {
              matchCount++;
            }
          }
          if (matchCount >= 3) {
            groupChangeIdx = colIdx;
            break;
          }
        }
      }

      if (groupChangeIdx === null) {
        console.log(`[Fix Groups] ${sheetInfo.name}: 그룹변경 열 없음, skip`);
        continue;
      }

      console.log(`[Fix Groups] ${sheetInfo.name}: 그룹변경 열 = ${groupChangeIdx} (${headers[groupChangeIdx]})`);

      for (const row of rows) {
        const agentId = idIdx !== null ? String(row[idIdx] || "").trim() : null;
        const agentName = nameIdx !== null ? String(row[nameIdx] || "").trim() : null;
        if (!agentId) continue;

        const changeStr = String(row[groupChangeIdx] || "").trim();
        if (!changeStr) continue;

        const lines = changeStr.split(/[\n\r]+/).filter((l) => l.trim());
        for (const line of lines) {
          const parsed = parseGroupChangeLine(line.trim());
          if (parsed) {
            if (!allAgentChanges[agentId]) {
              allAgentChanges[agentId] = { name: agentName || "", center: sheetInfo.center, changes: [] };
            }
            const exists = allAgentChanges[agentId].changes.some(
              (c) => c.date === parsed.date && c.from.service === parsed.from.service
            );
            if (!exists) {
              allAgentChanges[agentId].changes.push(parsed);
            }
          }
        }
      }
    }

    // 날짜순 정렬
    for (const ag of Object.values(allAgentChanges)) {
      ag.changes.sort((a, b) => a.date.localeCompare(b.date));
    }

    const agentIdsWithChanges = Object.keys(allAgentChanges);
    console.log(`[Fix Groups] 그룹변경 있는 상담사: ${agentIdsWithChanges.length}명`);

    if (agentIdsWithChanges.length === 0) {
      return NextResponse.json(
        { success: true, message: "그룹변경 이력이 있는 상담사가 없습니다.", corrections: 0 },
        { headers: corsHeaders }
      );
    }

    // 2. BigQuery에서 해당 상담사들의 평가 데이터 조회
    const bigquery = getBigQueryClient();
    const idsList = agentIdsWithChanges.map((id) => `'${id.replace(/'/g, "''")}'`).join(",");

    const [evalRows] = await bigquery.query({
      query: `
        SELECT evaluation_id, evaluation_date, agent_id, agent_name, center, service, channel, \`group\`
        FROM \`${DATASET_ID}.evaluations\`
        WHERE agent_id IN (${idsList})
        ORDER BY agent_id, evaluation_date
      `,
      location: "asia-northeast3",
    });

    console.log(`[Fix Groups] 조회된 평가 건수: ${evalRows.length}`);

    // 3. 각 평가 건에 대해 올바른 그룹 결정
    const corrections: {
      evaluationId: string;
      agentId: string;
      agentName: string;
      evalDate: string;
      currentService: string;
      currentChannel: string;
      correctService: string;
      correctChannel: string;
    }[] = [];

    for (const row of evalRows) {
      const agentId = row.agent_id;
      const changes = allAgentChanges[agentId];
      if (!changes || changes.changes.length === 0) continue;

      const evalDate =
        typeof row.evaluation_date === "object" && row.evaluation_date?.value
          ? row.evaluation_date.value
          : String(row.evaluation_date);

      // 평가일 기준 올바른 그룹 결정
      const correctGroup = getCorrectGroupAtDate(evalDate, changes.changes);
      if (!correctGroup) continue;

      const currentService = row.service || "";
      const currentChannel = row.channel || "";

      // "신규입사" 등 비정상 서비스값은 보정 대상에서 제외
      const INVALID_SERVICES = ["신규입사", "퇴사", "휴직", ""];
      if (INVALID_SERVICES.includes(correctGroup.service)) continue;

      // 현재 값과 다르면 보정 대상
      if (currentService !== correctGroup.service || currentChannel !== correctGroup.channel) {
        corrections.push({
          evaluationId: row.evaluation_id,
          agentId,
          agentName: row.agent_name || "",
          evalDate,
          currentService,
          currentChannel,
          correctService: correctGroup.service,
          correctChannel: correctGroup.channel,
        });
      }
    }

    console.log(`[Fix Groups] 보정 대상: ${corrections.length}건`);

    // 4. 실제 보정 실행 (dryRun=false일 때만)
    let updatedCount = 0;
    if (!dryRun && corrections.length > 0) {
      // DML UPDATE 쿼리로 일괄 수정
      // BigQuery DML은 MERGE를 사용하는 것이 효율적
      const BATCH_SIZE = 500;
      for (let i = 0; i < corrections.length; i += BATCH_SIZE) {
        const batch = corrections.slice(i, i + BATCH_SIZE);

        // CASE WHEN으로 일괄 UPDATE
        const caseService = batch
          .map(
            (c) =>
              `WHEN evaluation_id = '${c.evaluationId.replace(/'/g, "''")}' THEN '${c.correctService.replace(/'/g, "''")}'`
          )
          .join("\n          ");
        const caseChannel = batch
          .map(
            (c) =>
              `WHEN evaluation_id = '${c.evaluationId.replace(/'/g, "''")}' THEN '${c.correctChannel.replace(/'/g, "''")}'`
          )
          .join("\n          ");
        const idList = batch
          .map((c) => `'${c.evaluationId.replace(/'/g, "''")}'`)
          .join(",");

        const updateQuery = `
          UPDATE \`${DATASET_ID}.evaluations\`
          SET
            service = CASE
              ${caseService}
              ELSE service
            END,
            channel = CASE
              ${caseChannel}
              ELSE channel
            END,
            \`group\` = CASE
              ${batch
                .map(
                  (c) =>
                    `WHEN evaluation_id = '${c.evaluationId.replace(/'/g, "''")}' THEN '${`${c.correctService} ${c.correctChannel}`.trim().replace(/'/g, "''")}'`
                )
                .join("\n              ")}
              ELSE \`group\`
            END,
            updated_at = CURRENT_TIMESTAMP()
          WHERE evaluation_id IN (${idList})
        `;

        try {
          await bigquery.query({ query: updateQuery, location: "asia-northeast3" });
          updatedCount += batch.length;
          console.log(`[Fix Groups] 보정 진행: ${updatedCount}/${corrections.length}`);
        } catch (err) {
          console.error(`[Fix Groups] UPDATE 오류 (batch ${i / BATCH_SIZE}):`, err);
          return NextResponse.json(
            {
              success: false,
              error: `UPDATE 실패 at batch ${i / BATCH_SIZE}: ${err instanceof Error ? err.message : String(err)}`,
              corrections: corrections.length,
              updatedSoFar: updatedCount,
            },
            { status: 500, headers: corsHeaders }
          );
        }
      }
    }

    // 보정 요약
    const summary: Record<string, number> = {};
    for (const c of corrections) {
      const key = `${c.currentService}/${c.currentChannel} → ${c.correctService}/${c.correctChannel}`;
      summary[key] = (summary[key] || 0) + 1;
    }

    return NextResponse.json(
      {
        success: true,
        dryRun,
        message: dryRun
          ? `${corrections.length}건의 보정 대상 발견 (미리보기). POST body에 { dryRun: false } 전송하면 실행됩니다.`
          : `${updatedCount}건 보정 완료.`,
        agentsWithChanges: agentIdsWithChanges.length,
        totalEvaluations: evalRows.length,
        correctionsNeeded: corrections.length,
        corrected: dryRun ? 0 : updatedCount,
        summary,
        corrections: corrections.slice(0, 100), // 처음 100건만 반환
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("[Fix Groups] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * 그룹변경 라인 파싱
 * 입력: "2025-09-01 / 대리,유선,주간 -> 대리,게시판/보드,주간"
 * 출력: { date, from: {service, channel, shift}, to: {service, channel, shift} }
 */
function parseGroupChangeLine(line: string): {
  date: string;
  from: { service: string; channel: string; shift: string };
  to: { service: string; channel: string; shift: string };
} | null {
  if (!line) return null;

  // 패턴: "날짜 / 이전그룹 -> 이후그룹" 또는 "날짜 / 이전그룹 → 이후그룹"
  const match = line.match(
    /(\d{4}[-./]\d{1,2}[-./]\d{1,2})\s*[/]\s*(.+?)\s*(?:->|→)\s*(.+)/
  );
  if (!match) return null;

  const dateStr = match[1].replace(/\./g, "-");
  // 날짜 정규화
  const dateParts = dateStr.split("-");
  if (dateParts.length !== 3) return null;
  const normalizedDate = `${dateParts[0]}-${dateParts[1].padStart(2, "0")}-${dateParts[2].padStart(2, "0")}`;

  const fromParts = match[2].trim().split(",").map((s) => s.trim());
  const toParts = match[3].trim().split(",").map((s) => s.trim());

  // "대리,유선,주간" → service=대리, channel=유선, shift=주간
  // "바이크/마스,유선,주간" → service=바이크/마스, channel=유선, shift=주간
  return {
    date: normalizedDate,
    from: {
      service: fromParts[0] || "",
      channel: fromParts[1] || "",
      shift: fromParts[2] || "",
    },
    to: {
      service: toParts[0] || "",
      channel: toParts[1] || "",
      shift: toParts[2] || "",
    },
  };
}

/**
 * 평가일 기준 올바른 그룹 결정
 * changes 배열은 날짜순 정렬되어 있어야 함
 */
function getCorrectGroupAtDate(
  evalDate: string,
  changes: { date: string; from: { service: string; channel: string; shift: string }; to: { service: string; channel: string; shift: string } }[]
): { service: string; channel: string } | null {
  if (changes.length === 0) return null;

  // 평가일이 첫 번째 변경일 이전이면 → from 값 사용
  // 평가일이 변경일 이후이면 → to 값 사용
  // 여러 변경이 있으면 역순으로 찾기

  let correctService = changes[changes.length - 1].to.service; // 최종 (현재) 그룹
  let correctChannel = changes[changes.length - 1].to.channel;

  // 평가일 기준으로 해당 시점의 그룹 결정
  // 변경들을 역순으로 순회하면서, 평가일이 변경일보다 이전인 경우 from값 적용
  for (let i = changes.length - 1; i >= 0; i--) {
    const change = changes[i];
    if (evalDate < change.date) {
      // 평가일이 이 변경 이전 → 이 변경의 from 값이 해당 시점 그룹
      correctService = change.from.service;
      correctChannel = change.from.channel;
    } else {
      // 평가일이 이 변경 이후 → 이 변경의 to 값이 해당 시점 그룹
      correctService = change.to.service;
      correctChannel = change.to.channel;
      break;
    }
  }

  return { service: correctService, channel: correctChannel };
}
