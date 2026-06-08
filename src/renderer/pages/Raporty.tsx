import { useState, useEffect, useMemo } from 'react'
import { BarChart3, TrendingUp, Calendar, Download, Package, ChevronDown } from 'lucide-react'
import type { Sale, Stats } from '../../shared/types'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { loadFont } from '../../shared/pdfFont'
import { PieChart, HorizontalBarChart, VerticalBarChart } from '../components/Charts'

interface MonthGroup {
  month: string
  sales: Sale[]
  total: number
  count: number
  byType: { name: string; count: number; total: number }[]
}

function groupByMonth(sales: Sale[]): MonthGroup[] {
  const map = new Map<string, Sale[]>()
  for (const s of sales) {
    const m = s.sale_date.slice(0, 7)
    if (!map.has(m)) map.set(m, [])
    map.get(m)!.push(s)
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, monthSales]) => {
      const byTypeMap = new Map<string, { name: string; count: number; total: number }>()
      for (const s of monthSales) {
        const key = `${s.name}|${s.width}|${s.height}`
        if (!byTypeMap.has(key)) byTypeMap.set(key, { name: `${s.name} ${s.width}×${s.height}`, count: 0, total: 0 })
        const t = byTypeMap.get(key)!
        t.count++
        t.total += s.sale_price
      }
      return {
        month,
        sales: monthSales,
        total: monthSales.reduce((sum, s) => sum + s.sale_price, 0),
        count: monthSales.length,
        byType: Array.from(byTypeMap.values()).sort((a, b) => b.total - a.total),
      }
    })
}

