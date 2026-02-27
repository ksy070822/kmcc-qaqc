import { getBigQueryClient } from "@/lib/bigquery"
import type { Notice, NoticeListResponse } from "@/lib/types"

const NOTICES = "`csopp-25f2.KMCC_QC.notices`"
const NOTICE_READS = "`csopp-25f2.KMCC_QC.notice_reads`"

/**
 * 사용자용 공지사항 목록 조회 (읽음 여부 포함)
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

  const query = `
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
    WHERE n.is_deleted = FALSE
      AND (n.center_scope = 'all' OR n.center_scope = @center)
      AND (n.expires_at IS NULL OR n.expires_at > CURRENT_TIMESTAMP())
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
 * 미확인 공지 수 (벨 배지용 경량 카운트)
 */
export async function getUnreadNoticeCount(
  userId: string,
  center: string,
): Promise<number> {
  const bq = getBigQueryClient()

  const query = `
    SELECT COUNT(*) AS cnt
    FROM ${NOTICES} n
    LEFT JOIN ${NOTICE_READS} nr
      ON nr.notice_id = n.notice_id AND nr.user_id = @userId
    WHERE n.is_deleted = FALSE
      AND (n.center_scope = 'all' OR n.center_scope = @center)
      AND (n.expires_at IS NULL OR n.expires_at > CURRENT_TIMESTAMP())
      AND nr.read_id IS NULL
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
