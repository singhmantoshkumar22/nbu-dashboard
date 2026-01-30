'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  Upload, BarChart3, TrendingUp, AlertTriangle, CheckCircle, XCircle,
  ChevronDown, ChevronRight, Home, Database, FileText, Settings,
  Filter, Calendar, RefreshCw, History, Menu, X
} from 'lucide-react'
import { processExcelFile, DashboardMetrics, KPIData, DeliveryKPI, ConcernItem } from '@/lib/kpi-processor'
import { uploadFile } from '@/lib/supabase'
import KPICard from '@/components/KPICard'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine, PieChart, Pie, LineChart, Line, Legend,
} from 'recharts'

function getRAGStatus(value: number, target: number, direction: 'higher' | 'lower' = 'higher'): 'green' | 'amber' | 'red' {
  const variance = direction === 'higher'
    ? ((value - target) / target) * 100
    : ((target - value) / target) * 100
  if (variance >= 0) return 'green'
  if (variance >= -10) return 'amber'
  return 'red'
}

interface DashboardHistory {
  id: string
  fileName: string
  createdAt: string
  freightBooking: number
  gm2Percent: number
  pbtPercent: number
  otdPercent: number
  ifdPercent: number
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [fileName, setFileName] = useState('')
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('summary')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [history, setHistory] = useState<DashboardHistory[]>([])
  const [showHistory, setShowHistory] = useState(false)

  // Filters
  const [selectedRegion, setSelectedRegion] = useState<string>('all')
  const [selectedArea, setSelectedArea] = useState<string>('all')
  const [selectedKPI, setSelectedKPI] = useState<string>('all')

  // Get unique values for filters
  const regions = useMemo(() => {
    if (!metrics) return []
    const allRegions = new Set<string>()
    metrics.kpiData.forEach(k => k.region && allRegions.add(k.region))
    metrics.otdData.forEach(o => o.region && allRegions.add(o.region))
    metrics.ifdData.forEach(i => i.region && allRegions.add(i.region))
    return Array.from(allRegions).filter(r => r).sort()
  }, [metrics])

  const areas = useMemo(() => {
    if (!metrics) return []
    const allAreas = new Set<string>()
    const filterByRegion = (item: { region: string; area: string }) =>
      selectedRegion === 'all' || item.region === selectedRegion

    metrics.kpiData.filter(filterByRegion).forEach(k => k.area && allAreas.add(k.area))
    metrics.otdData.filter(filterByRegion).forEach(o => o.area && allAreas.add(o.area))
    metrics.ifdData.filter(filterByRegion).forEach(i => i.area && allAreas.add(i.area))
    return Array.from(allAreas).filter(a => a).sort()
  }, [metrics, selectedRegion])

  const kpis = useMemo(() => {
    if (!metrics) return []
    const allKPIs = new Set<string>()
    metrics.kpiData.forEach(k => k.kpi && allKPIs.add(k.kpi))
    return Array.from(allKPIs).filter(k => k).sort()
  }, [metrics])

  // Filtered data
  const filteredKPIData = useMemo(() => {
    if (!metrics) return []
    return metrics.kpiData.filter(k => {
      if (selectedRegion !== 'all' && k.region !== selectedRegion) return false
      if (selectedArea !== 'all' && k.area !== selectedArea) return false
      if (selectedKPI !== 'all' && k.kpi !== selectedKPI) return false
      return true
    })
  }, [metrics, selectedRegion, selectedArea, selectedKPI])

  const filteredOTDData = useMemo(() => {
    if (!metrics) return []
    return metrics.otdData.filter(o => {
      if (selectedRegion !== 'all' && o.region !== selectedRegion) return false
      if (selectedArea !== 'all' && o.area !== selectedArea) return false
      return true
    })
  }, [metrics, selectedRegion, selectedArea])

  const filteredIFDData = useMemo(() => {
    if (!metrics) return []
    return metrics.ifdData.filter(i => {
      if (selectedRegion !== 'all' && i.region !== selectedRegion) return false
      if (selectedArea !== 'all' && i.area !== selectedArea) return false
      return true
    })
  }, [metrics, selectedRegion, selectedArea])

  const filteredConcerns = useMemo(() => {
    if (!metrics) return []
    return metrics.concerns.filter(c => {
      if (selectedRegion !== 'all' && c.region !== selectedRegion) return false
      if (selectedArea !== 'all' && c.area !== selectedArea) return false
      return true
    })
  }, [metrics, selectedRegion, selectedArea])