export default function Raporty() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [sales, setSales] = useState<Sale[]>([])
  const [selectedMonth, setSelectedMonth] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<'overview' | 'charts' | 'sales'>('overview')
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const [statsData, salesData] = await Promise.all([
      window.api.getStats(),
      window.api.getSales(),
    ])
    setStats(statsData)
    setSales(salesData)
  }

  const months = useMemo(() => [...new Set(sales.map(s => s.sale_date.slice(0, 7)))].sort().reverse(), [sales])

  const filteredSales = useMemo(() => {
    if (selectedMonth === 'all') return sales
    return sales.filter(s => s.sale_date.startsWith(selectedMonth))
  }, [sales, selectedMonth])

  const monthGroups = useMemo(() => groupByMonth(filteredSales), [filteredSales])

  const summaryTotal = filteredSales.reduce((s, sale) => s + sale.sale_price, 0)
  const summaryCount = filteredSales.length
  const avgPrice = summaryCount > 0 ? Math.round(summaryTotal / summaryCount) : 0

  const salesByTypePie = useMemo(() => {
    const map = new Map<string, { label: string; value: number }>()
    for (const s of filteredSales) {
      const key = s.name
      const existing = map.get(key) || { label: key, value: 0 }
      existing.value += s.sale_price
      map.set(key, existing)
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value)
  }, [filteredSales])

  const salesBySupplierPie = useMemo(() => {
    const map = new Map<string, { label: string; value: number }>()
    for (const s of filteredSales) {
      const key = s.supplier || 'Brak dostawcy'
      const existing = map.get(key) || { label: key, value: 0 }
      existing.value += s.sale_price
      map.set(key, existing)
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value)
  }, [filteredSales])

  const salesBySizePie = useMemo(() => {
    const map = new Map<string, { label: string; value: number }>()
    for (const s of filteredSales) {
      const key = `${s.width}×${s.height} cm`
      const existing = map.get(key) || { label: key, value: 0 }
      existing.value += 1
      map.set(key, existing)
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value)
  }, [filteredSales])

  const topSellersData = useMemo(() => {
    const map = new Map<string, { label: string; value: number }>()
    for (const s of filteredSales) {
      const key = `${s.name} ${s.width}×${s.height}`
      const existing = map.get(key) || { label: key, value: 0 }
      existing.value += 1
      map.set(key, existing)
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value).slice(0, 10)
  }, [filteredSales])

  const monthlyBarData = useMemo(() => {
    return [...monthGroups].reverse().map(mg => ({
      label: new Date(mg.month + '-01').toLocaleDateString('pl-PL', { month: 'short', year: '2-digit' }),
      value: mg.total,
      sub: `${mg.count} szt.`,
    }))
  }, [monthGroups])

  const exportPDF = async () => {
    const doc = new jsPDF()
    const hasFont = loadFont(doc)
    const fn = hasFont ? 'Arial' : 'helvetica'
    doc.setFont(fn, 'bold')
    doc.setFontSize(20)
    doc.text('Raport sprzedazy', 14, 22)

    doc.setFont(fn, 'normal')
    doc.setFontSize(10)
    doc.text(`Wygenerowano: ${new Date().toLocaleDateString('pl-PL')}`, 14, 30)
    if (selectedMonth !== 'all') {
      doc.text(`Okres: ${selectedMonth}`, 14, 36)
    }

    doc.text(`Laczna sprzedaz: ${summaryTotal.toLocaleString('pl-PL')} zl`, 14, 44)
    doc.text(`Liczba transakcji: ${summaryCount}`, 14, 50)

    const tableData = filteredSales.map((s) => [
      new Date(s.sale_date).toLocaleDateString('pl-PL'),
      s.name,
      `${s.width}x${s.height}`,
      `${s.sale_price.toLocaleString('pl-PL')} zl`,
      s.customer_name || '-',
    ])

    ;(doc as any).autoTable({
      startY: 58,
      head: [['Data', 'Ramka', 'Wymiary', 'Cena', 'Klient']],
      body: tableData,
      styles: { fontSize: 8, font: 'Arial' },
      headStyles: { fillColor: [76, 110, 245] },
    })

    doc.save(`raport-sprzedazy-${selectedMonth !== 'all' ? selectedMonth + '-' : ''}${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Ladowanie...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Statystyki i raporty</h1>
          <p className="text-slate-500 mt-1">Analyze sprzedazy i trendow</p>
        </div>
        <button
          onClick={exportPDF}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors text-sm"
        >
          <Download className="w-4 h-4" />
          Eksportuj PDF
        </button>
      </div>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {[
          { key: 'overview', label: 'Przeglad' },
          { key: 'charts', label: 'Wykresy' },
          { key: 'sales', label: 'Historia sprzedazy' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-4">
          <Calendar className="w-5 h-5 text-slate-400" />
          <span className="text-sm font-medium text-slate-600">Miesiac:</span>
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">Wszystkie miesiace</option>
              {months.map(m => (
                <option key={m} value={m}>
                  {new Date(m + '-01').toLocaleDateString('pl-PL', { year: 'numeric', month: 'long' })}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
          <span className="text-sm text-slate-400">
            {summaryCount} transakcji · {summaryTotal.toLocaleString('pl-PL')} zl
          </span>
        </div>
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <p className="text-sm font-medium text-slate-600">Przychod</p>
              </div>
              <p className="text-3xl font-bold text-slate-800">{summaryTotal.toLocaleString('pl-PL')} zl</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <p className="text-sm font-medium text-slate-600">Sprzedanych szt.</p>
              </div>
              <p className="text-3xl font-bold text-slate-800">{summaryCount}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <p className="text-sm font-medium text-slate-600">Srednia cena</p>
              </div>
              <p className="text-3xl font-bold text-slate-800">{avgPrice.toLocaleString('pl-PL')} zl</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <p className="text-sm font-medium text-slate-600">Rodzaje ramki</p>
              </div>
              <p className="text-3xl font-bold text-slate-800">{salesByTypePie.length}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Wedlug typu</h2>
              <PieChart data={salesByTypePie.map(d => ({ ...d, value: d.value }))} label="zl" />
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Wedlug dostawcy</h2>
              <PieChart data={salesBySupplierPie} label="zl" />
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Wedlug rozmiaru</h2>
              <PieChart data={salesBySizePie} label="szt." />
            </div>
          </div>

          {monthGroups.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Sprzedaz miesieczna</h2>
              <div className="space-y-2">
                {monthGroups.map((mg) => (
                  <button
                    key={mg.month}
                    onClick={() => setExpandedMonth(expandedMonth === mg.month ? null : mg.month)}
                    className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="w-24">
                      <p className="text-sm font-semibold text-slate-800">
                        {new Date(mg.month + '-01').toLocaleDateString('pl-PL', { year: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full rounded-full flex items-center justify-end pr-2"
                            style={{ width: `${Math.max((mg.total / Math.max(...monthGroups.map(m => m.total))) * 100, 10)}%` }}
                          >
                            <span className="text-xs font-semibold text-white">{mg.total.toLocaleString('pl-PL')} zl</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <span className="text-sm text-slate-500 w-20 text-right">{mg.count} szt.</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expandedMonth === mg.month ? 'rotate-180' : ''}`} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {expandedMonth && monthGroups.find(m => m.month === expandedMonth) && (
            <div className="bg-white rounded-2xl border border-primary-200 shadow-sm p-6 animate-fade-in">
              {(() => {
                const mg = monthGroups.find(m => m.month === expandedMonth)!
                return (
                  <>
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">
                      {new Date(mg.month + '-01').toLocaleDateString('pl-PL', { year: 'numeric', month: 'long' })}
                      <span className="text-sm font-normal text-slate-500 ml-2">
                        {mg.count} szt. · {mg.total.toLocaleString('pl-PL')} zl
                      </span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      {mg.byType.map((t) => (
                        <div key={t.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                          <div>
                            <p className="text-sm font-medium text-slate-800">{t.name}</p>
                            <p className="text-xs text-slate-500">{t.count} szt.</p>
                          </div>
                          <p className="text-sm font-bold text-emerald-600">{t.total.toLocaleString('pl-PL')} zl</p>
                        </div>
                      ))}
                    </div>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Data</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Ramka</th>
                          <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Klient</th>
                          <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">Cena</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {mg.sales.map((s) => (
                          <tr key={s.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2 text-sm text-slate-600">
                              {new Date(s.sale_date).toLocaleDateString('pl-PL')}
                            </td>
                            <td className="px-3 py-2 text-sm font-medium text-slate-800">
                              {s.name} {s.width}×{s.height}
                            </td>
                            <td className="px-3 py-2 text-sm text-slate-600">{s.customer_name || '—'}</td>
                            <td className="px-3 py-2 text-sm font-semibold text-emerald-600 text-right">
                              +{s.sale_price.toLocaleString('pl-PL')} zl
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )
              })()}
            </div>
          )}
        </>
      )}

      {activeTab === 'charts' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Przychod wedlug typu ramki</h2>
              <PieChart data={salesByTypePie} label="zl" />
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Przychod wedlug dostawcy</h2>
              <PieChart data={salesBySupplierPie} label="zl" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Ilosc sprzedanych wedlug rozmiaru</h2>
              <PieChart data={salesBySizePie} label="szt." />
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Najczesciej sprzedawane</h2>
              {topSellersData.length > 0 ? (
                <HorizontalBarChart data={topSellersData} valueLabel="szt." />
              ) : (
                <p className="text-slate-400 text-center py-8">Brak danych</p>
              )}
            </div>
          </div>

          {monthlyBarData.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Przychod miesieczny</h2>
              <VerticalBarChart data={monthlyBarData} />
            </div>
          )}
        </div>
      )}

      {activeTab === 'sales' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {filteredSales.length === 0 ? (
            <div className="p-12 text-center">
              <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Brak sprzedazy w wybranym okresie</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Data</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Ramka</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Wymiary</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Dostawca</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Klient</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Cena</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(sale.sale_date).toLocaleDateString('pl-PL')}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-800">{sale.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {sale.width} × {sale.height} cm
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{sale.supplier || '—'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{sale.customer_name || '—'}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-emerald-600 text-right">
                      +{sale.sale_price.toLocaleString('pl-PL')} zł
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
