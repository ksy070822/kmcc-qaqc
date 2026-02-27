"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import Image from "next/image"
import { setAuth, lookupUser, ROLE_CONFIG, TEST_PRESETS } from "@/lib/auth"
import { Loader2 } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [userId, setUserId] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // 사번 입력 로그인 (BQ 실시간 조회, 비밀번호 검증은 추후 사내 인증 연동)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = userId.trim()
    if (!trimmed) {
      setError("사번을 입력해주세요.")
      return
    }

    setLoading(true)
    setError("")

    try {
      const result = await lookupUser(trimmed)
      if (result.success && result.user) {
        setAuth(result.user)
        router.push(ROLE_CONFIG[result.user.role].defaultRoute)
      } else {
        setError(result.error || "등록되지 않은 사용자입니다.")
      }
    } catch {
      setError("서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.")
    } finally {
      setLoading(false)
    }
  }

  // Google 로그인 (본사용 - 추후 실제 OAuth 연동)
  const handleGoogleLogin = () => {
    const admin = TEST_PRESETS[0]
    setAuth(admin.user)
    router.push(ROLE_CONFIG.hq_admin.defaultRoute)
  }

  // 테스트 프리셋 바로 로그인
  const handlePresetLogin = (idx: number) => {
    const preset = TEST_PRESETS[idx]
    setAuth(preset.user)
    router.push(ROLE_CONFIG[preset.user.role].defaultRoute)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5]">
      <Card className="w-full max-w-sm shadow-lg border-0">
        <CardHeader className="items-center pb-2">
          <div className="flex items-center gap-3 mb-1">
            <Image src="/kakaot_logo1.png" alt="Komi" width={48} height={48} className="rounded-lg" />
            <h1 className="text-xl font-bold text-foreground">Komi</h1>
          </div>
          <p className="text-sm text-muted-foreground">KMCC 통합 관리 시스템</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 사번/비밀번호 로그인 */}
          <form onSubmit={handleLogin} className="space-y-3">
            <Input
              placeholder="사번 (예: corgi.itx, can.koc)"
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value)
                if (error) setError("")
              }}
              disabled={loading}
              autoFocus
            />
            <Input
              type="password"
              placeholder="비밀번호 (오픈 전 미입력 가능)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
            <Button
              type="submit"
              className="w-full bg-[#2c6edb] hover:bg-[#202237] text-white"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  조회 중...
                </>
              ) : (
                "로그인"
              )}
            </Button>
          </form>

          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-xs text-muted-foreground">
              또는
            </span>
          </div>

          {/* Google 로그인 (본사용) */}
          <Button variant="outline" className="w-full" onClick={handleGoogleLogin}>
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Google 계정으로 로그인
          </Button>

          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-xs text-muted-foreground">
              테스트 계정
            </span>
          </div>

          {/* 테스트 프리셋 버튼 */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {TEST_PRESETS.slice(0, 2).map((preset, idx) => (
                <Button
                  key={preset.key}
                  size="sm"
                  className={`text-xs ${preset.color}`}
                  onClick={() => handlePresetLogin(idx)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-2">
              {TEST_PRESETS.slice(2, 3).map((preset, idx) => (
                <Button
                  key={preset.key}
                  size="sm"
                  className={`text-xs h-auto py-2 ${preset.color}`}
                  onClick={() => handlePresetLogin(idx + 2)}
                >
                  <div className="text-center">
                    <div>{preset.label}</div>
                    <div className="text-[10px] opacity-70 font-normal mt-0.5">{preset.sub}</div>
                  </div>
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {TEST_PRESETS.slice(3).map((preset, idx) => (
                <Button
                  key={preset.key}
                  size="sm"
                  className={`text-xs h-auto py-2 ${preset.color}`}
                  onClick={() => handlePresetLogin(idx + 3)}
                >
                  <div className="text-center">
                    <div>{preset.label}</div>
                    <div className="text-[10px] text-muted-foreground font-normal mt-0.5">{preset.sub}</div>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
