"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import Image from "next/image"
import { setAuth, getTestUser, ROLE_CONFIG, type UserRole } from "@/lib/auth"

const TEST_ACCOUNTS: Array<{ role: UserRole; label: string; color: string }> = [
  { role: "hq_admin", label: "본사 관리자", color: "bg-[#2c6edb] hover:bg-[#202237] text-white" },
  { role: "manager", label: "관리자", color: "bg-[#202237] hover:bg-[#202237]/80 text-white" },
  { role: "instructor", label: "강사", color: "bg-[#ffcd00] hover:bg-[#ffcd00]/80 text-black" },
  { role: "agent", label: "상담사", color: "bg-white hover:bg-[#f5f5f5] text-[#202237] border border-[#D9D9D9]" },
]

export default function LoginPage() {
  const router = useRouter()
  const [id, setId] = useState("")
  const [password, setPassword] = useState("")

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    // 일반 로그인은 hq_admin으로 설정
    const testUser = getTestUser("hq_admin")
    setAuth(testUser)
    router.push(ROLE_CONFIG.hq_admin.defaultRoute)
  }

  const handleTestLogin = (role: UserRole) => {
    const testUser = getTestUser(role)
    setAuth(testUser)
    router.push(ROLE_CONFIG[role].defaultRoute)
  }

  const handleGoogleLogin = () => {
    const testUser = getTestUser("hq_admin")
    setAuth(testUser)
    router.push(ROLE_CONFIG.hq_admin.defaultRoute)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5]">
      <Card className="w-full max-w-sm shadow-lg border-0">
        <CardHeader className="items-center pb-2">
          <div className="flex items-center gap-3 mb-1">
            <Image src="/kakaot_logo1.png" alt="카카오T" width={48} height={48} className="rounded-lg" />
            <h1 className="text-xl font-bold text-foreground">상담품질 관리 시스템</h1>
          </div>
          <p className="text-sm text-muted-foreground">로그인하여 시작하세요</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 아이디/비밀번호 로그인 */}
          <form onSubmit={handleLogin} className="space-y-3">
            <Input
              placeholder="아이디"
              value={id}
              onChange={(e) => setId(e.target.value)}
            />
            <Input
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" className="w-full bg-[#2c6edb] hover:bg-[#202237] text-white">
              로그인
            </Button>
          </form>

          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-xs text-muted-foreground">
              또는
            </span>
          </div>

          {/* Google 로그인 */}
          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleLogin}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Google 계정으로 로그인
          </Button>

          {/* 테스트 계정 바로가기 */}
          <div className="pt-2">
            <p className="text-xs text-muted-foreground text-center mb-3">테스트 계정으로 바로 로그인</p>
            <div className="grid grid-cols-2 gap-2">
              {TEST_ACCOUNTS.map((account) => (
                <Button
                  key={account.role}
                  size="sm"
                  className={`text-xs ${account.color}`}
                  onClick={() => handleTestLogin(account.role)}
                >
                  {account.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
