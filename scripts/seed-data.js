const { createClient } = require('@supabase/supabase-js')
const XLSX = require('xlsx')
const fs = require('fs')
const path = require('path')

const supabaseUrl = 'https://fplgwpfujucoivmpvoas.supabase.co'
const supabaseServiceKey = 'sb_secret_KW0V-VCOj4cCbMwEipOvsg_YIuUTgPm'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Process Excel file (same logic as kpi-processor.ts)
function processExcelFile(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' })

  const metrics = {
    freightBooking: 0,
    gm2Percent: 0,
    pbtPercent: 0,
    otdPercent: 0,
    ifdPercent: 0,
    lhcAdvance: 0,
    kpiData: [],
    otdData: [],
    ifdData: [],
    concerns: [],
  }

  // Process Weekly Business Tracker
  if (workbook.SheetNames.includes('Weekly Business Tracker')) {
    const sheet = workbook.Sheets['Weekly Business Tracker']
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 })

    let currentRegion = ''
    let freightSum = 0
    let gm2Sum = 0, gm2Count = 0
    let pbtSum = 0, pbtCount = 0

    for (let i = 1; i < data.length; i++) {
      const row = data[i]
      if (!row) continue

      if (row[0] && String(row[0]).trim()) {
        currentRegion = String(row[0]).trim()
      }

      const area = row[1] ? String(row[1]).trim() : ''
      const kpi = row[3] ? String(row[3]).trim() : ''
      const uom = row[4] ? String(row[4]).trim() : ''
      const fy25Budget = typeof row[9] === 'number' ? row[9] : null
      const fy25Actual = typeof row[11] === 'number' ? row[11] : null

      if (!kpi || kpi === 'KPI') continue

      const variance = fy25Budget && fy25Actual
        ? ((fy25Actual - fy25Budget) / fy25Budget) * 100
        : null

      metrics.kpiData.push({
        region: currentRegion,
        area,
        kpi,
        uom,
        fy25Budget,
        fy25Actual,
        variance,
      })

      if (kpi === 'Freight Booking' && fy25Actual) freightSum += fy25Actual
      if (kpi === 'GM2% on Sale' && fy25Actual) { gm2Sum += fy25Actual; gm2Count++ }
      if (kpi === 'EstimatedPBT%' && fy25Actual) { pbtSum += fy25Actual; pbtCount++ }
    }

    metrics.freightBooking = freightSum
    metrics.gm2Percent = gm2Count > 0 ? gm2Sum / gm2Count : 0
    metrics.pbtPercent = pbtCount > 0 ? pbtSum / pbtCount : 0
  }

  // Process OTD
  if (workbook.SheetNames.includes('Database On Time Delivery KPI')) {
    const sheet = workbook.Sheets['Database On Time Delivery KPI']
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 })

    let currentRegion = ''
    let otdSum = 0, otdCount = 0

    for (let i = 2; i < data.length; i++) {
      const row = data[i]
      if (!row) continue

      if (row[0] && String(row[0]).trim() && !['Region Name', ''].includes(String(row[0]).trim())) {
        currentRegion = String(row[0]).trim()
      }

      const area = row[1] ? String(row[1]).trim() : ''
      if (!area || area === 'Area Name') continue

      let actual = null
      for (let j = row.length - 1; j >= 3; j--) {
        if (typeof row[j] === 'number') {
          actual = row[j]
          break
        }
      }

      if (actual !== null) {
        const actualPct = actual <= 1 ? actual * 100 : actual
        otdSum += actualPct
        otdCount++

        metrics.otdData.push({
          region: currentRegion,
          area,
          plan: 95,
          actual: actualPct,
          variance: actualPct - 95,
        })

        if (actualPct < 92) {
          metrics.concerns.push({
            priority: actualPct < 90 ? 'critical' : 'warning',
            region: currentRegion,
            area,
            kpi: 'On-Time Delivery',
            actual: `${actualPct.toFixed(1)}%`,
            target: '95%',
            gap: `${(actualPct - 95).toFixed(1)}%`,
          })
        }
      }
    }

    metrics.otdPercent = otdCount > 0 ? otdSum / otdCount : 0
  }

  // Process IFD
  if (workbook.SheetNames.includes('Database In Full Delivery KPI')) {
    const sheet = workbook.Sheets['Database In Full Delivery KPI']
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 })

    let currentRegion = ''
    let ifdSum = 0, ifdCount = 0

    for (let i = 2; i < data.length; i++) {
      const row = data[i]
      if (!row) continue

      if (row[0] && String(row[0]).trim() && !['Region Name', ''].includes(String(row[0]).trim())) {
        currentRegion = String(row[0]).trim()
      }

      const area = row[1] ? String(row[1]).trim() : ''
      if (!area || area === 'Area Name') continue

      let actual = null
      for (let j = row.length - 1; j >= 3; j--) {
        if (typeof row[j] === 'number') {
          actual = row[j]
          break
        }
      }

      if (actual !== null) {
        const actualPct = actual <= 1 ? actual * 100 : actual
        ifdSum += actualPct
        ifdCount++

        metrics.ifdData.push({
          region: currentRegion,
          area,
          plan: 92,
          actual: actualPct,
          variance: actualPct - 92,
        })

        if (actualPct < 88) {
          metrics.concerns.push({
            priority: actualPct < 85 ? 'critical' : 'warning',
            region: currentRegion,
            area,
            kpi: 'In-Full Delivery',
            actual: `${actualPct.toFixed(1)}%`,
            target: '92%',
            gap: `${(actualPct - 92).toFixed(1)}%`,
          })
        }
      }
    }

    metrics.ifdPercent = ifdCount > 0 ? ifdSum / ifdCount : 0
  }

  // Sort concerns
  metrics.concerns.sort((a, b) => {
    if (a.priority === 'critical' && b.priority !== 'critical') return -1
    if (a.priority !== 'critical' && b.priority === 'critical') return 1
    return 0
  })

  return metrics
}

