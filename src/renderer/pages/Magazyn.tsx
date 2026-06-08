import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Package, Trash2, ChevronDown, Square, CheckSquare, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import type { Frame } from '../../shared/types'

interface StockGroup {
  key: string
  name: string
  width: number
  height: number
  price: number
  supplier: string
  total: number
  available: number
  sold: number
  frameIds: number[]
}

function groupByType(frames: Frame[]): StockGroup[] {
  const map = new Map<string, StockGroup>()
  for (const f of frames) {
    const key = `${f.name}|${f.width}|${f.height}|${f.price}|${f.supplier}`
    if (map.has(key)) {
      const g = map.get(key)!
      g.total++
      g.frameIds.push(f.id)
      if (f.status === 'available') g.available++
      else g.sold++
    } else {
      map.set(key, {
        key, name: f.name, width: f.width, height: f.height,
        price: f.price, supplier: f.supplier,
        total: 1,
        available: f.status === 'available' ? 1 : 0,
        sold: f.status === 'sold' ? 1 : 0,
        frameIds: [f.id],
      })
    }
  }
  return Array.from(map.values())
}

type SortKey = 'name' | 'size' | 'supplier' | 'price' | 'total' | 'available' | 'sold'
type SortDir = 'asc' | 'desc'

export default function Magazyn() {
  const navigate = useNavigate()
  const [frames, setFrames] = useState<Frame[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [nameFilter, setNameFilter] = useState('')
  const [supplierFilter, setSupplierFilter] = useState<string>('all')
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [showConfirm, setShowConfirm] = useState<boolean>(false)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  useEffect(() => { loadFrames() }, [])

  const loadFrames = async () => {
    const data = await window.api.getAllFrames()
    setFrames(data)
    setSelectedKeys(new Set())
  }

  const suppliers = useMemo(() => [...new Set(frames.map(f => f.supplier).filter(Boolean))].sort(), [frames])

  const groups = useMemo(() => {
    let filtered = [...frames]

    if (nameFilter) {
      const q = nameFilter.toLowerCase()
      filtered = filtered.filter(f => f.name.toLowerCase().includes(q))
    }
    if (supplierFilter !== 'all') {
      filtered = filtered.filter(f => f.supplier === supplierFilter)
    }

    const result = groupByType(filtered)

    let final = result
    if (statusFilter === 'available') final = result.filter(g => g.available > 0)
    else if (statusFilter === 'sold') final = result.filter(g => g.sold > 0)

    const sizeSort = (a: StockGroup, b: StockGroup) => {
      const aArea = a.width * a.height
      const bArea = b.width * b.height
      return sortDir === 'asc' ? aArea - bArea : bArea - aArea
    }

    final.sort((a, b) => {
      switch (sortKey) {
        case 'name': return sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
        case 'size': return sizeSort(a, b)
        case 'supplier': return sortDir === 'asc' ? a.supplier.localeCompare(b.supplier) : b.supplier.localeCompare(a.supplier)
        case 'price': return sortDir === 'asc' ? a.price - b.price : b.price - a.price
        case 'total': return sortDir === 'asc' ? a.total - b.total : b.total - a.total
        case 'available': return sortDir === 'asc' ? a.available - b.available : b.available - a.available
        case 'sold': return sortDir === 'asc' ? a.sold - b.sold : b.sold - a.sold
        default: return 0
      }
    })

    return final
  }, [frames, nameFilter, supplierFilter, statusFilter, sortKey, sortDir])

  const totalAll = frames.length
  const totalAvailable = frames.filter(f => f.status === 'available').length
  const totalSold = frames.filter(f => f.status === 'sold').length

  const toggleSelect = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedKeys.size === groups.length) {
      setSelectedKeys(new Set())
    } else {
      setSelectedKeys(new Set(groups.map(g => g.key)))
    }
  }

  const handleDelete = async () => {
    const idsToDelete: number[] = []
    for (const g of groups) {
      if (selectedKeys.has(g.key)) {
        idsToDelete.push(...g.frameIds)
      }
    }
    if (idsToDelete.length === 0) return
    await window.api.deleteFrames(idsToDelete)
    setShowConfirm(false)
    loadFrames()
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-slate-300 ml-1" />
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-primary-600 ml-1" />
      : <ArrowDown className="w-3 h-3 text-primary-600 ml-1" />
  }

  const selectedCount = [...selectedKeys].reduce((sum, key) => {
    const g = groups.find(g => g.key === key)
    return sum + (g?.total || 0)
  }, 0)

  const hasFilters = nameFilter || supplierFilter !== 'all'

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Magazyn</h1>
          <p className="text-slate-500 mt-1">
            {totalAll} szt. łącznie · {totalAvailable} dostępnych · {totalSold} sprzedanych
          </p>
        </div>
        <div className="flex gap-2">
          {selectedKeys.size > 0 && (
            <button
              onClick={() => setShowConfirm(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 font-medium rounded-xl transition-colors text-sm"
            >
              <Trash2 className="w-4 h-4" />
              Usuń zaznaczone ({selectedCount} szt.)
            </button>
          )}
        </div>
      </div>

      {/* Status filter */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-slate-600">Status:</span>
          <div className="flex gap-1">
            {[
              { value: 'all', label: 'Wszystkie' },
              { value: 'available', label: 'Dostępne' },
              { value: 'sold', label: 'Sprzedane' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === opt.value
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {hasFilters && (
            <button
              onClick={() => { setNameFilter(''); setSupplierFilter('all') }}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium ml-auto"
            >
              Wyczyść filtry
            </button>
          )}
        </div>
      </div>

      {/* Confirm dialog */}
      {showConfirm && (
        <div className="bg-white rounded-2xl border-2 border-red-200 shadow-sm p-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <h3 className="font-semibold text-slate-800">Usunąć {selectedCount} zaznaczonych szt.?</h3>
          </div>
          <p className="text-slate-500 mb-4">Tej operacji nie można cofnąć.</p>
          <div className="flex gap-2">
            <button onClick={handleDelete} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl text-sm transition-colors">
              Tak, usuń
            </button>
            <button onClick={() => setShowConfirm(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-sm transition-colors">
              Anuluj
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {groups.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">Brak ramek w magazynie</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left w-10">
                    <button onClick={toggleSelectAll} className="flex items-center">
                      {selectedKeys.size === groups.length && groups.length > 0 ? (
                        <CheckSquare className="w-5 h-5 text-primary-600" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-300" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left cursor-pointer select-none" onClick={() => handleSort('name')}>
                    <div className="flex items-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Nazwa <SortIcon col="name" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left cursor-pointer select-none" onClick={() => handleSort('size')}>
                    <div className="flex items-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Rozmiar <SortIcon col="size" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left cursor-pointer select-none" onClick={() => handleSort('supplier')}>
                    <div className="flex items-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Dostawca <SortIcon col="supplier" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right cursor-pointer select-none" onClick={() => handleSort('price')}>
                    <div className="flex items-center justify-end text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Cena <SortIcon col="price" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-center cursor-pointer select-none" onClick={() => handleSort('total')}>
                    <div className="flex items-center justify-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Szt. <SortIcon col="total" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-center cursor-pointer select-none" onClick={() => handleSort('available')}>
                    <div className="flex items-center justify-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Dostępne <SortIcon col="available" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-center cursor-pointer select-none" onClick={() => handleSort('sold')}>
                    <div className="flex items-center justify-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Sprzedane <SortIcon col="sold" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Akcje</th>
                </tr>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="px-4 py-2"></th>
                  <th className="px-4 py-2">
                    <input
                      type="text"
                      placeholder="Filtruj..."
                      value={nameFilter}
                      onChange={(e) => setNameFilter(e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </th>
                  <th className="px-4 py-2"></th>
                  <th className="px-4 py-2">
                    <select
                      value={supplierFilter}
                      onChange={(e) => setSupplierFilter(e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                    >
                      <option value="all">Wszyscy</option>
                      {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </th>
                  <th className="px-4 py-2"></th>
                  <th className="px-4 py-2"></th>
                  <th className="px-4 py-2"></th>
                  <th className="px-4 py-2"></th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groups.map((group) => (
                  <tr
                    key={group.key}
                    className={`transition-colors ${
                      selectedKeys.has(group.key) ? 'bg-primary-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <button onClick={() => toggleSelect(group.key)}>
                        {selectedKeys.has(group.key) ? (
                          <CheckSquare className="w-5 h-5 text-primary-600" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-300" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{group.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{group.width} × {group.height} cm</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{group.supplier || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-800 text-right font-medium">{group.price.toLocaleString('pl-PL')} zł</td>
                    <td className="px-4 py-3 text-sm text-center font-medium text-slate-800">{group.total}</td>
                    <td className="px-4 py-3 text-center">
                      {group.available > 0 ? (
                        <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full">
                          {group.available}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {group.sold > 0 ? (
                        <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full">
                          {group.sold}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => navigate(`/edytuj/${group.frameIds[0]}`)}
                        className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                      >
                        Edytuj
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
