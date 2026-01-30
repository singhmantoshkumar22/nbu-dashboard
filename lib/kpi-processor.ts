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

// Weekly KPI data for Freight, GM2%, PBT%, LHC
export interface WeeklyKPIData {
  region: string
  area: string
  kpi: string
  weekNumber: number
  planned: number | null
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
  weeklyKPI: WeeklyKPIData[] // Weekly data for Freight, GM2%, PBT%, LHC
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

// Indian Financial Year Helper Functions
// FY starts April 1st, Week 1 = April 1-7
// FY26 = April 1, 2025 to March 31, 2026

// Month boundaries in FY weeks (approximate 4-5 weeks per month)
const FY_MONTH_WEEKS: { month: string; startWeek: number; endWeek: number }[] = [
  { month: 'April', startWeek: 1, endWeek: 4 },
  { month: 'May', startWeek: 5, endWeek: 9 },
  { month: 'June', startWeek: 10, endWeek: 13 },
  { month: 'July', startWeek: 14, endWeek: 17 },
  { month: 'August', startWeek: 18, endWeek: 22 },
  { month: 'September', startWeek: 23, endWeek: 26 },
  { month: 'October', startWeek: 27, endWeek: 30 },
  { month: 'November', startWeek: 31, endWeek: 35 },
  { month: 'December', startWeek: 36, endWeek: 39 },
  { month: 'January', startWeek: 40, endWeek: 44 },
  { month: 'February', startWeek: 45, endWeek: 48 },
  { month: 'March', startWeek: 49, endWeek: 52 },
]

// Quarter boundaries in FY
const FY_QUARTERS: { quarter: number; startWeek: number; endWeek: number; months: string }[] = [
  { quarter: 1, startWeek: 1, endWeek: 13, months: 'Apr-Jun' },
  { quarter: 2, startWeek: 14, endWeek: 26, months: 'Jul-Sep' },
  { quarter: 3, startWeek: 27, endWeek: 39, months: 'Oct-Dec' },
  { quarter: 4, startWeek: 40, endWeek: 52, months: 'Jan-Mar' },
]

// Get FY month info from week number
export function getFYMonthFromWeek(weekNumber: number): { month: string; startWeek: number; endWeek: number } {
  for (const m of FY_MONTH_WEEKS) {
    if (weekNumber >= m.startWeek && weekNumber <= m.endWeek) {
      return m
    }
  }
  // Default to last month if week > 52
  return FY_MONTH_WEEKS[FY_MONTH_WEEKS.length - 1]
}

// Get FY quarter info from week number
export function getFYQuarterFromWeek(weekNumber: number): { quarter: number; startWeek: number; endWeek: number; months: string } {
  for (const q of FY_QUARTERS) {
    if (weekNumber >= q.startWeek && weekNumber <= q.endWeek) {
      return q
    }
  }
  // Default to Q4 if week > 52
  return FY_QUARTERS[FY_QUARTERS.length - 1]
}

// Get week range for period based on current week (FY logic)
export function getWeekRangeForPeriod(
  latestWeek: number,
  period: 'week' | 'month' | 'quarter' | 'ytd'
): { startWeek: number; endWeek: number; label: string } {
  if (period === 'week') {
    return { startWeek: latestWeek, endWeek: latestWeek, label: `W${latestWeek}` }
  }

  if (period === 'month') {
    const monthInfo = getFYMonthFromWeek(latestWeek)
    return {
      startWeek: monthInfo.startWeek,
      endWeek: Math.min(monthInfo.endWeek, latestWeek),
      label: monthInfo.month
    }
  }

  if (period === 'quarter') {
    const quarterInfo = getFYQuarterFromWeek(latestWeek)
    return {
      startWeek: quarterInfo.startWeek,
      endWeek: Math.min(quarterInfo.endWeek, latestWeek),
      label: `Q${quarterInfo.quarter} (${quarterInfo.months})`
    }
  }

  // YTD - from week 1 to latest week
  return { startWeek: 1, endWeek: latestWeek, label: `YTD FY26 (W1-W${latestWeek})` }
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
    weeklyKPI: [],
    latestWeek: 0,
  }

  // Process Weekly Business Tracker
  if (workbook.SheetNames.includes('Weekly Business Tracker')) {
    const sheet = workbook.Sheets['Weekly Business Tracker']
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]

    // Find week columns: Row 0 has "Week - X (date)" headers
    // Each week has 3 columns: Planned (at week col), Actual (week col + 1), Score (week col + 2)
    const row0 = data[0] || []
    const weekColumns: { col: number; weekNum: number }[] = []

    for (let j = 0; j < row0.length; j++) {
      const header = String(row0[j] || '')
      // Match "Week - 43" or "Week-43" patterns
      const weekMatch = header.match(/Week\s*-?\s*(\d+)/i)
      if (weekMatch) {
        const weekNum = parseInt(weekMatch[1])
        weekColumns.push({ col: j, weekNum })
      }
    }

