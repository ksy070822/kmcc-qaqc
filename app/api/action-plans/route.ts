import { NextRequest, NextResponse } from 'next/server';
import { getActionPlans, saveActionPlan, updateActionPlan } from '@/lib/bigquery';
import { getCorsHeaders } from '@/lib/cors';

const corsHeaders = getCorsHeaders();

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const center = searchParams.get('center') || undefined;
  const status = searchParams.get('status') || undefined;

  try {
    const result = await getActionPlans({ center, status });
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500, headers: corsHeaders });
    }
    return NextResponse.json({ success: true, data: result.data }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await saveActionPlan(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500, headers: corsHeaders });
    }
    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500, headers: corsHeaders });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400, headers: corsHeaders });
    }
    const result = await updateActionPlan(id, updates);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500, headers: corsHeaders });
    }
    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500, headers: corsHeaders });
  }
}
