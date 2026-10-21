import { useEffect, useId, useRef, useState, type PointerEvent } from 'react'
import { cn } from '@/lib/utils'

// Small SVG charts. Single series per chart (one axis, no dual scales); hover shows a
// crosshair and tooltip; values are always available in a table next to the chart.

interface Point {
  label: string
  value: number | null
  detail?: string
}

/** Chart width in real pixels, so SVG text stays at its true size on any screen. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(640)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

const PAD = { top: 16, right: 16, bottom: 28, left: 44 }

function useHover(count: number, innerWidth: number, W: number) {
  const ref = useRef<SVGSVGElement>(null)
  const [index, setIndex] = useState<number | null>(null)
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    const x = ((e.clientX - box.left) / box.width) * W - PAD.left
    const step = count > 1 ? innerWidth / (count - 1) : innerWidth
    setIndex(Math.max(0, Math.min(count - 1, Math.round(x / step))))
  }
  return { ref, index, setIndex, onMove }
}

function fmt(n: number) {
  return Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(Math.abs(n) >= 10000 ? 0 : 1)}K` : String(n)
}

export function LineChart({
  points,
  height = 220,
  domain,
  zeroLine,
  ariaLabel,
  valueLabel,
}: {
  points: Point[]
  height?: number
  domain?: [number, number]
  zeroLine?: boolean
  ariaLabel: string
  valueLabel: (v: number | null) => string
}) {
  const [box, W] = useWidth()
  const innerW = W - PAD.left - PAD.right
  const innerH = height - PAD.top - PAD.bottom
  const values = points.map((p) => p.value).filter((v): v is number => v !== null)
  const [min, max] = domain ?? [0, Math.max(1, ...values) * 1.1]
  const x = (i: number) => PAD.left + (points.length > 1 ? (i * innerW) / (points.length - 1) : innerW / 2)
  const y = (v: number) => PAD.top + innerH - ((v - min) / (max - min)) * innerH
  const ticks = [min, min + (max - min) / 2, max]
  const hover = useHover(points.length, innerW, W)
  const gradient = useId()

  // Break the line where a value is missing; never interpolate fabricated samples.
  const segments: string[] = []
  let current = ''
  points.forEach((p, i) => {
    if (p.value === null) {
      if (current) segments.push(current)
      current = ''
      return
    }
    current += `${current ? 'L' : 'M'}${x(i)} ${y(p.value)}`
  })
  if (current) segments.push(current)
  const area = values.length === points.length && !domain ? `${segments[0]}L${x(points.length - 1)} ${y(min)}L${x(0)} ${y(min)}Z` : null
  const hi = hover.index !== null ? points[hover.index] : null

  return (
    <div className="relative" ref={box}>
      <svg
        ref={hover.ref}
        viewBox={`0 0 ${W} ${height}`}
        className="w-full touch-none select-none text-muted"
        role="img"
        aria-label={ariaLabel}
        onPointerMove={hover.onMove}
        onPointerLeave={() => hover.setIndex(null)}
      >
        <defs>
          <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--chart-line)" stopOpacity="0.22" />
            <stop offset="1" stopColor="var(--chart-line)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={0.14} />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize="12" fill="currentColor" className="tabular">
              {fmt(Math.round(t))}
            </text>
          </g>
        ))}
        {zeroLine && <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} stroke="currentColor" strokeOpacity={0.4} strokeDasharray="4 4" />}
        {area && <path d={area} fill={`url(#${gradient})`} />}
        {segments.map((d) => (
          <path key={d} d={d} fill="none" stroke="var(--chart-line)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {points.map((p, i) => (
          <g key={p.label + i}>
            {p.value !== null ? (
              <circle cx={x(i)} cy={y(p.value)} r={hover.index === i ? 5 : 4} fill="var(--chart-line)" stroke="var(--surface)" strokeWidth={2} />
            ) : (
              <circle cx={x(i)} cy={y(zeroLine ? 0 : min)} r={4} fill="none" stroke="currentColor" strokeDasharray="2 2" />
            )}
            <text x={x(i)} y={height - 8} textAnchor="middle" fontSize="12" fill="currentColor">
              {p.label}
            </text>
          </g>
        ))}
        {hover.index !== null && <line x1={x(hover.index)} x2={x(hover.index)} y1={PAD.top} y2={PAD.top + innerH} stroke="currentColor" strokeOpacity={0.35} />}
      </svg>
      {hi && hover.index !== null && (
        <div
          className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-lg border border-border bg-surface-3 px-3 py-2 text-xs shadow-lg"
          style={{ left: `${(x(hover.index) / W) * 100}%` }}
        >
          <p className="font-semibold text-text">{hi.label}</p>
          <p className="tabular text-text-2">{valueLabel(hi.value)}</p>
          {hi.detail && <p className="text-muted">{hi.detail}</p>}
        </div>
      )}
    </div>
  )
}

export function BarChart({ points, height = 180, ariaLabel, valueLabel }: { points: Point[]; height?: number; ariaLabel: string; valueLabel: (v: number | null) => string }) {
  const [box, W] = useWidth()
  const innerW = W - PAD.left - PAD.right
  const innerH = height - PAD.top - PAD.bottom
  const max = Math.max(1, ...points.map((p) => p.value ?? 0)) * 1.15
  const slot = innerW / points.length
  const bw = Math.min(44, slot - 2)
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH
  const [hi, setHi] = useState<number | null>(null)
  return (
    <div className="relative" ref={box}>
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full select-none text-muted" role="img" aria-label={ariaLabel} onPointerLeave={() => setHi(null)}>
        {[0, max / 2, max].map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={0.14} />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize="12" fill="currentColor" className="tabular">
              {Math.round(t)}
            </text>
          </g>
        ))}
        {points.map((p, i) => {
          const cx = PAD.left + slot * i + slot / 2
          const v = p.value ?? 0
          const top = y(v)
          const h = Math.max(0, PAD.top + innerH - top)
          const r = Math.min(4, h)
          return (
            <g key={p.label + i} onPointerEnter={() => setHi(i)}>
              <rect x={PAD.left + slot * i} y={PAD.top} width={slot} height={innerH} fill="transparent" />
              <path
                d={`M${cx - bw / 2} ${top + h}V${top + r}Q${cx - bw / 2} ${top} ${cx - bw / 2 + r} ${top}H${cx + bw / 2 - r}Q${cx + bw / 2} ${top} ${cx + bw / 2} ${top + r}V${top + h}Z`}
                fill="var(--chart-line)"
                opacity={hi === null || hi === i ? 1 : 0.55}
              />
              <text x={cx} y={height - 8} textAnchor="middle" fontSize="12" fill="currentColor">
                {p.label}
              </text>
            </g>
          )
        })}
      </svg>
      {hi !== null && (
        <div className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-lg border border-border bg-surface-3 px-3 py-2 text-xs shadow-lg" style={{ left: `${((PAD.left + slot * hi + slot / 2) / W) * 100}%` }}>
          <p className="font-semibold text-text">{points[hi].label}</p>
          <p className="tabular text-text-2">{valueLabel(points[hi].value)}</p>
        </div>
      )}
    </div>
  )
}

/** Negative / neutral / positive share as one diverging bar with a legend and counts. */
export function SentimentBar({ negative, neutral, positive, className }: { negative: number; neutral: number; positive: number; className?: string }) {
  const total = negative + neutral + positive
  const parts: [string, number, string][] = [
    ['Negative', negative, 'var(--chart-neg)'],
    ['Neutral', neutral, 'var(--chart-mid)'],
    ['Positive', positive, 'var(--chart-pos)'],
  ]
  if (!total) return <p className="text-sm text-muted">No sample mentions.</p>
  return (
    <div className={className}>
      <div className="flex h-3 gap-[2px] overflow-hidden rounded" role="img" aria-label={parts.map(([l, n]) => `${l} ${n}`).join(', ')}>
        {parts.map(([label, n, color]) => n > 0 && <div key={label} style={{ width: `${(n / total) * 100}%`, background: color }} />)}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem] text-text-2">
        {parts.map(([label, n, color]) => (
          <li key={label} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: color }} aria-hidden />
            {label} <span className="tabular text-muted">{n} · {Math.round((n / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function DataTable({ caption, columns, rows, className }: { caption: string; columns: string[]; rows: (string | number)[][]; className?: string }) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full text-left text-[0.8125rem]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border text-muted">
            {columns.map((c) => (
              <th key={c} scope="col" className="px-3 py-2 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/60 last:border-0">
              {r.map((v, j) => (
                <td key={j} className="tabular px-3 py-2 text-text-2">
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
