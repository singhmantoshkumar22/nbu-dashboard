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

  // Process OTD
  if (workbook.SheetNames.includes('Database On Time Delivery KPI')) {
    const sheet = workbook.Sheets['Database On Time Delivery KPI']
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]

    let currentRegion = ''
    let otdSum = 0
    let otdCount = 0

    for (let i = 2; i < data.length; i++) {
      const row = data[i]
      if (!row) continue

      if (row[0] && String(row[0]).trim() && !['Region Name', ''].includes(String(row[0]).trim())) {
        currentRegion = String(row[0]).trim()
      }

      const area = row[1] ? String(row[1]).trim() : ''
      if (!area || area === 'Area Name') continue

      // Get latest actual value
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

        // Check for concerns
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
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]

    let currentRegion = ''
    let ifdSum = 0
    let ifdCount = 0

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

  // Sort concerns by priority
  metrics.concerns.sort((a, b) => {
    if (a.priority === 'critical' && b.priority !== 'critical') return -1
    if (a.priority !== 'critical' && b.priority === 'critical') return 1
    return 0
  })

  return metrics
}
