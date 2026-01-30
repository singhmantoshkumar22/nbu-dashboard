'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  Upload, BarChart3, TrendingUp, AlertTriangle, CheckCircle, XCircle,
  ChevronDown, Home, Database, Filter, RefreshCw, History, Menu, X, FileSpreadsheet
} from 'lucide-react'
import { processExcelFile, DashboardMetrics, KPIData, DeliveryKPI, ConcernItem } from '@/lib/kpi-processor'
import { uploadFile } from '@/lib/supabase'
import KPICard from '@/components/KPICard'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine, PieChart, Pie, LineChart, Line, Legend, ComposedChart,
} from 'recharts'

function getRAGStatus(value: number, target: number): 'green' | 'amber' | 'red' {
  const variance = ((value - target) / target) * 100
  if (variance >= 0) return 'green'
  if (variance >= -10) return 'amber'
  return 'red'
}

interface DashboardHistory {
  id: string
  fileName: string
  createdAt: string
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

  // Multi-select filters
  const [selectedRegions, setSelectedRegions] = useState<string[]>([])
  const [selectedAreas, setSelectedAreas] = useState<string[]>([])
  const [selectedKPI, setSelectedKPI] = useState<string>('Freight Booking')

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
      selectedRegions.length === 0 || selectedRegions.includes(item.region)

