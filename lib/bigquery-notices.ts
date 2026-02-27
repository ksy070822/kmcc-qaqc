import { getBigQueryClient } from "@/lib/bigquery"
import type { Notice, NoticeListResponse } from "@/lib/types"

const NOTICES = "`csopp-25f2.KMCC_QC.notices`"
const NOTICE_READS = "`csopp-25f2.KMCC_QC.notice_reads`"
const AGENTS = "`csopp-25f2.KMCC_QC.agents`"

/* ───────────── Targeting filter (공통 WHERE 절) ───────────── */

function buildTargetFilter(noticeAlias: string, agentAlias: string): string {
  return `
    (${noticeAlias}.center_scope = 'all' OR ${agentAlias}.center = ${noticeAlias}.center_scope)
    AND (${noticeAlias}.service_scope IS NULL OR ${noticeAlias}.service_scope = '' OR ${agentAlias}.service = ${noticeAlias}.service_scope)
    AND (${noticeAlias}.channel_scope IS NULL OR ${noticeAlias}.channel_scope = 'all' OR ${agentAlias}.channel = ${noticeAlias}.channel_scope)
    AND (
      ${noticeAlias}.target_type IS NULL OR ${noticeAlias}.target_type = 'all'
      OR (${noticeAlias}.target_type = 'underperforming' AND ${agentAlias}.is_watch_list = TRUE)
      OR (${noticeAlias}.target_type = 'new_hire' AND ${agentAlias}.tenure_months <= 3)
      OR (${noticeAlias}.target_type = 'specific' AND ${agentAlias}.agent_id IN UNNEST(SPLIT(COALESCE(${noticeAlias}.target_agent_ids, ''), ',')))
    )
  `
}

/**
 * 사용자용 공지사항 목록 조회 (읽음 여부 포함, 타게팅 필터 적용)
 */
export async function getNoticesForUser(
  userId: string,
  center: string,
  type?: string,
): Promise<NoticeListResponse> {
  const bq = getBigQueryClient()

  let typeFilter = ""
  const params: Record<string, string> = { userId, center }
  if (type && type !== "all") {
    typeFilter = " AND n.notice_type = @noticeType"
    params.noticeType = type
  }

  // agents 테이블에서 사용자 속성 조회 후 타게팅 필터 적용
  const query = `
    WITH my_agent AS (
      SELECT agent_id, center, service, channel, is_watch_list, tenure_months
      FROM ${AGENTS}
      WHERE agent_id = @userId
      LIMIT 1
    )
    SELECT
      n.notice_id,
      n.title,
      n.content,
      n.notice_type,
      n.center_scope,
      n.priority,
      n.is_pinned,
      n.created_by,
      FORMAT_TIMESTAMP('%Y-%m-%d %H:%M', n.created_at, 'Asia/Seoul') AS created_at,
      FORMAT_TIMESTAMP('%Y-%m-%d', n.expires_at, 'Asia/Seoul') AS expires_at,
      nr.read_at IS NOT NULL AS is_read,
      FORMAT_TIMESTAMP('%Y-%m-%d %H:%M', nr.read_at, 'Asia/Seoul') AS read_at
    FROM ${NOTICES} n
    LEFT JOIN ${NOTICE_READS} nr
      ON nr.notice_id = n.notice_id AND nr.user_id = @userId
    LEFT JOIN my_agent a ON TRUE
    WHERE n.is_deleted = FALSE
      AND (n.expires_at IS NULL OR n.expires_at > CURRENT_TIMESTAMP())
      AND (
        a.agent_id IS NULL  -- agents 테이블에 없으면 center_scope만 체크
        OR (${buildTargetFilter("n", "a")})
      )
      AND (a.agent_id IS NOT NULL OR (n.center_scope = 'all' OR n.center_scope = @center))
      ${typeFilter}
    ORDER BY n.is_pinned DESC, n.priority DESC, n.created_at DESC
    LIMIT 100
  `

  const [rows] = await bq.query({ query, params })
  const typedRows = rows as Record<string, unknown>[]

  const notices: Notice[] = typedRows.map((r) => ({
    noticeId: String(r.notice_id),
    title: String(r.title),
    content: String(r.content || ""),
    noticeType: String(r.notice_type) as "announcement" | "education",
    centerScope: String(r.center_scope) as "용산" | "광주" | "all",
    priority: Number(r.priority) || 0,
    isPinned: Boolean(r.is_pinned),
    createdBy: String(r.created_by),
    createdAt: String(r.created_at),
    expiresAt: r.expires_at ? String(r.expires_at) : undefined,
    isRead: Boolean(r.is_read),
    readAt: r.read_at ? String(r.read_at) : undefined,
  }))

  const unreadCount = notices.filter((n) => !n.isRead).length

  return { notices, unreadCount, total: notices.length }
}

