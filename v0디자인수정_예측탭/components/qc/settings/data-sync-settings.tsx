"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  Database,
  RefreshCw,
  CheckCircle,
  Clock,
  Code,
  ExternalLink,
  Copy,
  FileSpreadsheet,
  Check,
  AlertCircle,
} from "lucide-react"
import { appsScriptFullTemplate, spreadsheetTemplate } from "@/lib/google-apps-script-template"

export function DataSyncSettings() {
  const [webappUrl, setWebappUrl] = useState("")
  const [syncInterval, setSyncInterval] = useState("15")
  const [lastSync, setLastSync] = useState("2024-12-16 14:30:22")
  const [syncStatus, setSyncStatus] = useState<"success" | "error" | "syncing" | "idle">("success")
  const [copied, setCopied] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleCopyCode = (code: string, type: string) => {
    navigator.clipboard.writeText(code)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleTestConnection = async () => {
    setSyncStatus("syncing")
    setTestResult(null)

    try {
      const response = await fetch("/api/sync")
      const data = await response.json()

      setTestResult({
        success: true,
        message: data.message || "API 연결이 정상입니다.",
      })
      setSyncStatus("success")
    } catch (error) {
      setTestResult({
        success: false,
        message: "API 연결에 실패했습니다.",
      })
      setSyncStatus("error")
    }
  }

  const handleManualSync = async () => {
    setSyncStatus("syncing")

    // 시뮬레이션 (실제로는 Apps Script에서 트리거)
    setTimeout(() => {
      setSyncStatus("success")
      setLastSync(new Date().toLocaleString("ko-KR"))
    }, 2000)
  }

  // 현재 앱의 URL (배포 후 자동 설정)
  const currentAppUrl = typeof window !== "undefined" ? window.location.origin : "https://your-app.vercel.app"

  return (
    <div className="space-y-6">
      {/* 연결 상태 */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Database className="h-5 w-5 text-primary" />
            Google Sheets 연동 상태
          </CardTitle>
          <CardDescription>Google Apps Script를 통해 스프레드시트 데이터를 실시간 동기화합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>동기화 주기</Label>
              <Select value={syncInterval} onValueChange={setSyncInterval}>
                <SelectTrigger className="bg-muted/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5분</SelectItem>
                  <SelectItem value="15">15분</SelectItem>
                  <SelectItem value="30">30분</SelectItem>
                  <SelectItem value="60">1시간</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>동기화 상태</Label>
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
                {syncStatus === "success" && (
                  <>
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    <span className="text-emerald-600 font-medium">정상</span>
                  </>
                )}
                {syncStatus === "syncing" && (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-primary font-medium">동기화 중...</span>
                  </>
                )}
                {syncStatus === "error" && (
                  <>
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <span className="text-red-600 font-medium">오류</span>
                  </>
                )}
                {syncStatus === "idle" && (
                  <>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground font-medium">대기</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">마지막 동기화</p>
                <p className="text-sm text-muted-foreground">{lastSync}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleTestConnection} disabled={syncStatus === "syncing"}>
                연결 테스트
              </Button>
              <Button
                onClick={handleManualSync}
                disabled={syncStatus === "syncing"}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${syncStatus === "syncing" ? "animate-spin" : ""}`} />
                수동 동기화
              </Button>
            </div>
          </div>

          {testResult && (
            <Alert className={testResult.success ? "border-emerald-500 bg-emerald-50" : "border-red-500 bg-red-50"}>
              {testResult.success ? (
                <CheckCircle className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
              <AlertDescription className={testResult.success ? "text-emerald-700" : "text-red-700"}>
                {testResult.message}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* 설정 가이드 */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-foreground">
            <Code className="h-5 w-5 text-primary" />
            Apps Script 설정 가이드
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="setup" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-muted/50">
              <TabsTrigger value="setup">설정 방법</TabsTrigger>
              <TabsTrigger value="code">Apps Script 코드</TabsTrigger>
              <TabsTrigger value="template">시트 템플릿</TabsTrigger>
            </TabsList>

            <TabsContent value="setup" className="space-y-4 mt-4">
              <Alert className="border-primary/30 bg-primary/5">
                <AlertTitle className="text-foreground">설정 순서</AlertTitle>
                <AlertDescription className="space-y-2 text-muted-foreground">
                  <p>
                    <Badge variant="outline" className="mr-2">
                      1
                    </Badge>
                    Google 스프레드시트에서 <strong>확장 프로그램 → Apps Script</strong>를 클릭합니다.
                  </p>
                  <p>
                    <Badge variant="outline" className="mr-2">
                      2
                    </Badge>
                    아래 "Apps Script 코드" 탭의 코드를 복사하여 붙여넣습니다.
                  </p>
                  <p>
                    <Badge variant="outline" className="mr-2">
                      3
                    </Badge>
                    코드 상단의 <code className="bg-muted px-1 rounded">WEBAPP_URL</code>을 아래 URL로 변경합니다:
                  </p>
                  <div className="flex items-center gap-2 mt-2 p-2 bg-muted rounded-md">
                    <code className="text-sm flex-1 text-foreground">{currentAppUrl}/api/sync</code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopyCode(`${currentAppUrl}/api/sync`, "url")}
                    >
                      {copied === "url" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p>
                    <Badge variant="outline" className="mr-2">
                      4
                    </Badge>
                    <strong>배포 → 새 배포</strong>에서 웹 앱으로 배포합니다.
                  </p>
                  <p>
                    <Badge variant="outline" className="mr-2">
                      5
                    </Badge>
                    스프레드시트를 새로고침하면 "QC 품질관리" 메뉴가 추가됩니다.
                  </p>
                  <p>
                    <Badge variant="outline" className="mr-2">
                      6
                    </Badge>
                    메뉴에서 "자동 동기화 설정"을 클릭하여 트리거를 설정합니다.
                  </p>
                </AlertDescription>
              </Alert>
            </TabsContent>

            <TabsContent value="code" className="space-y-4 mt-4">
              <div className="relative">
                <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-sm text-slate-100 max-h-96">
                  <code>{appsScriptFullTemplate}</code>
                </pre>
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute right-2 top-2"
                  onClick={() => handleCopyCode(appsScriptFullTemplate, "script")}
                >
                  {copied === "script" ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      복사됨
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      전체 복사
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="template" className="space-y-4 mt-4">
              <Alert className="border-accent bg-accent/10">
                <FileSpreadsheet className="h-4 w-4 text-accent-foreground" />
                <AlertTitle className="text-foreground">스프레드시트 필수 컬럼</AlertTitle>
                <AlertDescription className="text-muted-foreground">
                  아래 헤더를 첫 번째 행에 입력하세요. 컬럼 순서는 변경 가능합니다.
                </AlertDescription>
              </Alert>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-border rounded-lg">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium text-foreground border-b border-border">구분</th>
                      <th className="px-3 py-2 text-left font-medium text-foreground border-b border-border">컬럼명</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-3 py-2 border-b border-border text-muted-foreground">기본정보</td>
                      <td className="px-3 py-2 border-b border-border">
                        <div className="flex flex-wrap gap-1">
                          {["날짜", "센터", "그룹", "상담사ID", "상담사명", "근속기간", "총콜수", "오류율"].map(
                            (col) => (
                              <Badge key={col} variant="secondary" className="text-xs">
                                {col}
                              </Badge>
                            ),
                          )}
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 border-b border-border text-muted-foreground">상담태도 (5)</td>
                      <td className="px-3 py-2 border-b border-border">
                        <div className="flex flex-wrap gap-1">
                          {["첫인사/끝인사", "공감표현", "사과표현", "추가문의확인", "불친절"].map((col) => (
                            <Badge key={col} variant="outline" className="text-xs border-primary/50 text-primary">
                              {col}
                            </Badge>
                          ))}
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-muted-foreground">오상담/오처리 (11)</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {[
                            "상담유형선택",
                            "가이드미준수",
                            "본인확인누락",
                            "필수탐색누락",
                            "오안내",
                            "전산처리오류",
                            "고객정보수정누락",
                            "후처리미비",
                            "이관오류",
                            "민원발생",
                            "기타오류",
                          ].map((col) => (
                            <Badge key={col} variant="outline" className="text-xs">
                              {col}
                            </Badge>
                          ))}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleCopyCode(spreadsheetTemplate.headers.join("\t"), "headers")}
                  className="flex-1"
                >
                  {copied === "headers" ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  헤더 복사 (탭 구분)
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleCopyCode(spreadsheetTemplate.sampleRow.join("\t"), "sample")}
                  className="flex-1"
                >
                  {copied === "sample" ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  샘플 데이터 복사
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          <Button variant="outline" className="w-full bg-transparent" asChild>
            <a href="https://developers.google.com/apps-script" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Google Apps Script 공식 문서
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
