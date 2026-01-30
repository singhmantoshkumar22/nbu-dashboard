'use client'

interface KPICardProps {
  title: string
  value: string
  target?: string
  delta?: number
  status: 'green' | 'amber' | 'red' | 'blue'
  icon: string
}

export default function KPICard({ title, value, target, delta, status, icon }: KPICardProps) {
  const statusColors = {
    green: 'border-l-emerald-500 bg-emerald-50',
    amber: 'border-l-amber-500 bg-amber-50',
    red: 'border-l-red-500 bg-red-50',
    blue: 'border-l-indigo-500 bg-indigo-50',
  }

  const deltaColors = {
    positive: 'bg-emerald-100 text-emerald-700',
    negative: 'bg-red-100 text-red-700',
  }

  return (
    <div className={`rounded-xl p-5 border-l-4 ${statusColors[status]} shadow-sm hover:shadow-md transition-shadow`}>
      <div className="text-2xl mb-2">{icon}</div>
      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">{title}</p>
      <p className="text-3xl font-bold text-gray-800">{value}</p>
      {delta !== undefined && (
        <span className={`inline-block mt-2 px-2 py-1 rounded-full text-xs font-medium ${delta >= 0 ? deltaColors.positive : deltaColors.negative}`}>
          {delta >= 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}% vs Target
        </span>
      )}
      {target && <p className="text-xs text-gray-400 mt-2">Target: {target}</p>}
    </div>
  )
}