/**
 * 미확인 공지 수 (벨 배지용 경량 카운트, 타게팅 반영)
 */
export async function getUnreadNoticeCount(
  userId: string,
  center: string,
): Promise<number> {
  const bq = getBigQueryClient()

  const query = `
    WITH my_agent AS (
      SELECT agent_id, center, service, channel, is_watch_list, tenure_months
      FROM ${AGENTS}
      WHERE agent_id = @userId
      LIMIT 1
    )
    SELECT COUNT(*) AS cnt
    FROM ${NOTICES} n
    LEFT JOIN ${NOTICE_READS} nr
      ON nr.notice_id = n.notice_id AND nr.user_id = @userId
    LEFT JOIN my_agent a ON TRUE
    WHERE n.is_deleted = FALSE
      AND (n.expires_at IS NULL OR n.expires_at > CURRENT_TIMESTAMP())
      AND nr.read_id IS NULL
      AND (
        a.agent_id IS NULL
        OR (${buildTargetFilter("n", "a")})
      )
      AND (a.agent_id IS NOT NULL OR (n.center_scope = 'all' OR n.center_scope = @center))
  `

  const [rows] = await bq.query({ query, params: { userId, center } })
  return Number((rows as Record<string, unknown>[])[0]?.cnt) || 0
}

/**
 * 공지사항 읽음 처리 (MERGE로 중복방지)
 */
export async function markNoticeAsRead(
  noticeId: string,
  userId: string,
): Promise<void> {
  const bq = getBigQueryClient()
  const readId = `${noticeId}_${userId}`

  const query = `
    MERGE ${NOTICE_READS} AS t
    USING (SELECT @readId AS read_id) AS s
    ON t.read_id = s.read_id
    WHEN NOT MATCHED THEN
      INSERT (read_id, notice_id, user_id, read_at)
      VALUES (@readId, @noticeId, @userId, CURRENT_TIMESTAMP())
  `

  await bq.query({ query, params: { readId, noticeId, userId } })
}

/**
 * 모든 공지사항 일괄 읽음 처리
 */
export async function markAllNoticesAsRead(
  userId: string,
  center: string,
): Promise<number> {
  const bq = getBigQueryClient()

  const query = `
    INSERT INTO ${NOTICE_READS} (read_id, notice_id, user_id, read_at)
    SELECT
      CONCAT(n.notice_id, '_', @userId) AS read_id,
      n.notice_id,
      @userId AS user_id,
      CURRENT_TIMESTAMP() AS read_at
    FROM ${NOTICES} n
    LEFT JOIN ${NOTICE_READS} nr
      ON nr.notice_id = n.notice_id AND nr.user_id = @userId
    WHERE n.is_deleted = FALSE
      AND (n.center_scope = 'all' OR n.center_scope = @center)
      AND (n.expires_at IS NULL OR n.expires_at > CURRENT_TIMESTAMP())
      AND nr.read_id IS NULL
  `

  const [, job] = await bq.query({ query, params: { userId, center } })
  const affected = Number(job?.statistics?.query?.numDmlAffectedRows) || 0
  return affected
}

/* ═══════════════════════════════════════════════════════════════
   관리자/강사용 공지 관리 함수
   ═══════════════════════════════════════════════════════════════ */

interface CreateNoticeParams {
  title: string
  content: string
  noticeType: string
  centerScope: string
  priority: number
  isPinned: boolean
  createdBy: string
  serviceScope?: string | null
  channelScope?: string | null
  shiftScope?: string | null
  targetType?: string
  targetAgentIds?: string[] | null
}

/**
 * 공지 생성 (관리자/강사용)
 */