  // Load latest dashboard on mount
  useEffect(() => {
    const loadLatest = async () => {
      try {
        const res = await fetch('/api/dashboard/latest')
        const json = await res.json()
        if (json.data) {
          setMetrics({
            freightBooking: json.data.metrics.freightBooking,
            gm2Percent: json.data.metrics.gm2Percent,
            pbtPercent: json.data.metrics.pbtPercent,
            otdPercent: json.data.metrics.otdPercent,
            ifdPercent: json.data.metrics.ifdPercent,
            lhcAdvance: json.data.metrics.lhcAdvance,
            kpiData: json.data.kpiData,
            otdData: json.data.otdData,
            ifdData: json.data.ifdData,
            concerns: json.data.concerns,
          })
          setFileName(json.data.fileName)
          setLastUpdated(json.data.createdAt)
        }
      } catch (error) {
        console.error('Failed to load latest dashboard:', error)
      } finally {
        setInitialLoading(false)
      }
    }

    const loadHistory = async () => {
      try {
        const res = await fetch('/api/dashboard/history')
        const json = await res.json()
        if (json.data) {
          setHistory(json.data)
        }
      } catch (error) {
        console.error('Failed to load history:', error)
      }
    }

    loadLatest()
    loadHistory()
  }, [])

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setFileName(file.name)

