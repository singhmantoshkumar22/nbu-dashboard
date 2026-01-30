import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = getServerSupabase()
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
    }

    const data = await request.json()
    const { fileName, metrics, kpiData, otdData, ifdData, concerns, weeklyOTD, weeklyIFD, weeklyKPI, latestWeek } = data

    // Save dashboard record
    const { data: dashboard, error: dashboardError } = await supabase
      .from('dashboards')
      .insert({
        file_name: fileName,
        freight_booking: metrics.freightBooking,
        gm2_percent: metrics.gm2Percent,
        pbt_percent: metrics.pbtPercent,
        otd_percent: metrics.otdPercent,
        ifd_percent: metrics.ifdPercent,
        lhc_advance: metrics.lhcAdvance,
        latest_week: latestWeek || 0,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (dashboardError) {
      console.error('Dashboard save error:', dashboardError)
      return NextResponse.json({ error: 'Failed to save dashboard' }, { status: 500 })
    }

    const dashboardId = dashboard.id

    // Save KPI data in batches
    if (kpiData && kpiData.length > 0) {
      const kpiRecords = kpiData.map((kpi: any) => ({
        dashboard_id: dashboardId,
        region: kpi.region,
        area: kpi.area,
        kpi: kpi.kpi,
        uom: kpi.uom,
        fy25_budget: kpi.fy25Budget,
        fy25_actual: kpi.fy25Actual,
        variance: kpi.variance,
      }))

      const { error: kpiError } = await supabase
        .from('kpi_data')
        .insert(kpiRecords)

      if (kpiError) {
        console.error('KPI data save error:', kpiError)
      }
    }

    // Save OTD data
    if (otdData && otdData.length > 0) {
      const otdRecords = otdData.map((otd: any) => ({
        dashboard_id: dashboardId,
        region: otd.region,
        area: otd.area,
        plan: otd.plan,
        actual: otd.actual,
        variance: otd.variance,
        kpi_type: 'OTD',
      }))

      const { error: otdError } = await supabase
        .from('delivery_kpi')
        .insert(otdRecords)

      if (otdError) {
        console.error('OTD data save error:', otdError)
      }
    }

    // Save IFD data
    if (ifdData && ifdData.length > 0) {
      const ifdRecords = ifdData.map((ifd: any) => ({
        dashboard_id: dashboardId,
        region: ifd.region,
        area: ifd.area,
        plan: ifd.plan,
        actual: ifd.actual,
        variance: ifd.variance,
        kpi_type: 'IFD',
      }))

      const { error: ifdError } = await supabase
        .from('delivery_kpi')
        .insert(ifdRecords)

      if (ifdError) {
        console.error('IFD data save error:', ifdError)
      }
    }

    // Save concerns
    if (concerns && concerns.length > 0) {
      const concernRecords = concerns.map((c: any) => ({
        dashboard_id: dashboardId,
        priority: c.priority,
        region: c.region,
        area: c.area,
        kpi: c.kpi,
        actual: c.actual,
        target: c.target,
        gap: c.gap,
      }))

      const { error: concernError } = await supabase
        .from('concerns')
        .insert(concernRecords)

      if (concernError) {
        console.error('Concerns save error:', concernError)
      }
    }

    // Save weekly OTD data
    if (weeklyOTD && weeklyOTD.length > 0) {
      // Insert in batches of 500 to avoid payload limits
      const batchSize = 500
      for (let i = 0; i < weeklyOTD.length; i += batchSize) {
        const batch = weeklyOTD.slice(i, i + batchSize).map((w: any) => ({
          dashboard_id: dashboardId,
          region: w.region,
          area: w.area,
          kpi_type: 'OTD',
          week_number: w.weekNumber,
          plan: w.plan,
          actual: w.actual,
        }))

        const { error: weeklyOTDError } = await supabase
          .from('delivery_kpi_weekly')
          .insert(batch)

        if (weeklyOTDError) {
          console.error('Weekly OTD save error:', weeklyOTDError)
        }
      }
    }

    // Save weekly IFD data
    if (weeklyIFD && weeklyIFD.length > 0) {
      const batchSize = 500
      for (let i = 0; i < weeklyIFD.length; i += batchSize) {
        const batch = weeklyIFD.slice(i, i + batchSize).map((w: any) => ({
          dashboard_id: dashboardId,
          region: w.region,
          area: w.area,
          kpi_type: 'IFD',
          week_number: w.weekNumber,
          plan: w.plan,
          actual: w.actual,
        }))

        const { error: weeklyIFDError } = await supabase
          .from('delivery_kpi_weekly')
          .insert(batch)

        if (weeklyIFDError) {
          console.error('Weekly IFD save error:', weeklyIFDError)
        }
      }
    }

    // Save weekly KPI data (Freight, GM2%, PBT%, LHC)
    if (weeklyKPI && weeklyKPI.length > 0) {
      const batchSize = 500
      for (let i = 0; i < weeklyKPI.length; i += batchSize) {
        const batch = weeklyKPI.slice(i, i + batchSize).map((w: any) => ({
          dashboard_id: dashboardId,
          region: w.region,
          area: w.area,
          kpi: w.kpi,
          week_number: w.weekNumber,
          planned: w.planned,
          actual: w.actual,
        }))

        const { error: weeklyKPIError } = await supabase
          .from('kpi_weekly')
          .insert(batch)

        if (weeklyKPIError) {
          console.error('Weekly KPI save error:', weeklyKPIError)
        }
      }
    }

    return NextResponse.json({
      success: true,
      dashboardId,
      message: 'Dashboard saved successfully'
    })

  } catch (error) {
    console.error('Save error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
