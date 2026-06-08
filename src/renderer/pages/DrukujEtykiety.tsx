import { useState, useEffect, useMemo, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { Printer, Square, CheckSquare, FileText, Minus, Plus, Trash2 } from 'lucide-react'
import JsBarcode from 'jsbarcode'
import jsPDF from 'jspdf'
import type { Frame } from '../../shared/types'

interface FrameGroup {
  key: string
  name: string
  width: number
  height: number
  color: string
  price: number
  frames: Frame[]
  printCount: number
}

function groupFrames(frames: Frame[]): FrameGroup[] {
  const map = new Map<string, FrameGroup>()
  for (const f of frames) {
    const key = `${f.name}|${f.width}|${f.height}|${f.color}|${f.price}`
    if (map.has(key)) {
      map.get(key)!.frames.push(f)
    } else {
      map.set(key, {
        key, name: f.name, width: f.width, height: f.height,
        color: f.color, price: f.price, frames: [f], printCount: 0,
      })
    }
  }
  return Array.from(map.values())
}

export default function DrukujEtykiety() {
  const location = useLocation()
  const [frames, setFrames] = useState<Frame[]>([])
  const [filter, setFilter] = useState<string>('available')
  const [groups, setGroups] = useState<FrameGroup[]>([])
  const [lastAddedIds, setLastAddedIds] = useState<number[]>([])
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const state = location.state as { selectedIds?: number[] } | null
    if (state?.selectedIds?.length) {
      setLastAddedIds(state.selectedIds)
      window.history.replaceState({}, '')
    }
  }, [location])

  useEffect(() => { loadFrames() }, [filter])

  const loadFrames = async () => {
    const data = await window.api.getAllFrames(filter === 'all' ? undefined : filter)
    setFrames(data)
    const grouped = groupFrames(data)
    if (lastAddedIds.length > 0) {
      const addedKeys = new Map<string, number>()
      for (const f of data) {
        if (lastAddedIds.includes(f.id)) {
          const key = `${f.name}|${f.width}|${f.height}|${f.color}|${f.price}`
          addedKeys.set(key, (addedKeys.get(key) || 0) + 1)
        }
      }
      setGroups(grouped.map(g => ({
        ...g,
        printCount: addedKeys.get(g.key) || 0,
      })))
      setLastAddedIds([])
    } else {
      setGroups(grouped)
    }
  }

  const updatePrintCount = (key: string, count: number) => {
    setGroups(prev => prev.map(g =>
      g.key === key ? { ...g, printCount: Math.max(0, count) } : g
    ))
  }

  const toggleGroup = (key: string) => {
    setGroups(prev => prev.map(g =>
      g.key === key ? { ...g, printCount: g.printCount > 0 ? 0 : g.frames.length } : g
    ))
  }

  const deleteGroup = (key: string) => {
    setGroups(prev => prev.filter(g => g.key !== key))
  }

  const totalLabels = useMemo(() => groups.reduce((s, g) => s + g.printCount, 0), [groups])

  const calcPages = () => {
    const grid = { '10x15': { cols: 5, rows: 10 }, '15x21': { cols: 4, rows: 7 }, '30x40': { cols: 3, rows: 5 } }
    const bySize = new Map<string, number>()
    for (const g of groups) {
      if (g.printCount > 0) {
        const ls = calcLabelSize(g.width, g.height)
        bySize.set(ls, (bySize.get(ls) || 0) + g.printCount)
      }
    }
    let pages = 0
    for (const [ls, count] of bySize) {
      const pp = grid[ls].cols * grid[ls].rows
      pages += Math.ceil(count / pp)
    }
    return pages
  }

  const calcLabelSize = (w: number, h: number): '10x15' | '15x21' | '30x40' => {
    const area = w * h
    if (area <= 200) return '10x15'
    if (area <= 500) return '15x21'
    return '30x40'
  }

  const printLabels = async () => {
    const toPrint: { frame: Frame; count: number; labelSize: '10x15' | '15x21' | '30x40' }[] = []
    for (const g of groups) {
      if (g.printCount > 0) {
        toPrint.push({ frame: g.frames[0], count: g.printCount, labelSize: calcLabelSize(g.width, g.height) })
      }
    }
    if (toPrint.length === 0) return

    const DPI = 300
    const MM_TO_PX = DPI / 25.4
    const A4_W = 297, A4_H = 210
    const MARGIN = 5
    const GAP = 2

    const sizeMap = {
      '10x15': { w: 45, h: 25 },
      '15x21': { w: 60, h: 35 },
      '30x40': { w: 90, h: 50 },
    }

    const barcodes: Record<string, string> = {}
    for (const { frame } of toPrint) {
      if (!barcodes[frame.barcode]) {
        const c = document.createElement('canvas')
        try {
          JsBarcode(c, frame.barcode, {
            format: 'CODE128', width: 1.5, height: 35,
            displayValue: true, margin: 2,
            fontSize: 14, font: 'monospace',
          })
          barcodes[frame.barcode] = c.toDataURL('image/png')
        } catch (e) { barcodes[frame.barcode] = '' }
      }
    }

    const bySize = new Map<string, Frame[]>()
    for (const { frame, count, labelSize } of toPrint) {
      if (!bySize.has(labelSize)) bySize.set(labelSize, [])
      const arr = bySize.get(labelSize)!
      for (let i = 0; i < count; i++) arr.push(frame)
    }

    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    let firstPage = true

    for (const [ls, frames] of bySize) {
      const s = sizeMap[ls as keyof typeof sizeMap]
      const cols = Math.floor((A4_W - MARGIN * 2 + GAP) / (s.w + GAP))
      const rows = Math.floor((A4_H - MARGIN * 2 + GAP) / (s.h + GAP))
      const perPage = cols * rows
      const totalPages = Math.ceil(frames.length / perPage)

      for (let page = 0; page < totalPages; page++) {
        if (firstPage) firstPage = false
        else pdf.addPage()

        const canvas = document.createElement('canvas')
        canvas.width = Math.round(A4_W * MM_TO_PX)
        canvas.height = Math.round(A4_H * MM_TO_PX)
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        const start = page * perPage
        const end = Math.min(start + perPage, frames.length)

        for (let i = start; i < end; i++) {
          const idx = i - start
          const col = idx % cols
          const row = Math.floor(idx / cols)

          const lx = Math.round((MARGIN + col * (s.w + GAP)) * MM_TO_PX)
          const ly = Math.round((MARGIN + row * (s.h + GAP)) * MM_TO_PX)
          const lw = Math.round(s.w * MM_TO_PX)
          const lh = Math.round(s.h * MM_TO_PX)

          ctx.strokeStyle = '#ccc'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.roundRect(lx, ly, lw, lh, 4)
          ctx.stroke()

          const frame = frames[i]

          const barcodeImgW = Math.round(lw * 0.4)
          const barcodeImgH = Math.round(lh * 0.5)
          const barcodeX = lx + Math.round(2 * MM_TO_PX)
          const barcodeY = ly + Math.round((lh - barcodeImgH) / 2)

          if (barcodes[frame.barcode]) {
            const img = new Image()
            img.src = barcodes[frame.barcode]
            await new Promise<void>((resolve) => {
              img.onload = () => { ctx.drawImage(img, barcodeX, barcodeY, barcodeImgW, barcodeImgH); resolve() }
              img.onerror = () => resolve()
            })
          }

          const sepX = barcodeX + barcodeImgW + Math.round(2 * MM_TO_PX)
          ctx.strokeStyle = '#ccc'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(sepX, ly + Math.round(3 * MM_TO_PX))
          ctx.lineTo(sepX, ly + lh - Math.round(3 * MM_TO_PX))
          ctx.stroke()

          const textX = sepX + Math.round(3 * MM_TO_PX)
          const textMaxW = lw - barcodeImgW - Math.round(12 * MM_TO_PX)

          const labelFs = ls === '10x15' ? 22 : ls === '30x40' ? 38 : 28
          const valueFs = ls === '10x15' ? 28 : ls === '30x40' ? 48 : 36
          const lineGap = ls === '10x15' ? 32 : ls === '30x40' ? 54 : 42
          const nameLineGap = Math.round(valueFs * 1.15)

          const wrapText = (text: string, maxWidth: number, fontSize: number): string[] => {
            ctx.font = `bold ${fontSize}px Arial, sans-serif`
            const words = text.split(/[\s-]+/)
            const lines: string[] = []
            let current = ''
            for (const word of words) {
              const test = current ? current + ' ' + word : word
              if (ctx.measureText(test).width > maxWidth && current) {
                lines.push(current)
                current = word
              } else {
                current = test
              }
            }
            if (current) lines.push(current)
            return lines.length ? lines : [text]
          }

          const startY = ly + Math.round(4 * MM_TO_PX)

          ctx.fillStyle = '#888'
          ctx.font = `${labelFs}px Arial, sans-serif`
          ctx.fillText('Nazwa:', textX, startY)

          ctx.fillStyle = '#111'
          ctx.font = `bold ${valueFs}px Arial, sans-serif`
          const nameLines = wrapText(frame.name, textMaxW, valueFs)
          const maxNameLines = ls === '10x15' ? 2 : 3
          const truncatedLines = nameLines.slice(0, maxNameLines)
          if (nameLines.length > maxNameLines) {
            truncatedLines[maxNameLines - 1] = truncatedLines[maxNameLines - 1].slice(0, -1) + '\u2026'
          }
          truncatedLines.forEach((line, li) => {
            ctx.fillText(line, textX, startY + lineGap + nameLineGap * li)
          })

          const afterNameY = startY + lineGap + nameLineGap * truncatedLines.length + Math.round(2 * MM_TO_PX)

          ctx.fillStyle = '#888'
          ctx.font = `${labelFs}px Arial, sans-serif`
          ctx.fillText('Rozmiar:', textX, afterNameY)
          ctx.fillStyle = '#111'
          ctx.font = `bold ${valueFs}px Arial, sans-serif`
          ctx.fillText(`${frame.width} x ${frame.height} cm`, textX, afterNameY + lineGap)

          ctx.fillStyle = '#888'
          ctx.font = `${labelFs}px Arial, sans-serif`
          ctx.fillText('Cena:', textX, afterNameY + lineGap * 2)
          ctx.fillStyle = '#111'
          ctx.font = `bold ${valueFs}px Arial, sans-serif`
          ctx.fillText(`${frame.price.toLocaleString('pl-PL')} zl`, textX, afterNameY + lineGap * 3)
        }

        const pageImg = canvas.toDataURL('image/jpeg', 0.92)
        pdf.addImage(pageImg, 'JPEG', 0, 0, A4_W, A4_H)
      }
    }

    const totalLabels = toPrint.reduce((s, t) => s + t.count, 0)
    const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹż_-]/g, '_').replace(/_+/g, '_')
    let fileName: string
    if (toPrint.length === 1) {
      const f = toPrint[0].frame
      fileName = `${sanitize(f.name)}_${f.width}x${f.height}cm_${f.price.toLocaleString('pl-PL')}zl`
    } else {
      const names = [...new Set(toPrint.map(t => t.frame.name))]
      fileName = `etykiety_${names.slice(0, 3).map(sanitize).join('_')}${names.length > 3 ? '_i_inne' : ''}`
    }
    fileName += `_${totalLabels}szt`
    pdf.save(`${fileName}.pdf`)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div ref={printRef} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Drukuj etykiety</h1>
          <p className="text-slate-500 mt-1">
            Wybierz ile etykiet wydrukować dla każdego typu ramki
          </p>
        </div>
        <div className="flex items-center gap-3">
          {groups.some(g => g.printCount > 0) && (
            <button
              onClick={() => setGroups(prev => prev.filter(g => g.printCount === 0))}
              className="flex items-center gap-2 px-5 py-3 bg-red-50 hover:bg-red-100 text-red-700 font-medium rounded-xl transition-colors text-sm"
            >
              <Trash2 className="w-4 h-4" />
              Usuń zaznaczone
            </button>
          )}
          <button
            onClick={printLabels}
            disabled={totalLabels === 0}
            className="flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors shadow-sm"
          >
            <Printer className="w-5 h-5" />
            Drukuj ({totalLabels})
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">Status:</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="available">Dostępne</option>
              <option value="sold">Sprzedane</option>
              <option value="all">Wszystkie</option>
            </select>
          </div>
          {totalLabels > 0 && (
            <div className="ml-auto flex items-center gap-2 text-sm text-slate-500">
              <FileText className="w-4 h-4" />
              <span>{totalLabels} etykiet → {calcPages()} {calcPages() === 1 ? 'strona' : 'stron'} A4</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <button
            onClick={() => {
              const allSelected = groups.every(g => g.printCount === g.frames.length)
              setGroups(prev => prev.map(g => ({ ...g, printCount: allSelected ? 0 : g.frames.length })))
            }}
            className="flex items-center gap-2 text-sm text-slate-600"
          >
            {groups.every(g => g.printCount === g.frames.length) ? (
              <CheckSquare className="w-5 h-5 text-primary-600" />
            ) : (
              <Square className="w-5 h-5" />
            )}
            Zaznacz wszystkie ({frames.length} szt. w {groups.length} typach)
          </button>
        </div>

        {groups.length === 0 ? (
          <div className="p-12 text-center">
            <Printer className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">Brak ramek do druku</p>
            <p className="text-sm text-slate-400 mt-1">Najpierw dodaj ramki w zakładce "Dodaj ramkę"</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {groups.map((group) => (
              <div
                key={group.key}
                className={`flex items-center gap-4 p-4 transition-colors ${
                  group.printCount > 0 ? 'bg-primary-50' : 'hover:bg-slate-50'
                }`}
              >
                <button onClick={() => toggleGroup(group.key)} className="flex-shrink-0">
                  {group.printCount > 0 ? (
                    <CheckSquare className="w-5 h-5 text-primary-600" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-300" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 truncate">{group.name}</p>
                  <p className="text-sm text-slate-500">
                    {group.width} × {group.height} cm · {group.color || '—'} ·{' '}
                    {group.price.toLocaleString('pl-PL')} zł
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">{group.frames.length} szt.</span>
                  <div className="flex items-center gap-1 bg-slate-100 rounded-lg">
                    <button
                      onClick={() => updatePrintCount(group.key, group.printCount - 1)}
                      className="p-1.5 hover:bg-slate-200 rounded-l-lg transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5 text-slate-600" />
                    </button>
                    <input
                      type="number"
                      min={0}
                      value={group.printCount}
                      onChange={(e) => updatePrintCount(group.key, parseInt(e.target.value) || 0)}
                      className="w-10 text-center text-sm font-medium bg-transparent focus:outline-none"
                    />
                    <button
                      onClick={() => updatePrintCount(group.key, group.printCount + 1)}
                      className="p-1.5 hover:bg-slate-200 rounded-r-lg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 text-slate-600" />
                    </button>
                  </div>
                  <button
                    onClick={() => deleteGroup(group.key)}
                    className="p-1.5 hover:bg-red-50 rounded-lg transition-colors text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
