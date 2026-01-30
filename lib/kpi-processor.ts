import * as XLSX from 'xlsx'

export interface KPIData {
  region: string
  area: string
  kpi: string
  uom: string
  fy25Budget: number | null
  fy25Actual: number | null
  variance: number | null
}

export interface DeliveryKPI {
  region: string
  area: string
  plan: number
  actual: number
  variance: number
}

// Weekly time-series data for OTD/IFD
export interface WeeklyDeliveryData {
  region: string
  area: string
  kpiType: 'OTD' | 'IFD'
  weekNumber: number
  plan: number | null
  actual: number | null
}

export interface DashboardMetrics {
  freightBooking: number
  gm2Percent: number
  pbtPercent: number
  otdPercent: number
  ifdPercent: number
  lhcAdvance: number
  kpiData: KPIData[]
  otdData: DeliveryKPI[]
  ifdData: DeliveryKPI[]
  concerns: ConcernItem[]
  // Weekly time-series data for time period filtering
  weeklyOTD: WeeklyDeliveryData[]
  weeklyIFD: WeeklyDeliveryData[]
  latestWeek: number // The latest week number with data
}

export interface ConcernItem {
  priority: 'critical' | 'warning'
  region: string
  area: string
  kpi: string
  actual: string
  target: string
  gap: string
}

export const KPI_TARGETS: Record<string, { target: number; direction: 'higher' | 'lower' }> = {
  'GM2% on Sale': { target: 8, direction: 'higher' },
  'EstimatedPBT%': { target: 3, direction: 'higher' },
  'OnTime Delivery': { target: 95, direction: 'higher' },
  'In Full Delivery': { target: 92, direction: 'higher' },
  'LHC Advance %': { target: 80, direction: 'higher' },
}