    // Track max week number for KPI data
    let maxKPIWeek = 0

    let currentRegion = ''
    let freightSum = 0
    let gm2Sum = 0
    let gm2Count = 0
    let pbtSum = 0
    let pbtCount = 0

    // KPIs we want to track weekly
    const trackableKPIs = ['Freight Booking', 'GM2% on Sale', 'EstimatedPBT%', 'LHC Advance %']

    for (let i = 2; i < data.length; i++) {
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

      // Skip subtotal and grand total rows to avoid double/triple counting
      // "Contract Execution" rows are regional subtotals
      // Rows with "Grand Total" or "Total" in region are grand totals
      const isSubtotalRow = area === 'Contract Execution' ||
                            area.toLowerCase().includes('total') ||
                            currentRegion.toLowerCase().includes('grand total') ||
                            currentRegion.toLowerCase().includes('nbu total')

      if (isSubtotalRow) continue

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

      // Aggregate metrics (YTD totals)
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

      // Extract weekly data for trackable KPIs
      if (trackableKPIs.includes(kpi)) {
        for (const wc of weekColumns) {
          // Actual is at col + 1 from the week header
          const actualVal = row[wc.col + 1]
          const plannedVal = row[wc.col]

          if (typeof actualVal === 'number' && !isNaN(actualVal)) {
            metrics.weeklyKPI.push({
              region: currentRegion,
              area,
              kpi,
              weekNumber: wc.weekNum,
              planned: typeof plannedVal === 'number' ? plannedVal : null,
              actual: actualVal,
            })

            if (wc.weekNum > maxKPIWeek) {
              maxKPIWeek = wc.weekNum
            }
          }
        }
      }
    }

