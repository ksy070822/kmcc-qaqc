import { NextResponse } from "next/server"
import { deleteAllFirestoreData } from "@/lib/firebase-admin"

// CORS 헤더
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

// POST /api/reset - Firebase 데이터 전체 삭제
export async function POST(request: Request) {
  try {
    console.log("[API] Firebase 데이터 삭제 요청 수신")
    
    const result = await deleteAllFirestoreData()
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500, headers: corsHeaders }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: "Firebase 데이터가 모두 삭제되었습니다.",
        deleted: result.deleted,
        timestamp: new Date().toISOString(),
      },
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error("[API] Reset error:", error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500, headers: corsHeaders }
    )
  }
}