export function processExcelFile(buffer: ArrayBuffer): DashboardMetrics {
  const workbook = XLSX.read(buffer, { type: 'array' })

  const metrics: DashboardMetrics = {
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
    weeklyOTD: [],
    weeklyIFD: [],
    latestWeek: 0,
  }

  // Process Weekly Business Tracker
  if (workbook.SheetNames.includes('Weekly Business Tracker')) {
    const sheet = workbook.Sheets['Weekly Business Tracker']
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]

    let currentRegion = ''
    let freightSum = 0
    let gm2Sum = 0
    let gm2Count = 0
    let pbtSum = 0
    let pbtCount = 0

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

      // Aggregate metrics
      if (kpi === 'Freight Booking' && fy25Actual) {
        freightSum += fy25Actual
      }
      if (kpi === 'GM2% on Sale' && fy25Actual) {
        gm2Sum += fy25Actual
        gm2Count++
      }
      if (kpi === 'EstimatedPBT%' && fy25Actual) {
        pbtSum += fy25Actual
        pbtCount++
      }
    }

    metrics.freightBooking = freightSum
    metrics.gm2Percent = gm2Count > 0 ? gm2Sum / gm2Count : 0
    metrics.pbtPercent = pbtCount > 0 ? pbtSum / pbtCount : 0
  }

  // Process OTD with weekly time-series data
  if (workbook.SheetNames.includes('Database On Time Delivery KPI')) {
    const sheet = workbook.Sheets['Database On Time Delivery KPI']
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]

    let currentRegion = ''
    let otdSum = 0
    let otdCount = 0

    // Find week columns in header row (usually row 0 or 1)
    // Headers look like: Region Name, Area Name, KPI, Week-1, Week-1, Week-2, Week-2, ...
    // Each week has Plan and Actual columns alternating
    const headerRow = data[0] || []
    const weekColumns: { week: number; planIdx: number; actualIdx: number }[] = []

    for (let j = 0; j < headerRow.length; j++) {
      const header = String(headerRow[j] || '').trim()
      const weekMatch = header.match(/Week-(\d+)/i)
      if (weekMatch) {
        const weekNum = parseInt(weekMatch[1])
        // Check if this week already exists (we need pairs)
        const existing = weekColumns.find(w => w.week === weekNum)
        if (!existing) {
          // First occurrence is Plan
          weekColumns.push({ week: weekNum, planIdx: j, actualIdx: j + 1 })
        }
      }
    }

    // Track latest week with valid data
    let maxWeekWithData = 0

    for (let i = 2; i < data.length; i++) {
      const row = data[i]
      if (!row) continue

      if (row[0] && String(row[0]).trim() && !['Region Name', ''].includes(String(row[0]).trim())) {
        currentRegion = String(row[0]).trim()
      }

      const area = row[1] ? String(row[1]).trim() : ''
      if (!area || area === 'Area Name') continue

      // Extract weekly data for this area
      let latestActual: number | null = null
      let latestPlan: number | null = null

      for (const wc of weekColumns) {
        const planVal = row[wc.planIdx]
        const actualVal = row[wc.actualIdx]

        const plan = typeof planVal === 'number' ? planVal : null
        const actual = typeof actualVal === 'number' ? actualVal : null

        if (actual !== null) {
          const planPct = plan !== null ? (plan <= 1 ? plan * 100 : plan) : null
          const actualPct = actual <= 1 ? actual * 100 : actual

          metrics.weeklyOTD.push({
            region: currentRegion,
            area,
            kpiType: 'OTD',
            weekNumber: wc.week,
            plan: planPct,
            actual: actualPct,
          })

          latestActual = actualPct
          latestPlan = planPct
          if (wc.week > maxWeekWithData) {
            maxWeekWithData = wc.week
          }
        }
      }

      // Use latest actual for summary
      if (latestActual !== null) {
        otdSum += latestActual
        otdCount++

        metrics.otdData.push({
          region: currentRegion,
          area,
          plan: latestPlan || 95,
          actual: latestActual,
          variance: latestActual - (latestPlan || 95),
        })

        // Check for concerns using latest data
        if (latestActual < 92) {
          metrics.concerns.push({
            priority: latestActual < 90 ? 'critical' : 'warning',
            region: currentRegion,
            area,
            kpi: 'On-Time Delivery',
            actual: `${latestActual.toFixed(1)}%`,
            target: '95%',
            gap: `${(latestActual - 95).toFixed(1)}%`,
          })
        }
      }
    }

    metrics.otdPercent = otdCount > 0 ? otdSum / otdCount : 0
    metrics.latestWeek = Math.max(metrics.latestWeek, maxWeekWithData)
  }

  // Process IFD with weekly time-series data
  if (workbook.SheetNames.includes('Database In Full Delivery KPI')) {
    const sheet = workbook.Sheets['Database In Full Delivery KPI']
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]

    let currentRegion = ''
    let ifdSum = 0
    let ifdCount = 0

    // Find week columns in header row
    const headerRow = data[0] || []
    const weekColumns: { week: number; planIdx: number; actualIdx: number }[] = []

    for (let j = 0; j < headerRow.length; j++) {
      const header = String(headerRow[j] || '').trim()
      const weekMatch = header.match(/Week-(\d+)/i)
      if (weekMatch) {
        const weekNum = parseInt(weekMatch[1])
        const existing = weekColumns.find(w => w.week === weekNum)
        if (!existing) {
          weekColumns.push({ week: weekNum, planIdx: j, actualIdx: j + 1 })
        }
      }
    }

    let maxWeekWithData = 0

    for (let i = 2; i < data.length; i++) {
      const row = data[i]
      if (!row) continue

      if (row[0] && String(row[0]).trim() && !['Region Name', ''].includes(String(row[0]).trim())) {
        currentRegion = String(row[0]).trim()
      }

      const area = row[1] ? String(row[1]).trim() : ''
      if (!area || area === 'Area Name') continue

      let latestActual: number | null = null
      let latestPlan: number | null = null

      for (const wc of weekColumns) {
        const planVal = row[wc.planIdx]
        const actualVal = row[wc.actualIdx]

        const plan = typeof planVal === 'number' ? planVal : null
        const actual = typeof actualVal === 'number' ? actualVal : null

        if (actual !== null) {
          const planPct = plan !== null ? (plan <= 1 ? plan * 100 : plan) : null
          const actualPct = actual <= 1 ? actual * 100 : actual

          metrics.weeklyIFD.push({
            region: currentRegion,
            area,
            kpiType: 'IFD',
            weekNumber: wc.week,
            plan: planPct,
            actual: actualPct,
          })

          latestActual = actualPct
          latestPlan = planPct
          if (wc.week > maxWeekWithData) {
            maxWeekWithData = wc.week
          }
        }
      }

      if (latestActual !== null) {
        ifdSum += latestActual
        ifdCount++

        metrics.ifdData.push({
          region: currentRegion,
          area,
          plan: latestPlan || 92,
          actual: latestActual,
          variance: latestActual - (latestPlan || 92),
        })

        if (latestActual < 88) {
          metrics.concerns.push({
            priority: latestActual < 85 ? 'critical' : 'warning',
            region: currentRegion,
            area,
            kpi: 'In-Full Delivery',
            actual: `${latestActual.toFixed(1)}%`,
            target: '92%',
            gap: `${(latestActual - 92).toFixed(1)}%`,
          })
        }
      }
    }

    metrics.ifdPercent = ifdCount > 0 ? ifdSum / ifdCount : 0
    metrics.latestWeek = Math.max(metrics.latestWeek, maxWeekWithData)
  }

  // Sort concerns by priority
  metrics.concerns.sort((a, b) => {
    if (a.priority === 'critical' && b.priority !== 'critical') return -1
    if (a.priority !== 'critical' && b.priority === 'critical') return 1
    return 0
  })

  return metrics
}

