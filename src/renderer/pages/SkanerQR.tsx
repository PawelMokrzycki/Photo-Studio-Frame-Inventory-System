import { useState, useRef, useEffect, useCallback } from 'react'
import { Check, X, ScanBarcode, ShoppingCart } from 'lucide-react'
import type { Frame } from '../../shared/types'

export default function SkanerQR() {
  const [inputCode, setInputCode] = useState('')
  const [lastSold, setLastSold] = useState<Frame | null>(null)
  const [error, setError] = useState('')
  const [stats, setStats] = useState({ sold: 0, total: 0 })
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const soldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const focus = () => inputRef.current?.focus()
    focus()
    const interval = setInterval(focus, 500)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    window.api.getStats().then((s) => {
      setStats({ sold: s.soldFrames, total: s.totalFrames })
    })
  }, [lastSold])

  const processScan = useCallback(async (code: string) => {
    const trimmed = code.trim()
    if (!trimmed || trimmed.length < 3) return

    setError('')

    const frame = await window.api.getFrameByBarcode(trimmed)

    if (!frame) {
      setError(`Nie znaleziono: "${trimmed}"`)
      setInputCode('')
      setTimeout(() => setError(''), 2000)
      return
    }

    if (frame.status === 'sold') {
      setError(`"${frame.name}" - już wydano`)
      setInputCode('')
      setTimeout(() => setError(''), 2000)
      return
    }

    await window.api.sellFrame(frame.id, frame.price, '', '')
    setLastSold(frame)
    setStats((prev) => ({ sold: prev.sold + 1, total: prev.total }))
    setInputCode('')

    if (soldTimerRef.current) clearTimeout(soldTimerRef.current)
    soldTimerRef.current = setTimeout(() => setLastSold(null), 1500)
  }, [])

  const handleInputChange = (value: string) => {
    setInputCode(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (value.trim().length >= 3) processScan(value)
    }, 80)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (timerRef.current) clearTimeout(timerRef.current)
      processScan(inputCode)
    }
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Skaner</h1>
          <p className="text-slate-500 mt-1">Zeskanuj kod = wydanie z magazynu</p>
        </div>
        <div className="flex gap-4 text-sm">
          <div className="bg-white rounded-xl border border-slate-200 px-4 py-2 text-center shadow-sm">
            <p className="text-slate-500">Wydanych</p>
            <p className="text-xl font-bold text-emerald-600">{stats.sold}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 px-4 py-2 text-center shadow-sm">
            <p className="text-slate-500">W magazynie</p>
            <p className="text-xl font-bold text-primary-600">{stats.total - stats.sold}</p>
          </div>
        </div>
      </div>

      {lastSold && (
        <div className="bg-emerald-500 rounded-3xl p-10 text-center animate-fade-in shadow-lg shadow-emerald-200">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-10 h-10 text-white" />
          </div>
          <p className="text-3xl font-bold text-white">WYDANO</p>
          <p className="text-xl text-emerald-100 mt-2">{lastSold.name}</p>
          <p className="text-3xl font-bold text-white mt-3">
            {lastSold.price.toLocaleString('pl-PL')} zł
          </p>
        </div>
      )}

      {error && !lastSold && (
        <div className="bg-red-500 rounded-3xl p-10 text-center animate-fade-in">
          <X className="w-12 h-12 text-white mx-auto mb-3" />
          <p className="text-xl font-bold text-white">{error}</p>
        </div>
      )}

      {!lastSold && (
        <div className="bg-white rounded-3xl border-2 border-slate-200 shadow-lg overflow-hidden">
          <div className="bg-emerald-500 p-4 flex items-center justify-center gap-3">
            <ScanBarcode className="w-6 h-6 text-white" />
            <p className="text-white font-bold text-lg">Gotowy do skanowania</p>
          </div>

          <div className="p-8">
            <input
              ref={inputRef}
              type="text"
              value={inputCode}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Zeskanuj kod kreskowy..."
              autoFocus
              className="w-full px-8 py-8 bg-slate-50 border-2 border-slate-200 rounded-2xl text-3xl text-center font-mono font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-200 focus:border-emerald-400 transition-all placeholder:text-slate-300 placeholder:font-normal placeholder:text-xl"
            />

            <div className="mt-6 flex items-center justify-center gap-3 text-slate-400">
              <ShoppingCart className="w-5 h-5" />
              <p className="text-sm">Przyłóż czytnik do kodu kreskowego na ramce</p>
            </div>

            <p className="text-center text-xs text-slate-400 mt-3">
              Skanujesz → Ramka wydana z magazynu
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