    metrics.freightBooking = freightSum
    metrics.gm2Percent = gm2Count > 0 ? gm2Sum / gm2Count : 0
    metrics.pbtPercent = pbtCount > 0 ? pbtSum / pbtCount : 0
    metrics.latestWeek = Math.max(metrics.latestWeek, maxKPIWeek)
  }

  // Process OTD with weekly time-series data
  if (workbook.SheetNames.includes('Database On Time Delivery KPI')) {
    const sheet = workbook.Sheets['Database On Time Delivery KPI']
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]

    let currentRegion = ''
    let otdSum = 0
    let otdCount = 0
    let maxWeekWithData = 0

    // Data structure:
    // Row 0 = numbers (1, 2, 3...)
    // Row 1 = Week labels (Week-1, Week-2...)
    // Row 2 = Column headers (Region Name, Area Name, KPI, Plan, Actual...)
    // Row 3+ = Data
    // Columns: 0=Region, 1=Area, 2=KPI, 3+=Plan/Actual pairs (alternating)

    for (let i = 3; i < data.length; i++) {
      const row = data[i]
      if (!row) continue

      // Track region (column 0)
      if (row[0] && String(row[0]).trim() && !['Region Name', ''].includes(String(row[0]).trim())) {
        currentRegion = String(row[0]).trim()
      }

      // Area is in column 1
      const area = row[1] ? String(row[1]).trim() : ''
      if (!area || area === 'Area Name' || area === 'Region Name') continue

      // Extract weekly data by iterating through Plan/Actual pairs
      // Start from column 3, pairs are at (3,4), (5,6), (7,8), etc.
      let latestActual: number | null = null
      let latestPlan: number | null = null
      let weekNumber = 0

      // Iterate through all Plan/Actual pairs starting from column 3
      for (let j = 3; j < row.length - 1; j += 2) {
        weekNumber++
        const planVal = row[j]
        const actualVal = row[j + 1]

        const plan = typeof planVal === 'number' ? planVal : null
        const actual = typeof actualVal === 'number' ? actualVal : null

        if (actual !== null) {
          const planPct = plan !== null ? (plan <= 1 ? plan * 100 : plan) : null
          const actualPct = actual <= 1 ? actual * 100 : actual

          metrics.weeklyOTD.push({
            region: currentRegion,
            area,
            kpiType: 'OTD',
            weekNumber,
            plan: planPct,
            actual: actualPct,
          })

          latestActual = actualPct
          latestPlan = planPct
          if (weekNumber > maxWeekWithData) {
            maxWeekWithData = weekNumber
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
    let maxWeekWithData = 0

    // Data starts from row 3 (row 0=numbers, row 1=week labels, row 2=headers)
    for (let i = 3; i < data.length; i++) {
      const row = data[i]
      if (!row) continue

      if (row[0] && String(row[0]).trim() && !['Region Name', ''].includes(String(row[0]).trim())) {
        currentRegion = String(row[0]).trim()
      }

      const area = row[1] ? String(row[1]).trim() : ''
      if (!area || area === 'Area Name' || area === 'Region Name') continue

      let latestActual: number | null = null
      let latestPlan: number | null = null
      let weekNumber = 0

      // Iterate through all Plan/Actual pairs starting from column 3
      for (let j = 3; j < row.length - 1; j += 2) {
        weekNumber++
        const planVal = row[j]
        const actualVal = row[j + 1]

        const plan = typeof planVal === 'number' ? planVal : null
        const actual = typeof actualVal === 'number' ? actualVal : null

        if (actual !== null) {
          const planPct = plan !== null ? (plan <= 1 ? plan * 100 : plan) : null
          const actualPct = actual <= 1 ? actual * 100 : actual

          metrics.weeklyIFD.push({
            region: currentRegion,
            area,
            kpiType: 'IFD',
            weekNumber,
            plan: planPct,
            actual: actualPct,
          })

          latestActual = actualPct
          latestPlan = planPct
          if (weekNumber > maxWeekWithData) {
            maxWeekWithData = weekNumber
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

// Helper function to filter weekly data by time period (FY-based)
export function filterByPeriod(
  weeklyData: WeeklyDeliveryData[],
  latestWeek: number,
  period: 'week' | 'month' | 'quarter' | 'ytd'
): WeeklyDeliveryData[] {
  const range = getWeekRangeForPeriod(latestWeek, period)
  return weeklyData.filter(d => d.weekNumber >= range.startWeek && d.weekNumber <= range.endWeek)
}

// Calculate aggregated metrics for filtered data
export function calculateFilteredMetrics(
  filteredOTD: WeeklyDeliveryData[],
  filteredIFD: WeeklyDeliveryData[],
  selectedRegions: string[],
  selectedAreas: string[],
  allRegions?: string[],
  allAreas?: string[]
): { otdPercent: number; ifdPercent: number } {
  // Check if all regions/areas are selected (treat same as none selected)
  const allRegionsSelected = allRegions && selectedRegions.length === allRegions.length
  const allAreasSelected = allAreas && selectedAreas.length === allAreas.length

  // Apply region/area filters
  const filterBySelection = (d: WeeklyDeliveryData) => {
    // Skip region filter if none selected OR all selected
    if (selectedRegions.length > 0 && !allRegionsSelected && !selectedRegions.includes(d.region)) return false
    // Skip area filter if none selected OR all selected
    if (selectedAreas.length > 0 && !allAreasSelected && !selectedAreas.includes(d.area)) return false
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

// Calculate filtered metrics for all KPIs based on time period (FY-based)
export function calculateFilteredKPIMetrics(
  weeklyKPI: WeeklyKPIData[],
  latestWeek: number,
  period: 'week' | 'month' | 'quarter' | 'ytd',
  selectedRegions: string[],
  selectedAreas: string[],
  allRegions?: string[],
  allAreas?: string[]
): { freightBooking: number; gm2Percent: number; pbtPercent: number; lhcAdvance: number } {
  if (weeklyKPI.length === 0 || latestWeek === 0) {
    return { freightBooking: 0, gm2Percent: 0, pbtPercent: 0, lhcAdvance: 0 }
  }

  // Use FY-based week ranges
  const range = getWeekRangeForPeriod(latestWeek, period)

  // Check if all regions/areas are selected (treat same as none selected)
  const allRegionsSelected = allRegions && selectedRegions.length === allRegions.length
  const allAreasSelected = allAreas && selectedAreas.length === allAreas.length

  // Filter by period and selection
  const filtered = weeklyKPI.filter(d => {
    if (d.weekNumber < range.startWeek || d.weekNumber > range.endWeek) return false
    // Skip region filter if none selected OR all selected
    if (selectedRegions.length > 0 && !allRegionsSelected && !selectedRegions.includes(d.region)) return false
    // Skip area filter if none selected OR all selected
    if (selectedAreas.length > 0 && !allAreasSelected && !selectedAreas.includes(d.area)) return false
    return true
  })

  // Aggregate by KPI type
  const kpiSums: Record<string, { sum: number; count: number }> = {
    'Freight Booking': { sum: 0, count: 0 },
    'GM2% on Sale': { sum: 0, count: 0 },
    'EstimatedPBT%': { sum: 0, count: 0 },
    'LHC Advance %': { sum: 0, count: 0 },
  }

  filtered.forEach(d => {
    if (d.actual !== null && kpiSums[d.kpi]) {
      kpiSums[d.kpi].sum += d.actual
      kpiSums[d.kpi].count++
    }
  })

  // For Freight Booking, sum all values
  // For percentages (GM2%, PBT%, LHC%), average them
  return {
    freightBooking: kpiSums['Freight Booking'].sum,
    gm2Percent: kpiSums['GM2% on Sale'].count > 0
      ? kpiSums['GM2% on Sale'].sum / kpiSums['GM2% on Sale'].count
      : 0,
    pbtPercent: kpiSums['EstimatedPBT%'].count > 0
      ? kpiSums['EstimatedPBT%'].sum / kpiSums['EstimatedPBT%'].count
      : 0,
    lhcAdvance: kpiSums['LHC Advance %'].count > 0
      ? kpiSums['LHC Advance %'].sum / kpiSums['LHC Advance %'].count
      : 0,
  }
}