async function seedData() {
  const filePath = '/Users/mantosh/Downloads/NBU - Weekly Business Tracker.xlsx'

  console.log('Reading Excel file...')
  const buffer = fs.readFileSync(filePath)

  console.log('Processing Excel data...')
  const data = processExcelFile(buffer)

  console.log(`Processed: ${data.kpiData.length} KPI records, ${data.otdData.length} OTD records, ${data.ifdData.length} IFD records`)

  // Save dashboard record
  console.log('Saving dashboard to Supabase...')
  const { data: dashboard, error: dashboardError } = await supabase
    .from('dashboards')
    .insert({
      file_name: 'NBU - Weekly Business Tracker.xlsx',
      freight_booking: data.freightBooking,
      gm2_percent: data.gm2Percent,
      pbt_percent: data.pbtPercent,
      otd_percent: data.otdPercent,
      ifd_percent: data.ifdPercent,
      lhc_advance: data.lhcAdvance,
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (dashboardError) {
    console.error('Dashboard save error:', dashboardError)
    return
  }

  console.log('Dashboard saved with ID:', dashboard.id)
  const dashboardId = dashboard.id

  // Save KPI data in batches
  if (data.kpiData.length > 0) {
    console.log(`Saving ${data.kpiData.length} KPI records...`)
    const kpiRecords = data.kpiData.map(kpi => ({
      dashboard_id: dashboardId,
      region: kpi.region,
      area: kpi.area,
      kpi: kpi.kpi,
      uom: kpi.uom,
      fy25_budget: kpi.fy25Budget,
      fy25_actual: kpi.fy25Actual,
      variance: kpi.variance,
    }))

    // Insert in batches of 100
    for (let i = 0; i < kpiRecords.length; i += 100) {
      const batch = kpiRecords.slice(i, i + 100)
      const { error } = await supabase.from('kpi_data').insert(batch)
      if (error) console.error('KPI batch error:', error)
    }
    console.log('KPI data saved!')
  }

  // Save OTD data
  if (data.otdData.length > 0) {
    console.log(`Saving ${data.otdData.length} OTD records...`)
    const otdRecords = data.otdData.map(otd => ({
      dashboard_id: dashboardId,
      region: otd.region,
      area: otd.area,
      plan: otd.plan,
      actual: otd.actual,
      variance: otd.variance,
      kpi_type: 'OTD',
    }))

    const { error } = await supabase.from('delivery_kpi').insert(otdRecords)
    if (error) console.error('OTD save error:', error)
    else console.log('OTD data saved!')
  }

  // Save IFD data
  if (data.ifdData.length > 0) {
    console.log(`Saving ${data.ifdData.length} IFD records...`)
    const ifdRecords = data.ifdData.map(ifd => ({
      dashboard_id: dashboardId,
      region: ifd.region,
      area: ifd.area,
      plan: ifd.plan,
      actual: ifd.actual,
      variance: ifd.variance,
      kpi_type: 'IFD',
    }))

    const { error } = await supabase.from('delivery_kpi').insert(ifdRecords)
    if (error) console.error('IFD save error:', error)
    else console.log('IFD data saved!')
  }

  // Save concerns
  if (data.concerns.length > 0) {
    console.log(`Saving ${data.concerns.length} concern records...`)
    const concernRecords = data.concerns.map(c => ({
      dashboard_id: dashboardId,
      priority: c.priority,
      region: c.region,
      area: c.area,
      kpi: c.kpi,
      actual: c.actual,
      target: c.target,
      gap: c.gap,
    }))

    const { error } = await supabase.from('concerns').insert(concernRecords)
    if (error) console.error('Concerns save error:', error)
    else console.log('Concerns saved!')
  }

  console.log('\n✅ Data seeded successfully!')
  console.log('Now visit https://nbu-dashboard.vercel.app - it should auto-load the data.')
}

seedData().catch(console.error)
