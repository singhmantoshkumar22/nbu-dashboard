'use client'

import { useState, useCallback } from 'react'
import { Upload, BarChart3, TrendingUp, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { processExcelFile, DashboardMetrics } from '@/lib/kpi-processor'
import { uploadFile } from '@/lib/supabase'
import KPICard from '@/components/KPICard'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts'

function getRAGStatus(value: number, target: number, direction: 'higher' | 'lower' = 'higher'): 'green' | 'amber' | 'red' {
  const variance = direction === 'higher'
    ? ((value - target) / target) * 100
    : ((target - value) / target) * 100

  if (variance >= 0) return 'green'
  if (variance >= -10) return 'amber'
  return 'red'
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [fileName, setFileName] = useState('')
  const [activeTab, setActiveTab] = useState('summary')

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setFileName(file.name)

    try {
      // Upload to Supabase
      await uploadFile(file)

      // Process locally
      const buffer = await file.arrayBuffer()
      const data = processExcelFile(buffer)
      setMetrics(data)
    } catch (error) {
      console.error('Error processing file:', error)
      alert('Error processing file. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  const criticalConcerns = metrics?.concerns.filter(c => c.priority === 'critical') || []
  const warningConcerns = metrics?.concerns.filter(c => c.priority === 'warning') || []

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <div className="gradient-header rounded-2xl p-8 mb-8 shadow-xl">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <BarChart3 className="w-8 h-8" />
          NBU Executive Dashboard
        </h1>
        <p className="text-white/80 mt-2">Strategic Management Information System</p>
        <div className="mt-4 flex items-center gap-4">
          <span className="bg-white/20 px-4 py-2 rounded-full text-white text-sm">
            {new Date().toLocaleDateString('en-IN', { dateStyle: 'full' })}
          </span>
          {fileName && (
            <span className="bg-white/20 px-4 py-2 rounded-full text-white text-sm">
              📁 {fileName}
            </span>
          )}
        </div>
      </div>

      {/* File Upload */}
      {!metrics && (
        <div className="glass-card rounded-2xl p-12 text-center shadow-lg mb-8">
          <Upload className="w-16 h-16 mx-auto text-indigo-500 mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Upload NBU Weekly Business Tracker</h2>
          <p className="text-gray-500 mb-6">Select your Excel file to generate the dashboard</p>
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
              disabled={loading}
            />
            <span className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-8 py-4 rounded-xl font-medium hover:shadow-lg transition-shadow">
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
      )}

      {/* Dashboard Content */}
      {metrics && (
        <>
          {/* Tab Navigation */}
          <div className="flex gap-2 mb-6">
            {['summary', 'delivery', 'concerns', 'data'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 rounded-lg font-medium transition-all ${
                  activeTab === tab
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {tab === 'summary' && '📊 Executive Summary'}
                {tab === 'delivery' && '🚚 Delivery KPIs'}
                {tab === 'concerns' && `⚠️ Concerns (${metrics.concerns.length})`}
                {tab === 'data' && '📋 Data Explorer'}
              </button>
            ))}
          </div>

          {/* Executive Summary Tab */}
          {activeTab === 'summary' && (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                <KPICard
                  title="Freight Booking"
                  value={`₹${metrics.freightBooking.toFixed(1)} Cr`}
                  icon="💰"
                  status="blue"
                />
                <KPICard
                  title="GM2% on Sale"
                  value={`${metrics.gm2Percent.toFixed(1)}%`}
                  target="8%"
                  delta={((metrics.gm2Percent - 8) / 8) * 100}
                  icon="📊"
                  status={getRAGStatus(metrics.gm2Percent, 8)}
                />
                <KPICard
                  title="Est. PBT%"
                  value={`${metrics.pbtPercent.toFixed(1)}%`}
                  target="3%"
                  delta={((metrics.pbtPercent - 3) / 3) * 100}
                  icon="💎"
                  status={getRAGStatus(metrics.pbtPercent, 3)}
                />
                <KPICard
                  title="On-Time Delivery"
                  value={`${metrics.otdPercent.toFixed(1)}%`}
                  target="95%"
                  delta={((metrics.otdPercent - 95) / 95) * 100}
                  icon="🚚"
                  status={getRAGStatus(metrics.otdPercent, 95)}
                />
                <KPICard
                  title="In-Full Delivery"
                  value={`${metrics.ifdPercent.toFixed(1)}%`}
                  target="92%"
                  delta={((metrics.ifdPercent - 92) / 92) * 100}
                  icon="📦"
                  status={getRAGStatus(metrics.ifdPercent, 92)}
                />
                <KPICard
                  title="LHC Advance"
                  value={`${metrics.lhcAdvance.toFixed(1)}%`}
                  target="80%"
                  delta={((metrics.lhcAdvance - 80) / 80) * 100}
                  icon="💳"
                  status={getRAGStatus(metrics.lhcAdvance, 80)}
                />
              </div>

              {/* Quick Concerns Summary */}
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card rounded-xl p-6 shadow-lg">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">On-Time Delivery by Area</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={metrics.otdData.slice(0, 15)}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 100]} />
                      <YAxis dataKey="area" type="category" tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <ReferenceLine x={95} stroke="#ef4444" strokeDasharray="5 5" label="Target" />
                      <Bar dataKey="actual" radius={[0, 4, 4, 0]}>
                        {metrics.otdData.slice(0, 15).map((entry, index) => (
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
                <h3 className="text-lg font-semibold text-gray-800 mb-4">In-Full Delivery by Area</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={metrics.ifdData.slice(0, 15)}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 100]} />
                      <YAxis dataKey="area" type="category" tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <ReferenceLine x={92} stroke="#ef4444" strokeDasharray="5 5" label="Target" />
                      <Bar dataKey="actual" radius={[0, 4, 4, 0]}>
                        {metrics.ifdData.slice(0, 15).map((entry, index) => (
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
          )}

          {/* Concerns Tab */}
          {activeTab === 'concerns' && (
            <div className="glass-card rounded-xl p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">All Concern Items</h3>
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
                    {metrics.concerns.map((concern, i) => (
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
                            {concern.priority === 'critical' ? '🔴 Critical' : '🟡 Warning'}
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
                {metrics.concerns.length === 0 && (
                  <div className="text-center py-8 text-emerald-600">
                    <CheckCircle className="w-12 h-12 mx-auto mb-2" />
                    All KPIs within acceptable thresholds!
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Data Explorer Tab */}
          {activeTab === 'data' && (
            <div className="glass-card rounded-xl p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">KPI Data ({metrics.kpiData.length} records)</h3>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-sm">
                  <thead className="sticky top-0">
                    <tr className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
                      <th className="px-3 py-2 text-left">Region</th>
                      <th className="px-3 py-2 text-left">Area</th>
                      <th className="px-3 py-2 text-left">KPI</th>
                      <th className="px-3 py-2 text-right">FY25 Budget</th>
                      <th className="px-3 py-2 text-right">FY25 Actual</th>
                      <th className="px-3 py-2 text-right">Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.kpiData.slice(0, 100).map((row, i) => (
                      <tr key={i} className="border-b hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-600">{row.region}</td>
                        <td className="px-3 py-2 text-gray-700">{row.area}</td>
                        <td className="px-3 py-2 font-medium">{row.kpi}</td>
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

          {/* Upload New File Button */}
          <div className="mt-8 text-center">
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
              <span className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium">
                <Upload className="w-4 h-4" />
                Upload New File
              </span>
            </label>
          </div>
        </>
      )}
    </div>
  )
}