// Helper function to filter weekly data by time period
export function filterByPeriod(
  weeklyData: WeeklyDeliveryData[],
  latestWeek: number,
  period: 'week' | 'month' | 'quarter' | 'year'
): WeeklyDeliveryData[] {
  const weeksToInclude = {
    week: 1,
    month: 4,
    quarter: 13,
    year: 52,
  }[period]

  const startWeek = Math.max(1, latestWeek - weeksToInclude + 1)

  return weeklyData.filter(d => d.weekNumber >= startWeek && d.weekNumber <= latestWeek)
}

// Calculate aggregated metrics for filtered data
export function calculateFilteredMetrics(
  filteredOTD: WeeklyDeliveryData[],
  filteredIFD: WeeklyDeliveryData[],
  selectedRegions: string[],
  selectedAreas: string[]
): { otdPercent: number; ifdPercent: number } {
  // Apply region/area filters
  const filterBySelection = (d: WeeklyDeliveryData) => {
    if (selectedRegions.length > 0 && !selectedRegions.includes(d.region)) return false
    if (selectedAreas.length > 0 && !selectedAreas.includes(d.area)) return false
    return true
  }

  const filteredOTDData = filteredOTD.filter(filterBySelection)
  const filteredIFDData = filteredIFD.filter(filterBySelection)

  // Group by area and calculate average for each area, then average across areas
  const otdByArea: Record<string, { sum: number; count: number }> = {}
  filteredOTDData.forEach(d => {
    if (d.actual !== null) {
      if (!otdByArea[d.area]) otdByArea[d.area] = { sum: 0, count: 0 }
      otdByArea[d.area].sum += d.actual
      otdByArea[d.area].count++
    }
  })

  const ifdByArea: Record<string, { sum: number; count: number }> = {}
  filteredIFDData.forEach(d => {
    if (d.actual !== null) {
      if (!ifdByArea[d.area]) ifdByArea[d.area] = { sum: 0, count: 0 }
      ifdByArea[d.area].sum += d.actual
      ifdByArea[d.area].count++
    }
  })

  // Calculate overall averages
  const otdAreas = Object.values(otdByArea)
  const ifdAreas = Object.values(ifdByArea)

  const otdPercent = otdAreas.length > 0
    ? otdAreas.reduce((sum, a) => sum + (a.sum / a.count), 0) / otdAreas.length
    : 0

  const ifdPercent = ifdAreas.length > 0
    ? ifdAreas.reduce((sum, a) => sum + (a.sum / a.count), 0) / ifdAreas.length
    : 0

  return { otdPercent, ifdPercent }
}
