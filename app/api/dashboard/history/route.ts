import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getServerSupabase()
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const { data: dashboards, error } = await supabase
      .from('dashboards')
      .select('id, file_name, created_at, freight_booking, gm2_percent, pbt_percent, otd_percent, ifd_percent')
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
    }

    return NextResponse.json({
      data: dashboards.map(d => ({
        id: d.id,
        fileName: d.file_name,
        createdAt: d.created_at,
        freightBooking: d.freight_booking,
        gm2Percent: d.gm2_percent,
        pbtPercent: d.pbt_percent,
        otdPercent: d.otd_percent,
        ifdPercent: d.ifd_percent,
      }))
    })

  } catch (error) {
    console.error('History error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
