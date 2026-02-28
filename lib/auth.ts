// Role-based authentication utilities (localStorage-based)

export type UserRole = 'hq_admin' | 'manager' | 'instructor' | 'agent'

export interface UserInfo {
  userId: string
  userName: string
  role: UserRole
  center: string | null
  service: string | null
  channel: string | null
  agentId: string | null
  workHours: string | null   // HR 근무시간 (e.g. "08:00~17:00")
}

export const ROLE_CONFIG: Record<UserRole, { label: string; defaultRoute: string; color: string }> = {
  hq_admin: { label: '본사 관리자', defaultRoute: '/', color: '#2c6edb' },
  manager: { label: '현장 관리자', defaultRoute: '/manager', color: '#1e3a5f' },
  instructor: { label: '강사', defaultRoute: '/instructor', color: '#7c3aed' },
  agent: { label: '상담사', defaultRoute: '/mypage', color: '#10b981' },
}

const STORAGE_KEY = 'qc-auth'
const COOKIE_NAME = 'qc-auth'

// ── Cookie helpers (bridge: localStorage -> cookie for middleware) ──

function setAuthCookie(user: UserInfo): void {
  const value = encodeURIComponent(JSON.stringify(user))
  // SameSite=Lax for CSRF protection; path=/ so middleware sees it on all routes
  document.cookie = `${COOKIE_NAME}=${value}; path=/; SameSite=Lax; max-age=${60 * 60 * 24 * 7}`
}

function clearAuthCookie(): void {
  document.cookie = `${COOKIE_NAME}=; path=/; SameSite=Lax; max-age=0`
}

export function setAuth(user: UserInfo): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    setAuthCookie(user)
  }
}

export function getUser(): UserInfo | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

export function getRole(): UserRole | null {
  return getUser()?.role ?? null
}

export function clearAuth(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY)
    clearAuthCookie()
  }
}

// ── 테스트용 프리셋 (실제 BQ 계정 연동) ──

export const TEST_PRESETS: { key: string; label: string; sub: string; color: string; user: UserInfo }[] = [
  {
    key: 'hq_admin', label: '본사 관리자', sub: '전체 센터', color: 'bg-[#2c6edb] hover:bg-[#202237] text-white',
    user: { userId: 'admin01', userName: '본사관리자', role: 'hq_admin', center: null, service: null, channel: null, agentId: null, workHours: null },
  },
  {
    key: 'director_yongsan', label: '센터장(용산)', sub: 'jennie1.koc · 제니', color: 'bg-[#2c6edb]/80 hover:bg-[#202237] text-white',
    user: { userId: 'jennie1.koc', userName: '제니', role: 'hq_admin', center: '용산', service: null, channel: null, agentId: null, workHours: null },
  },
  {
    key: 'director_gwangju', label: '센터장(광주)', sub: 'edgar1.itx · 에드가', color: 'bg-[#2c6edb]/80 hover:bg-[#202237] text-white',
    user: { userId: 'edgar1.itx', userName: '에드가', role: 'hq_admin', center: '광주', service: null, channel: null, agentId: null, workHours: null },
  },
  {
    key: 'instructor', label: '강사', sub: '용산', color: 'bg-[#ffcd00] hover:bg-[#ffcd00]/80 text-black',
    user: { userId: 'instructor01', userName: '강사', role: 'instructor', center: '용산', service: null, channel: null, agentId: null, workHours: null },
  },
  {
    key: 'manager_gj', label: '관리자(광주)', sub: 'corgi.itx · 전용호 · 택시', color: 'bg-[#1e3a5f] hover:bg-[#1e3a5f]/80 text-white',
    user: { userId: 'corgi.itx', userName: '전용호', role: 'manager', center: '광주', service: '택시', channel: null, agentId: null, workHours: '08:00~17:00' },
  },
  {
    key: 'agent_yongsan', label: '유선 상담사(용산)', sub: 'can.koc · 송은규 · 퀵', color: 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200',
    user: { userId: 'can.koc', userName: '송은규', role: 'agent', center: '용산', service: '퀵', channel: '유선', agentId: 'can.koc', workHours: null },
  },
  {
    key: 'agent_gwangju', label: '채팅 상담사(광주)', sub: 'mini.itx · 박미정 · 바이크/마스', color: 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-200',
    user: { userId: 'mini.itx', userName: '박미정', role: 'agent', center: '광주', service: '바이크/마스', channel: '채팅', agentId: 'mini.itx', workHours: null },
  },
]

/**
 * BQ 기반 실제 사용자 조회 (서버 API 호출)
 * quiz_results.user_roles → quiz_results.users → kMCC_HR 순으로 조회
 */
export async function lookupUser(userId: string): Promise<{ success: boolean; user?: UserInfo; error?: string }> {
  const res = await fetch(`/api/auth/lookup?userId=${encodeURIComponent(userId)}`)
  const data = await res.json()
  if (data.success && data.user) {
    return { success: true, user: data.user as UserInfo }
  }
  return { success: false, error: data.error || '사용자를 찾을 수 없습니다.' }
}