    metrics.kpiData.filter(filterByRegion).forEach(k => k.area && allAreas.add(k.area))
    metrics.otdData.filter(filterByRegion).forEach(o => o.area && allAreas.add(o.area))
    metrics.ifdData.filter(filterByRegion).forEach(i => i.area && allAreas.add(i.area))
    return Array.from(allAreas).filter(a => a).sort()
  }, [metrics, selectedRegions])

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
      if (selectedRegions.length > 0 && !selectedRegions.includes(k.region)) return false
      if (selectedAreas.length > 0 && !selectedAreas.includes(k.area)) return false
      return true
    })
  }, [metrics, selectedRegions, selectedAreas])

  const filteredOTDData = useMemo(() => {
    if (!metrics) return []
    return metrics.otdData.filter(o => {
      if (selectedRegions.length > 0 && !selectedRegions.includes(o.region)) return false
      if (selectedAreas.length > 0 && !selectedAreas.includes(o.area)) return false
      return true
    })
  }, [metrics, selectedRegions, selectedAreas])

  const filteredIFDData = useMemo(() => {
    if (!metrics) return []
    return metrics.ifdData.filter(i => {
      if (selectedRegions.length > 0 && !selectedRegions.includes(i.region)) return false
      if (selectedAreas.length > 0 && !selectedAreas.includes(i.area)) return false
      return true
    })
  }, [metrics, selectedRegions, selectedAreas])

  const filteredConcerns = useMemo(() => {
    if (!metrics) return []
    return metrics.concerns.filter(c => {
      if (selectedRegions.length > 0 && !selectedRegions.includes(c.region)) return false
      if (selectedAreas.length > 0 && !selectedAreas.includes(c.area)) return false
      return true
    })
  }, [metrics, selectedRegions, selectedAreas])

  // Performance by Region data for selected KPI
  const performanceByRegion = useMemo(() => {
    if (!metrics) return []
    const regionData: Record<string, { budget: number; actual: number; count: number }> = {}

    filteredKPIData
      .filter(k => k.kpi === selectedKPI)
      .forEach(k => {
        if (!regionData[k.region]) {
          regionData[k.region] = { budget: 0, actual: 0, count: 0 }
        }
        if (k.fy25Budget) regionData[k.region].budget += k.fy25Budget
        if (k.fy25Actual) regionData[k.region].actual += k.fy25Actual
        regionData[k.region].count++
      })

    return Object.entries(regionData)
      .map(([region, data]) => ({
        region: region.length > 20 ? region.substring(0, 18) + '...' : region,
        fullRegion: region,
        budget: data.budget,
        actual: data.actual,
      }))
      .sort((a, b) => b.actual - a.actual)
      .slice(0, 12)
  }, [filteredKPIData, selectedKPI, metrics])

  // Detailed data for selected KPI
  const detailedData = useMemo(() => {
    if (!metrics) return []
    return filteredKPIData
      .filter(k => k.kpi === selectedKPI)
      .map(k => ({
        region: k.region || 'None',
        area: k.area,
        budget: k.fy25Budget,
        actual: k.fy25Actual,
        uom: k.uom,
        variance: k.variance,
      }))
      .slice(0, 50)
  }, [filteredKPIData, selectedKPI, metrics])

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
      await uploadFile(file)
      const buffer = await file.arrayBuffer()
      const data = processExcelFile(buffer)
      setMetrics(data)
      setLastUpdated(new Date().toISOString())

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

      const historyRes = await fetch('/api/dashboard/history')
      const historyJson = await historyRes.json()
      if (historyJson.data) setHistory(historyJson.data)
    } catch (error) {
      console.error('Error processing file:', error)
      alert('Error processing file. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  const toggleRegion = (region: string) => {
    setSelectedRegions(prev =>
      prev.includes(region) ? prev.filter(r => r !== region) : [...prev, region]
    )
    setSelectedAreas([])
  }

  const toggleArea = (area: string) => {
    setSelectedAreas(prev =>
      prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
    )
  }

  const resetFilters = () => {
    setSelectedRegions([])
    setSelectedAreas([])
  }

  const criticalConcerns = filteredConcerns.filter(c => c.priority === 'critical')
  const warningConcerns = filteredConcerns.filter(c => c.priority === 'warning')

  const sheetsLoaded = metrics ? new Set(metrics.kpiData.map(k => k.area)).size : 0

  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-300">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-slate-900 text-white">
      {/* Left Sidebar */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 bg-slate-800 border-r border-slate-700 overflow-hidden flex-shrink-0`}>
        <div className="p-4 h-full flex flex-col overflow-y-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-700">
            <div className="text-2xl">📊</div>
            <div>
              <h1 className="font-bold text-white">Dashboard Controls</h1>
            </div>
          </div>

          {/* Data Source */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Data Source
            </h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={!!metrics} readOnly className="w-4 h-4 text-orange-500" />
                <span className="text-sm text-gray-300">NBU Weekly Tracker</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={false} readOnly className="w-4 h-4" />
                <span className="text-sm text-gray-300">Upload Custom</span>
              </label>
            </div>
            {metrics && (
              <div className="mt-3 px-3 py-2 bg-green-900/30 border border-green-700 rounded-lg flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-400">{sheetsLoaded} sheets loaded</span>
              </div>
            )}
          </div>

          {/* Filters */}
          {metrics && (
            <div className="flex-1">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-400 flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Filters
                </h3>
                {(selectedRegions.length > 0 || selectedAreas.length > 0) && (
                  <button onClick={resetFilters} className="text-xs text-orange-400 hover:text-orange-300">
                    Reset
                  </button>
                )}
              </div>

              {/* Regions Multi-Select */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  🌐 REGIONS
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-slate-900/50 rounded-lg">
                  {regions.map(region => (
                    <button
                      key={region}
                      onClick={() => toggleRegion(region)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                        selectedRegions.includes(region)
                          ? 'bg-orange-500 text-white'
                          : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                      }`}
                    >
                      {region.length > 15 ? region.substring(0, 13) + '...' : region}
                      {selectedRegions.includes(region) && (
                        <span className="ml-1">×</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Areas Multi-Select */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  📍 AREAS
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-slate-900/50 rounded-lg">
                  {areas.slice(0, 30).map(area => (
                    <button
                      key={area}
                      onClick={() => toggleArea(area)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                        selectedAreas.includes(area)
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                      }`}
                    >
                      {area.length > 15 ? area.substring(0, 13) + '...' : area}
                      {selectedAreas.includes(area) && <span className="ml-1">×</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* KPI Category */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  📊 KPI CATEGORY
                </label>
                <select
                  value={selectedKPI}
                  onChange={(e) => setSelectedKPI(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {kpis.map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Upload Section */}
          <div className="pt-4 border-t border-slate-700 mt-auto">
            <label className="cursor-pointer block">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                disabled={loading}
              />
              <div className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl hover:opacity-90 transition-opacity">
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
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {/* Top Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <Menu className="w-5 h-5 text-white" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-7 h-7" />
                  NBU Executive Dashboard
                </h1>
                <p className="text-white/70 text-sm">Strategic Management Information System</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-white/20 px-4 py-2 rounded-lg text-white text-sm">
                {new Date().toLocaleDateString('en-IN', { dateStyle: 'full' })}
              </span>
              {fileName && (
                <span className="bg-white/20 px-4 py-2 rounded-lg text-white text-sm flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4" />
                  {fileName}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        {metrics && (
          <div className="bg-slate-800 border-b border-slate-700 px-6 py-2">
            <div className="flex gap-2">
              {[
                { id: 'summary', label: 'Executive Summary', icon: '📊' },
                { id: 'trend', label: 'Trend Analysis', icon: '📈' },
                { id: 'delivery', label: 'Delivery KPIs', icon: '🚚' },
                { id: 'concerns', label: `Concerns (${filteredConcerns.length})`, icon: '⚠️', highlight: filteredConcerns.length > 0 },
                { id: 'data', label: 'Data Explorer', icon: '📋' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${
                    activeTab === tab.id
                      ? tab.highlight
                        ? 'bg-red-500 text-white'
                        : 'bg-gradient-to-r from-orange-500 to-red-500 text-white'
                      : 'text-gray-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="p-6">
          {!metrics ? (
            <div className="bg-slate-800 rounded-2xl p-12 text-center border border-slate-700">
              <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Upload className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Welcome to NBU MIS Dashboard</h2>
              <p className="text-gray-400 mb-8 max-w-md mx-auto">
                Upload your NBU Weekly Business Tracker Excel file to generate comprehensive insights.
              </p>
              <label className="cursor-pointer inline-block">
                <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" disabled={loading} />
                <span className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 text-white px-8 py-4 rounded-xl font-medium hover:opacity-90 transition-opacity">
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
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                    <KPICard title="Freight Booking" value={`₹${metrics.freightBooking.toFixed(1)} Cr`} icon="💰" status="blue" />
                    <KPICard title="GM2% on Sale" value={`${metrics.gm2Percent.toFixed(1)}%`} target="8%" delta={((metrics.gm2Percent - 8) / 8) * 100} icon="📊" status={getRAGStatus(metrics.gm2Percent, 8)} />
                    <KPICard title="Est. PBT%" value={`${metrics.pbtPercent.toFixed(1)}%`} target="3%" delta={((metrics.pbtPercent - 3) / 3) * 100} icon="💎" status={getRAGStatus(metrics.pbtPercent, 3)} />
                    <KPICard title="On-Time Delivery" value={`${metrics.otdPercent.toFixed(1)}%`} target="95%" delta={((metrics.otdPercent - 95) / 95) * 100} icon="🚚" status={getRAGStatus(metrics.otdPercent, 95)} />
                    <KPICard title="In-Full Delivery" value={`${metrics.ifdPercent.toFixed(1)}%`} target="92%" delta={((metrics.ifdPercent - 92) / 92) * 100} icon="📦" status={getRAGStatus(metrics.ifdPercent, 92)} />
                    <KPICard title="LHC Advance" value={`${metrics.lhcAdvance.toFixed(1)}%`} target="80%" delta={((metrics.lhcAdvance - 80) / 80) * 100} icon="💳" status={getRAGStatus(metrics.lhcAdvance, 80)} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <XCircle className="w-5 h-5 text-red-500" />
                        Critical Issues ({criticalConcerns.length})
                      </h3>
                      {criticalConcerns.length > 0 ? (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {criticalConcerns.slice(0, 5).map((c, i) => (
                            <div key={i} className="bg-red-900/30 border-l-4 border-red-500 p-3 rounded-r-lg">
                              <p className="font-medium text-white">{c.area}</p>
                              <p className="text-sm text-gray-400">{c.kpi}: {c.actual} (Gap: {c.gap})</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-emerald-400">
                          <CheckCircle className="w-5 h-5" />
                          No critical issues
                        </div>
                      )}
                    </div>

                    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        Warnings ({warningConcerns.length})
                      </h3>
                      {warningConcerns.length > 0 ? (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {warningConcerns.slice(0, 5).map((c, i) => (
                            <div key={i} className="bg-amber-900/30 border-l-4 border-amber-500 p-3 rounded-r-lg">
                              <p className="font-medium text-white">{c.area}</p>
                              <p className="text-sm text-gray-400">{c.kpi}: {c.actual} (Gap: {c.gap})</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-emerald-400">
                          <CheckCircle className="w-5 h-5" />
                          No warnings
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Trend Analysis Tab */}
              {activeTab === 'trend' && (
                <div className="space-y-6">
                  <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      📊 Select KPI for Analysis
                    </h3>
                    <select
                      value={selectedKPI}
                      onChange={(e) => setSelectedKPI(e.target.value)}
                      className="w-full md:w-96 px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      {kpis.map(k => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* FY25 Performance by Region */}
                    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                      <h3 className="text-lg font-semibold text-white mb-4">FY25 Performance by Region</h3>
                      <p className="text-sm text-gray-400 mb-4">{selectedKPI} - FY25 Actual</p>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={performanceByRegion} layout="vertical" margin={{ left: 100, right: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis type="number" stroke="#9ca3af" />
                            <YAxis dataKey="region" type="category" stroke="#9ca3af" tick={{ fontSize: 11 }} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                              labelStyle={{ color: '#fff' }}
                            />
                            <Bar dataKey="actual" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Budget vs Actual Comparison */}
                    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                      <h3 className="text-lg font-semibold text-white mb-4">Budget vs Actual Comparison</h3>
                      <p className="text-sm text-gray-400 mb-4">Budget vs Actual</p>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={performanceByRegion} margin={{ left: 20, right: 20, bottom: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="region" stroke="#9ca3af" tick={{ fontSize: 10 }} interval={0} />
                            <YAxis stroke="#9ca3af" />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                              labelStyle={{ color: '#fff' }}
                            />
                            <Legend />
                            <Bar dataKey="budget" fill="#94a3b8" name="Budget" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="actual" fill="#6366f1" name="Actual" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Detailed Data Table */}
                  <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                    <h3 className="text-lg font-semibold text-white mb-4">Detailed Data</h3>
                    <div className="overflow-x-auto max-h-96">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0">
                          <tr className="bg-slate-900 text-gray-300">
                            <th className="px-4 py-3 text-left">Region</th>
                            <th className="px-4 py-3 text-left">Area</th>
                            <th className="px-4 py-3 text-right">FY25_Budget</th>
                            <th className="px-4 py-3 text-right">FY25_Actual</th>
                            <th className="px-4 py-3 text-left">UOM</th>
                            <th className="px-4 py-3 text-right">Variance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailedData.map((row, i) => (
                            <tr key={i} className="border-t border-slate-700 hover:bg-slate-700/50">
                              <td className="px-4 py-3 text-gray-400">{row.region}</td>
                              <td className="px-4 py-3 text-white font-medium">{row.area}</td>
                              <td className="px-4 py-3 text-right text-gray-300">{row.budget?.toFixed(2) || '-'}</td>
                              <td className="px-4 py-3 text-right text-white font-medium">{row.actual?.toFixed(4) || '-'}</td>
                              <td className="px-4 py-3 text-gray-400">{row.uom || '-'}</td>
                              <td className={`px-4 py-3 text-right font-medium ${row.variance && row.variance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {row.variance?.toFixed(2) || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Delivery Tab */}
              {activeTab === 'delivery' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                    <h3 className="text-lg font-semibold text-white mb-4">On-Time Delivery by Area ({filteredOTDData.length})</h3>
                    <div className="h-96">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={filteredOTDData.slice(0, 15)} layout="vertical" margin={{ left: 100 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis type="number" domain={[0, 100]} stroke="#9ca3af" />
                          <YAxis dataKey="area" type="category" stroke="#9ca3af" tick={{ fontSize: 10 }} />
                          <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                          <ReferenceLine x={95} stroke="#ef4444" strokeDasharray="5 5" />
                          <Bar dataKey="actual" radius={[0, 4, 4, 0]}>
                            {filteredOTDData.slice(0, 15).map((entry, index) => (
                              <Cell key={index} fill={entry.actual >= 95 ? '#10b981' : entry.actual >= 92 ? '#f59e0b' : '#ef4444'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                    <h3 className="text-lg font-semibold text-white mb-4">In-Full Delivery by Area ({filteredIFDData.length})</h3>
                    <div className="h-96">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={filteredIFDData.slice(0, 15)} layout="vertical" margin={{ left: 100 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis type="number" domain={[0, 100]} stroke="#9ca3af" />
                          <YAxis dataKey="area" type="category" stroke="#9ca3af" tick={{ fontSize: 10 }} />
                          <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                          <ReferenceLine x={92} stroke="#ef4444" strokeDasharray="5 5" />
                          <Bar dataKey="actual" radius={[0, 4, 4, 0]}>
                            {filteredIFDData.slice(0, 15).map((entry, index) => (
                              <Cell key={index} fill={entry.actual >= 92 ? '#10b981' : entry.actual >= 88 ? '#f59e0b' : '#ef4444'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {/* Concerns Tab */}
              {activeTab === 'concerns' && (
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">All Concern Items ({filteredConcerns.length})</h3>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-2 text-red-400">
                        <span className="w-3 h-3 rounded-full bg-red-500"></span>
                        Critical: {criticalConcerns.length}
                      </span>
                      <span className="flex items-center gap-2 text-amber-400">
                        <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                        Warning: {warningConcerns.length}
                      </span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gradient-to-r from-red-600 to-orange-500 text-white">
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
                          <tr key={i} className={`border-b border-slate-700 ${concern.priority === 'critical' ? 'bg-red-900/20' : 'bg-amber-900/20'}`}>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${concern.priority === 'critical' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'}`}>
                                {concern.priority === 'critical' ? 'Critical' : 'Warning'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-300">{concern.region || '-'}</td>
                            <td className="px-4 py-3 font-medium text-white">{concern.area}</td>
                            <td className="px-4 py-3 text-gray-300">{concern.kpi}</td>
                            <td className="px-4 py-3 font-medium text-white">{concern.actual}</td>
                            <td className="px-4 py-3 text-gray-400">{concern.target}</td>
                            <td className="px-4 py-3 text-red-400 font-medium">{concern.gap}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredConcerns.length === 0 && (
                      <div className="text-center py-12 text-emerald-400">
                        <CheckCircle className="w-16 h-16 mx-auto mb-4" />
                        <p className="text-lg font-medium">All KPIs within acceptable thresholds!</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Data Explorer Tab */}
              {activeTab === 'data' && (
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                  <h3 className="text-lg font-semibold text-white mb-4">KPI Data ({filteredKPIData.length} records)</h3>
                  <div className="overflow-x-auto max-h-[600px]">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0">
                        <tr className="bg-slate-900 text-gray-300">
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
                        {filteredKPIData.slice(0, 100).map((row, i) => (
                          <tr key={i} className="border-t border-slate-700 hover:bg-slate-700/50">
                            <td className="px-3 py-2 text-gray-400">{row.region}</td>
                            <td className="px-3 py-2 text-white">{row.area}</td>
                            <td className="px-3 py-2 text-gray-300">{row.kpi}</td>
                            <td className="px-3 py-2 text-gray-500">{row.uom}</td>
                            <td className="px-3 py-2 text-right text-gray-300">{row.fy25Budget?.toFixed(2) || '-'}</td>
                            <td className="px-3 py-2 text-right text-white font-medium">{row.fy25Actual?.toFixed(2) || '-'}</td>
                            <td className={`px-3 py-2 text-right font-medium ${row.variance && row.variance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
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