export async function createNotice(params: CreateNoticeParams): Promise<string> {
  const bq = getBigQueryClient()
  const noticeId = `notice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  const query = `
    INSERT INTO ${NOTICES} (
      notice_id, title, content, notice_type, center_scope,
      priority, is_pinned, created_by, created_at, expires_at, is_deleted,
      service_scope, channel_scope, shift_scope, target_type, target_agent_ids
    ) VALUES (
      @noticeId, @title, @content, @noticeType, @centerScope,
      @priority, @isPinned, @createdBy, CURRENT_TIMESTAMP(), NULL, FALSE,
      @serviceScope, @channelScope, @shiftScope, @targetType, @targetAgentIds
    )
  `

  await bq.query({
    query,
    params: {
      noticeId,
      title: params.title,
      content: params.content,
      noticeType: params.noticeType,
      centerScope: params.centerScope,
      priority: params.priority,
      isPinned: params.isPinned,
      createdBy: params.createdBy,
      serviceScope: params.serviceScope || null,
      channelScope: params.channelScope || null,
      shiftScope: params.shiftScope || null,
      targetType: params.targetType || "all",
      targetAgentIds: params.targetAgentIds ? params.targetAgentIds.join(",") : null,
    },
  })

  return noticeId
}

interface NoticeWithStats {
  noticeId: string
  title: string
  noticeType: "announcement" | "education"
  priority: number
  isPinned: boolean
  centerScope: string
  createdAt: string
  readCount: number
  totalCount: number
  unreadCount: number
}

/**
 * 작성자 기준 공지 목록 + 읽음 통계 (발송 현황용)
 */
export async function getNoticesWithStats(
  createdBy: string,
  center?: string,
): Promise<NoticeWithStats[]> {
  const bq = getBigQueryClient()

  const query = `
    WITH notice_list AS (
      SELECT * FROM ${NOTICES}
      WHERE created_by = @createdBy AND is_deleted = FALSE
      ORDER BY created_at DESC
      LIMIT 50
    ),
    read_counts AS (
      SELECT notice_id, COUNT(*) AS read_count
      FROM ${NOTICE_READS}
      WHERE notice_id IN (SELECT notice_id FROM notice_list)
      GROUP BY notice_id
    ),
    target_counts AS (
      SELECT
        n.notice_id,
        COUNT(DISTINCT a.agent_id) AS total_count
      FROM notice_list n
      CROSS JOIN ${AGENTS} a
      WHERE a.is_active = TRUE
        AND ${buildTargetFilter("n", "a")}
      GROUP BY n.notice_id
    )
    SELECT
      n.notice_id,
      n.title,
      n.notice_type,
      n.priority,
      n.is_pinned,
      n.center_scope,
      FORMAT_TIMESTAMP('%Y-%m-%d %H:%M', n.created_at, 'Asia/Seoul') AS created_at,
      COALESCE(rc.read_count, 0) AS read_count,
      COALESCE(tc.total_count, 0) AS total_count
    FROM notice_list n
    LEFT JOIN read_counts rc ON rc.notice_id = n.notice_id
    LEFT JOIN target_counts tc ON tc.notice_id = n.notice_id
    ORDER BY n.created_at DESC
  `

  const [rows] = await bq.query({ query, params: { createdBy } })
  const typedRows = rows as Record<string, unknown>[]

  return typedRows.map((r) => ({
    noticeId: String(r.notice_id),
    title: String(r.title),
    noticeType: String(r.notice_type) as "announcement" | "education",
    priority: Number(r.priority) || 0,
    isPinned: Boolean(r.is_pinned),
    centerScope: String(r.center_scope),
    createdAt: String(r.created_at),
    readCount: Number(r.read_count) || 0,
    totalCount: Number(r.total_count) || 0,
    unreadCount: Math.max(0, (Number(r.total_count) || 0) - (Number(r.read_count) || 0)),
  }))
}

interface UnreadAgent {
  userId: string
  userName: string
  center: string
  group?: string
}

/**
 * 특정 공지의 미확인 상담사 목록
 */
export async function getUnreadAgents(noticeId: string): Promise<UnreadAgent[]> {
  const bq = getBigQueryClient()

  const query = `
    WITH notice AS (
      SELECT * FROM ${NOTICES} WHERE notice_id = @noticeId
    ),
    target_agents AS (
      SELECT a.agent_id, a.agent_name, a.center, a.service
      FROM ${AGENTS} a
      CROSS JOIN notice n
      WHERE a.is_active = TRUE
        AND ${buildTargetFilter("n", "a")}
    )
    SELECT ta.agent_id, ta.agent_name, ta.center, ta.service
    FROM target_agents ta
    LEFT JOIN ${NOTICE_READS} nr
      ON nr.notice_id = @noticeId AND nr.user_id = ta.agent_id
    WHERE nr.read_id IS NULL
    ORDER BY ta.center, ta.agent_name
  `

  const [rows] = await bq.query({ query, params: { noticeId } })
  const typedRows = rows as Record<string, unknown>[]

  return typedRows.map((r) => ({
    userId: String(r.agent_id),
    userName: String(r.agent_name),
    center: String(r.center),
    group: r.service ? String(r.service) : undefined,
  }))
}
