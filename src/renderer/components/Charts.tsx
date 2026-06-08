import { useState } from 'react'

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#14b8a6']

export function PieChart({ data, label }: { data: { label: string; value: number }[]; label: string }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <div className="text-center text-slate-400 py-8">Brak danych</div>

  let cum = 0
  const r = 80
  const cx = 100
  const cy = 100

  const arcs = data.map((d, i) => {
    const start = cum
    cum += d.value / total
    const end = cum
    const large = end - start > 0.5 ? 1 : 0
    const x1 = cx + r * Math.cos(2 * Math.PI * start - Math.PI / 2)
    const y1 = cy + r * Math.sin(2 * Math.PI * start - Math.PI / 2)
    const x2 = cx + r * Math.cos(2 * Math.PI * end - Math.PI / 2)
    const y2 = cy + r * Math.sin(2 * Math.PI * end - Math.PI / 2)
    return { d, x1, y1, x2, y2, large, color: PIE_COLORS[i % PIE_COLORS.length] }
  })

  const hoveredArc = hovered !== null ? arcs[hovered] : null
  const hoveredPct = hovered !== null ? ((arcs[hovered].d.value / total) * 100).toFixed(1) : null

  return (
    <div className="flex items-start gap-6">
      <div className="relative">
        <svg viewBox="0 0 200 200" className="w-44 h-44 flex-shrink-0">
          {arcs.map((a, i) => (
            <path
              key={i}
              d={`M${cx},${cy} L${a.x1},${a.y1} A${r},${r} 0 ${a.large} 1 ${a.x2},${a.y2} Z`}
              fill={a.color}
              stroke="white"
              strokeWidth="2"
              opacity={hovered === null || hovered === i ? 1 : 0.4}
              style={{ cursor: 'pointer', transition: 'opacity 0.2s, transform 0.2s', transformOrigin: `${cx}px ${cy}px`, transform: hovered === i ? 'scale(1.05)' : 'scale(1)' }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
          <circle cx={cx} cy={cy} r="40" fill="white" />
          {hoveredArc ? (
            <>
              <text x={cx} y={cy - 6} textAnchor="middle" className="text-[9px] fill-slate-500 font-medium">
                {hoveredArc.d.label.length > 12 ? hoveredArc.d.label.slice(0, 11) + '…' : hoveredArc.d.label}
              </text>
              <text x={cx} y={cy + 7} textAnchor="middle" className="text-[13px] fill-slate-800 font-bold">
                {hoveredArc.d.value.toLocaleString('pl-PL')} {label}
              </text>
              <text x={cx} y={cy + 20} textAnchor="middle" className="text-[10px] fill-slate-400">
                {hoveredPct}%
              </text>
            </>
          ) : (
            <>
              <text x={cx} y={cy - 4} textAnchor="middle" className="text-[10px] fill-slate-500 font-medium">{label}</text>
              <text x={cx} y={cy + 12} textAnchor="middle" className="text-[14px] fill-slate-800 font-bold">{total.toLocaleString('pl-PL')}</text>
            </>
          )}
        </svg>
      </div>
      <div className="flex flex-col gap-1.5 text-sm min-w-0">
        {arcs.map((a, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 min-w-0 px-2 py-1 rounded-lg transition-colors cursor-pointer ${hovered === i ? 'bg-slate-100' : ''}`}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: a.color }} />
            <span className="text-slate-600 truncate">{a.d.label}</span>
            <span className="text-slate-400 ml-auto flex-shrink-0">{a.d.value.toLocaleString('pl-PL')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function HorizontalBarChart({ data, valueLabel }: { data: { label: string; value: number; sub?: string }[]; valueLabel?: string }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="space-y-3">
      {data.map((d, i) => (
        <div
          key={i}
          className={`flex items-center gap-3 px-2 py-1 rounded-lg transition-colors cursor-pointer ${hovered === i ? 'bg-slate-50' : ''}`}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
        >
          <span className="text-sm text-slate-600 w-36 truncate flex-shrink-0" title={d.label}>{d.label}</span>
          <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
            <div
              className="bg-primary-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min((d.value / max) * 100, 100)}%` }}
            />
          </div>
          <span className="text-sm font-semibold text-slate-700 w-20 text-right flex-shrink-0">
            {d.value.toLocaleString('pl-PL')}{valueLabel ? ` ${valueLabel}` : ''}
          </span>
          {d.sub && <span className="text-xs text-slate-400 w-12 text-right flex-shrink-0">{d.sub}</span>}
        </div>
      ))}
    </div>
  )
}

export function VerticalBarChart({ data }: { data: { label: string; value: number; sub?: string }[] }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="flex items-end gap-2 h-48">
      {data.map((d, i) => (
        <div
          key={i}
          className="flex-1 flex flex-col items-center gap-1 min-w-0 cursor-pointer"
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
        >
          {hovered === i && (
            <div className="bg-slate-800 text-white text-[10px] font-medium px-2 py-0.5 rounded mb-1 whitespace-nowrap">
              {d.value.toLocaleString('pl-PL')} zł{d.sub ? ` (${d.sub})` : ''}
            </div>
          )}
          {hovered !== i && <span className="text-[10px] font-semibold text-slate-600">{d.value.toLocaleString('pl-PL')}</span>}
          <div className="w-full bg-slate-100 rounded-t-lg relative" style={{ height: '120px' }}>
            <div
              className="absolute bottom-0 w-full rounded-t-lg transition-all duration-500"
              style={{
                height: `${Math.max((d.value / max) * 100, 4)}%`,
                background: hovered === i ? 'linear-gradient(to top, #4f46e5, #818cf8)' : 'linear-gradient(to top, #3b82f6, #60a5fa)',
              }}
            />
          </div>
          <span className="text-[10px] text-slate-500 text-center truncate w-full" title={d.label}>{d.label}</span>
          {d.sub && <span className="text-[9px] text-slate-400">{d.sub}</span>}
        </div>
      ))}
    </div>
  )
}
