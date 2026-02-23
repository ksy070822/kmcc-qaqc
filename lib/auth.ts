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
}

export const ROLE_CONFIG: Record<UserRole, { label: string; defaultRoute: string; color: string }> = {
  hq_admin: { label: '본사 관리자', defaultRoute: '/', color: '#2c6edb' },
  manager: { label: '현장 관리자', defaultRoute: '/manager', color: '#1e3a5f' },
  instructor: { label: '강사', defaultRoute: '/instructor', color: '#7c3aed' },
  agent: { label: '상담사', defaultRoute: '/mypage', color: '#10b981' },
}

const STORAGE_KEY = 'qc-auth'

// Test user presets
const TEST_USERS: Record<UserRole, UserInfo> = {
  hq_admin: {
    userId: 'admin01', userName: '본사관리자', role: 'hq_admin',
    center: null, service: null, channel: null, agentId: null,
  },
  manager: {
    userId: 'manager01', userName: '김팀장', role: 'manager',
    center: '용산', service: '택시 유선', channel: '유선', agentId: null,
  },
  instructor: {
    userId: 'instructor01', userName: '이강사', role: 'instructor',
    center: '용산', service: null, channel: null, agentId: null,
  },
  agent: {
    userId: 'vivi.koc', userName: 'vivi.koc', role: 'agent',
    center: '용산', service: '택시', channel: '채팅', agentId: 'vivi.koc',
  },
}

export function setAuth(user: UserInfo): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
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
  }
}

export function getTestUser(role: UserRole): UserInfo {
  return TEST_USERS[role]
}

// 상담사 테스트 프리셋 (유선/채팅)
export const AGENT_PRESETS: Record<string, UserInfo> = {
  voice_yongsan: {
    userId: 'vivi.koc', userName: '김보은', role: 'agent',
    center: '용산', service: '택시', channel: '유선', agentId: 'vivi.koc',
  },
  chat_gwangju: {
    userId: 'isabella.itx', userName: 'isabella.itx', role: 'agent',
    center: '광주', service: '바이크/마스', channel: '채팅', agentId: 'isabella.itx',
  },
}
