import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { QueryProvider } from "./providers"

export const metadata: Metadata = {
  title: "KMCC 통합 관리 시스템",
  description: "카카오모빌리티 고객센터 KMCC 통합 관리 대시보드",
  icons: {
    icon: "/kakaot_logo1.png",
    apple: "/kakaot_logo1.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <body className={`font-sans antialiased`}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