    try {
      // Upload to Supabase storage
      await uploadFile(file)

      // Process locally
      const buffer = await file.arrayBuffer()
      const data = processExcelFile(buffer)
      setMetrics(data)
      setLastUpdated(new Date().toISOString())

      // Save to database
      await fetch('/api/dashboard/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          metrics: {
            freightBooking: data.freightBooking,
            gm2Percent: data.gm2Percent,
            pbtPercent: data.pbtPercent,
            otdPercent: data.otdPercent,
            ifdPercent: data.ifdPercent,
            lhcAdvance: data.lhcAdvance,
          },
          kpiData: data.kpiData,
          otdData: data.otdData,
          ifdData: data.ifdData,
          concerns: data.concerns,
        }),
      })

      // Refresh history
      const historyRes = await fetch('/api/dashboard/history')
      const historyJson = await historyRes.json()
      if (historyJson.data) {
        setHistory(historyJson.data)
      }
    } catch (error) {
      console.error('Error processing file:', error)
      alert('Error processing file. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  const resetFilters = () => {
    setSelectedRegion('all')
    setSelectedArea('all')
    setSelectedKPI('all')
  }

  const criticalConcerns = filteredConcerns.filter(c => c.priority === 'critical')
  const warningConcerns = filteredConcerns.filter(c => c.priority === 'warning')

  // Calculate filtered metrics
  const filteredMetrics = useMemo(() => {
    if (!metrics || (selectedRegion === 'all' && selectedArea === 'all')) {
      return metrics
    }

    const filtered = filteredKPIData
    let freightSum = 0
    let gm2Sum = 0, gm2Count = 0
    let pbtSum = 0, pbtCount = 0

    filtered.forEach(k => {
      if (k.kpi === 'Freight Booking' && k.fy25Actual) freightSum += k.fy25Actual
      if (k.kpi === 'GM2% on Sale' && k.fy25Actual) { gm2Sum += k.fy25Actual; gm2Count++ }
      if (k.kpi === 'EstimatedPBT%' && k.fy25Actual) { pbtSum += k.fy25Actual; pbtCount++ }
    })

    const otdSum = filteredOTDData.reduce((sum, o) => sum + o.actual, 0)
    const ifdSum = filteredIFDData.reduce((sum, i) => sum + i.actual, 0)

    return {
      ...metrics,
      freightBooking: freightSum || metrics.freightBooking,
      gm2Percent: gm2Count > 0 ? gm2Sum / gm2Count : metrics.gm2Percent,
      pbtPercent: pbtCount > 0 ? pbtSum / pbtCount : metrics.pbtPercent,
      otdPercent: filteredOTDData.length > 0 ? otdSum / filteredOTDData.length : metrics.otdPercent,
      ifdPercent: filteredIFDData.length > 0 ? ifdSum / filteredIFDData.length : metrics.ifdPercent,
    }
  }, [metrics, filteredKPIData, filteredOTDData, filteredIFDData, selectedRegion, selectedArea])

  // RAG summary for pie chart
  const ragSummary = useMemo(() => {
    const counts = { green: 0, amber: 0, red: 0 }
    filteredOTDData.forEach(o => {
      if (o.actual >= 95) counts.green++
      else if (o.actual >= 92) counts.amber++
      else counts.red++
    })
    filteredIFDData.forEach(i => {
      if (i.actual >= 92) counts.green++
      else if (i.actual >= 88) counts.amber++
      else counts.red++
    })
    return [
      { name: 'On Track', value: counts.green, color: '#10b981' },
      { name: 'At Risk', value: counts.amber, color: '#f59e0b' },
      { name: 'Off Track', value: counts.red, color: '#ef4444' },
    ]
  }, [filteredOTDData, filteredIFDData])

  // KPI by category
  const kpiByCategory = useMemo(() => {
    const categories: Record<string, { actual: number; count: number }> = {}
    filteredKPIData.forEach(k => {
      if (k.fy25Actual) {
        if (!categories[k.kpi]) categories[k.kpi] = { actual: 0, count: 0 }
        categories[k.kpi].actual += k.fy25Actual
        categories[k.kpi].count++
      }
    })
    return Object.entries(categories)
      .map(([name, data]) => ({
        name: name.length > 20 ? name.substring(0, 20) + '...' : name,
        value: data.count > 0 ? data.actual / data.count : 0,
      }))
      .slice(0, 10)
  }, [filteredKPIData])

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Left Sidebar */}
      <div className={`${sidebarOpen ? 'w-72' : 'w-0'} transition-all duration-300 bg-white border-r border-gray-200 overflow-hidden flex-shrink-0`}>
        <div className="p-4 h-full flex flex-col">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-800">NBU MIS</h1>
              <p className="text-xs text-gray-500">Executive Dashboard</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-1 mb-6">
            {[
              { id: 'summary', icon: Home, label: 'Executive Summary' },
              { id: 'delivery', icon: TrendingUp, label: 'Delivery KPIs' },
              { id: 'concerns', icon: AlertTriangle, label: 'Concerns' },
              { id: 'data', icon: Database, label: 'Data Explorer' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                  activeTab === item.id
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
                {item.id === 'concerns' && filteredConcerns.length > 0 && (
                  <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                    activeTab === item.id ? 'bg-white/20' : 'bg-red-100 text-red-600'
                  }`}>
                    {filteredConcerns.length}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Filters */}
          {metrics && (
            <div className="flex-1 overflow-auto">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Filters</h3>
                <button
                  onClick={resetFilters}
                  className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Reset
                </button>
              </div>

              {/* Region Filter */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
                <select
                  value={selectedRegion}
                  onChange={(e) => {
                    setSelectedRegion(e.target.value)
                    setSelectedArea('all')
                  }}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Regions</option>
                  {regions.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Area Filter */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Area/Branch</label>
                <select
                  value={selectedArea}
                  onChange={(e) => setSelectedArea(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Areas</option>
                  {areas.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>

              {/* KPI Filter */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">KPI Category</label>
                <select
                  value={selectedKPI}
                  onChange={(e) => setSelectedKPI(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All KPIs</option>
                  {kpis.map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>

              {/* Active Filters */}
              {(selectedRegion !== 'all' || selectedArea !== 'all' || selectedKPI !== 'all') && (
                <div className="p-3 bg-indigo-50 rounded-lg mb-4">
                  <p className="text-xs text-indigo-600 font-medium mb-2">Active Filters:</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedRegion !== 'all' && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded text-xs text-gray-700">
                        {selectedRegion}
                        <button onClick={() => setSelectedRegion('all')} className="hover:text-red-500">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    {selectedArea !== 'all' && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded text-xs text-gray-700">
                        {selectedArea}
                        <button onClick={() => setSelectedArea('all')} className="hover:text-red-500">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    {selectedKPI !== 'all' && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded text-xs text-gray-700">
                        {selectedKPI.substring(0, 15)}...
                        <button onClick={() => setSelectedKPI('all')} className="hover:text-red-500">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Upload Section */}
          <div className="pt-4 border-t border-gray-100">
            <label className="cursor-pointer block">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                disabled={loading}
              />
              <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl hover:shadow-lg transition-shadow">
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span className="font-medium">Processing...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    <span className="font-medium">Upload Excel</span>
                  </>
                )}
              </div>
            </label>

            {/* History Toggle */}
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-xl mt-2"
            >
              <History className="w-5 h-5" />
              <span className="font-medium">Upload History</span>
              <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${showHistory ? 'rotate-180' : ''}`} />
            </button>

            {showHistory && history.length > 0 && (
              <div className="mt-2 max-h-40 overflow-auto space-y-1">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className="px-3 py-2 bg-gray-50 rounded-lg text-xs"
                  >
                    <p className="font-medium text-gray-700 truncate">{h.fileName}</p>
                    <p className="text-gray-500">
                      {new Date(h.createdAt).toLocaleDateString('en-IN', { dateStyle: 'short' })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {/* Top Bar */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <Menu className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h2 className="text-xl font-bold text-gray-800">
                  {activeTab === 'summary' && 'Executive Summary'}
                  {activeTab === 'delivery' && 'Delivery KPIs'}
                  {activeTab === 'concerns' && 'Concern Items'}
                  {activeTab === 'data' && 'Data Explorer'}
                </h2>
                {lastUpdated && (
                  <p className="text-sm text-gray-500">
                    Last updated: {new Date(lastUpdated).toLocaleString('en-IN')}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {fileName && (
                <span className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg text-sm font-medium">
                  {fileName}
                </span>
              )}
              <span className="bg-gray-100 px-4 py-2 rounded-lg text-sm text-gray-600">
                {new Date().toLocaleDateString('en-IN', { dateStyle: 'medium' })}
              </span>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6">
          {!metrics ? (
            /* Upload Prompt */
            <div className="glass-card rounded-2xl p-12 text-center shadow-lg">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Upload className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome to NBU MIS Dashboard</h2>
              <p className="text-gray-500 mb-8 max-w-md mx-auto">
                Upload your NBU Weekly Business Tracker Excel file to generate comprehensive insights and analytics.
              </p>
              <label className="cursor-pointer inline-block">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={loading}
                />
                <span className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-8 py-4 rounded-xl font-medium hover:shadow-lg transition-all hover:scale-105">
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      Select Excel File
                    </>
                  )}
                </span>
              </label>
            </div>
          ) : (
            <>
              {/* Executive Summary Tab */}
              {activeTab === 'summary' && (
                <>
                  {/* KPI Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                    <KPICard
                      title="Freight Booking"
                      value={`₹${(filteredMetrics?.freightBooking || 0).toFixed(1)} Cr`}
                      icon="💰"
                      status="blue"
                    />
                    <KPICard
                      title="GM2% on Sale"
                      value={`${(filteredMetrics?.gm2Percent || 0).toFixed(1)}%`}
                      target="8%"
                      delta={((filteredMetrics?.gm2Percent || 0) - 8) / 8 * 100}
                      icon="📊"
                      status={getRAGStatus(filteredMetrics?.gm2Percent || 0, 8)}
                    />
                    <KPICard
                      title="Est. PBT%"
                      value={`${(filteredMetrics?.pbtPercent || 0).toFixed(1)}%`}
                      target="3%"
                      delta={((filteredMetrics?.pbtPercent || 0) - 3) / 3 * 100}
                      icon="💎"
                      status={getRAGStatus(filteredMetrics?.pbtPercent || 0, 3)}
                    />
                    <KPICard
                      title="On-Time Delivery"
                      value={`${(filteredMetrics?.otdPercent || 0).toFixed(1)}%`}
                      target="95%"
                      delta={((filteredMetrics?.otdPercent || 0) - 95) / 95 * 100}
                      icon="🚚"
                      status={getRAGStatus(filteredMetrics?.otdPercent || 0, 95)}
                    />
                    <KPICard
                      title="In-Full Delivery"
                      value={`${(filteredMetrics?.ifdPercent || 0).toFixed(1)}%`}
                      target="92%"
                      delta={((filteredMetrics?.ifdPercent || 0) - 92) / 92 * 100}
                      icon="📦"
                      status={getRAGStatus(filteredMetrics?.ifdPercent || 0, 92)}
                    />
                    <KPICard
                      title="LHC Advance"
                      value={`${(filteredMetrics?.lhcAdvance || 0).toFixed(1)}%`}
                      target="80%"
                      delta={((filteredMetrics?.lhcAdvance || 0) - 80) / 80 * 100}
                      icon="💳"
                      status={getRAGStatus(filteredMetrics?.lhcAdvance || 0, 80)}
                    />
                  </div>

                  {/* Charts Row */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    {/* RAG Status Pie */}
                    <div className="glass-card rounded-xl p-6 shadow-lg">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">Overall Health</h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={ragSummary}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={90}
                              dataKey="value"
                              label={({ name, value }) => `${name}: ${value}`}
                            >
                              {ragSummary.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* KPI Overview */}
                    <div className="glass-card rounded-xl p-6 shadow-lg lg:col-span-2">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">KPI Performance Overview</h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={kpiByCategory} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Concerns Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="glass-card rounded-xl p-6 shadow-lg">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <XCircle className="w-5 h-5 text-red-500" />
                        Critical Issues ({criticalConcerns.length})
                      </h3>
                      {criticalConcerns.length > 0 ? (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {criticalConcerns.slice(0, 5).map((c, i) => (
                            <div key={i} className="bg-red-50 border-l-4 border-red-500 p-3 rounded-r-lg">
                              <p className="font-medium text-gray-800">{c.area}</p>
                              <p className="text-sm text-gray-600">{c.kpi}: {c.actual} (Gap: {c.gap})</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-emerald-600">
                          <CheckCircle className="w-5 h-5" />
                          No critical issues
                        </div>
                      )}
                    </div>

                    <div className="glass-card rounded-xl p-6 shadow-lg">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        Warnings ({warningConcerns.length})
                      </h3>
                      {warningConcerns.length > 0 ? (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {warningConcerns.slice(0, 5).map((c, i) => (
                            <div key={i} className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded-r-lg">
                              <p className="font-medium text-gray-800">{c.area}</p>
                              <p className="text-sm text-gray-600">{c.kpi}: {c.actual} (Gap: {c.gap})</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-emerald-600">
                          <CheckCircle className="w-5 h-5" />
                          No warnings
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Delivery Tab */}
              {activeTab === 'delivery' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="glass-card rounded-xl p-6 shadow-lg">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">
                        On-Time Delivery by Area
                        <span className="text-sm font-normal text-gray-500 ml-2">({filteredOTDData.length} areas)</span>
                      </h3>
                      <div className="h-96">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={filteredOTDData.slice(0, 20)}
                            layout="vertical"
                            margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" domain={[0, 100]} />
                            <YAxis dataKey="area" type="category" tick={{ fontSize: 10 }} width={95} />
                            <Tooltip />
                            <ReferenceLine x={95} stroke="#ef4444" strokeDasharray="5 5" label="Target" />
                            <Bar dataKey="actual" radius={[0, 4, 4, 0]}>
                              {filteredOTDData.slice(0, 20).map((entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={entry.actual >= 95 ? '#10b981' : entry.actual >= 92 ? '#f59e0b' : '#ef4444'}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="glass-card rounded-xl p-6 shadow-lg">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">
                        In-Full Delivery by Area
                        <span className="text-sm font-normal text-gray-500 ml-2">({filteredIFDData.length} areas)</span>
                      </h3>
                      <div className="h-96">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={filteredIFDData.slice(0, 20)}
                            layout="vertical"
                            margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" domain={[0, 100]} />
                            <YAxis dataKey="area" type="category" tick={{ fontSize: 10 }} width={95} />
                            <Tooltip />
                            <ReferenceLine x={92} stroke="#ef4444" strokeDasharray="5 5" label="Target" />
                            <Bar dataKey="actual" radius={[0, 4, 4, 0]}>
                              {filteredIFDData.slice(0, 20).map((entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={entry.actual >= 92 ? '#10b981' : entry.actual >= 88 ? '#f59e0b' : '#ef4444'}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Delivery Data Table */}
                  <div className="glass-card rounded-xl p-6 shadow-lg">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Detailed Delivery Data</h3>
                    <div className="overflow-x-auto max-h-96">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0">
                          <tr className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
                            <th className="px-4 py-3 text-left">Region</th>
                            <th className="px-4 py-3 text-left">Area</th>
                            <th className="px-4 py-3 text-right">OTD %</th>
                            <th className="px-4 py-3 text-right">OTD Status</th>
                            <th className="px-4 py-3 text-right">IFD %</th>
                            <th className="px-4 py-3 text-right">IFD Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredOTDData.map((otd, i) => {
                            const ifd = filteredIFDData.find(f => f.area === otd.area) || { actual: 0 }
                            return (
                              <tr key={i} className="border-b hover:bg-gray-50">
                                <td className="px-4 py-3 text-gray-600">{otd.region}</td>
                                <td className="px-4 py-3 font-medium">{otd.area}</td>
                                <td className="px-4 py-3 text-right">{otd.actual.toFixed(1)}%</td>
                                <td className="px-4 py-3 text-right">
                                  <span className={`inline-block w-3 h-3 rounded-full ${
                                    otd.actual >= 95 ? 'bg-emerald-500' : otd.actual >= 92 ? 'bg-amber-500' : 'bg-red-500'
                                  }`} />
                                </td>
                                <td className="px-4 py-3 text-right">{ifd.actual.toFixed(1)}%</td>
                                <td className="px-4 py-3 text-right">
                                  <span className={`inline-block w-3 h-3 rounded-full ${
                                    ifd.actual >= 92 ? 'bg-emerald-500' : ifd.actual >= 88 ? 'bg-amber-500' : 'bg-red-500'
                                  }`} />
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Concerns Tab */}
              {activeTab === 'concerns' && (
                <div className="glass-card rounded-xl p-6 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">
                      All Concern Items ({filteredConcerns.length})
                    </h3>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-red-500"></span>
                        Critical: {criticalConcerns.length}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                        Warning: {warningConcerns.length}
                      </span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
                          <th className="px-4 py-3 text-left rounded-tl-lg">Priority</th>
                          <th className="px-4 py-3 text-left">Region</th>
                          <th className="px-4 py-3 text-left">Area</th>
                          <th className="px-4 py-3 text-left">KPI</th>
                          <th className="px-4 py-3 text-left">Actual</th>
                          <th className="px-4 py-3 text-left">Target</th>
                          <th className="px-4 py-3 text-left rounded-tr-lg">Gap</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredConcerns.map((concern, i) => (
                          <tr
                            key={i}
                            className={`border-b ${
                              concern.priority === 'critical' ? 'bg-red-50' : 'bg-amber-50'
                            }`}
                          >
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                concern.priority === 'critical'
                                  ? 'bg-red-200 text-red-800'
                                  : 'bg-amber-200 text-amber-800'
                              }`}>
                                {concern.priority === 'critical' ? 'Critical' : 'Warning'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-700">{concern.region || '-'}</td>
                            <td className="px-4 py-3 font-medium text-gray-800">{concern.area}</td>
                            <td className="px-4 py-3 text-gray-700">{concern.kpi}</td>
                            <td className="px-4 py-3 font-medium text-gray-800">{concern.actual}</td>
                            <td className="px-4 py-3 text-gray-600">{concern.target}</td>
                            <td className="px-4 py-3 text-red-600 font-medium">{concern.gap}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredConcerns.length === 0 && (
                      <div className="text-center py-12 text-emerald-600">
                        <CheckCircle className="w-16 h-16 mx-auto mb-4" />
                        <p className="text-lg font-medium">All KPIs within acceptable thresholds!</p>
                        <p className="text-gray-500 text-sm mt-1">No concerns found for the selected filters.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Data Explorer Tab */}
              {activeTab === 'data' && (
                <div className="glass-card rounded-xl p-6 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">
                      KPI Data ({filteredKPIData.length} records)
                    </h3>
                  </div>
                  <div className="overflow-x-auto max-h-[600px]">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0">
                        <tr className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
                          <th className="px-3 py-3 text-left">Region</th>
                          <th className="px-3 py-3 text-left">Area</th>
                          <th className="px-3 py-3 text-left">KPI</th>
                          <th className="px-3 py-3 text-left">UOM</th>
                          <th className="px-3 py-3 text-right">FY25 Budget</th>
                          <th className="px-3 py-3 text-right">FY25 Actual</th>
                          <th className="px-3 py-3 text-right">Variance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredKPIData.map((row, i) => (
                          <tr key={i} className="border-b hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-600">{row.region}</td>
                            <td className="px-3 py-2 text-gray-700">{row.area}</td>
                            <td className="px-3 py-2 font-medium">{row.kpi}</td>
                            <td className="px-3 py-2 text-gray-500">{row.uom}</td>
                            <td className="px-3 py-2 text-right">{row.fy25Budget?.toFixed(2) || '-'}</td>
                            <td className="px-3 py-2 text-right font-medium">{row.fy25Actual?.toFixed(2) || '-'}</td>
                            <td className={`px-3 py-2 text-right font-medium ${
                              row.variance && row.variance >= 0 ? 'text-emerald-600' : 'text-red-600'
                            }`}>
                              {row.variance ? `${row.variance.toFixed(1)}%` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
