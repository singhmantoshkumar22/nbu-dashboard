import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

export async function GET() {
  try {
    const supabase = getServerSupabase()
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    // Get latest dashboard
    const { data: dashboard, error: dashboardError } = await supabase
      .from('dashboards')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (dashboardError || !dashboard) {
      return NextResponse.json({ data: null })
    }

    // Get KPI data
    const { data: kpiData } = await supabase
      .from('kpi_data')
      .select('*')
      .eq('dashboard_id', dashboard.id)

    // Get OTD data
    const { data: otdData } = await supabase
      .from('delivery_kpi')
      .select('*')
      .eq('dashboard_id', dashboard.id)
      .eq('kpi_type', 'OTD')

    // Get IFD data
    const { data: ifdData } = await supabase
      .from('delivery_kpi')
      .select('*')
      .eq('dashboard_id', dashboard.id)
      .eq('kpi_type', 'IFD')

    // Get concerns
    const { data: concerns } = await supabase
      .from('concerns')
      .select('*')
      .eq('dashboard_id', dashboard.id)

    return NextResponse.json({
      data: {
        fileName: dashboard.file_name,
        createdAt: dashboard.created_at,
        metrics: {
          freightBooking: dashboard.freight_booking,
          gm2Percent: dashboard.gm2_percent,
          pbtPercent: dashboard.pbt_percent,
          otdPercent: dashboard.otd_percent,
          ifdPercent: dashboard.ifd_percent,
          lhcAdvance: dashboard.lhc_advance,
        },
        kpiData: (kpiData || []).map(k => ({
          region: k.region,
          area: k.area,
          kpi: k.kpi,
          uom: k.uom,
          fy25Budget: k.fy25_budget,
          fy25Actual: k.fy25_actual,
          variance: k.variance,
        })),
        otdData: (otdData || []).map(o => ({
          region: o.region,
          area: o.area,
          plan: o.plan,
          actual: o.actual,
          variance: o.variance,
        })),
        ifdData: (ifdData || []).map(i => ({
          region: i.region,
          area: i.area,
          plan: i.plan,
          actual: i.actual,
          variance: i.variance,
        })),
        concerns: (concerns || []).map(c => ({
          priority: c.priority,
          region: c.region,
          area: c.area,
          kpi: c.kpi,
          actual: c.actual,
          target: c.target,
          gap: c.gap,
        })),
      }
    })

  } catch (error) {
    console.error('Load error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
