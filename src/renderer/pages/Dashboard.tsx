import { useState, useEffect } from 'react'
import {
  Package,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Frame,
} from 'lucide-react'
import type { Stats } from '../../shared/types'
import { PieChart, HorizontalBarChart } from '../components/Charts'

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    window.api.getStats().then(setStats)
  }, [])

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Ładowanie...</div>
      </div>
    )
  }

  const statCards = [
    {
      label: 'Wszystkie ramki',
      value: stats.totalFrames,
      icon: Package,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Dostępne',
      value: stats.availableFrames,
      icon: Frame,
      color: 'bg-emerald-500',
      bgColor: 'bg-emerald-50',
    },
    {
      label: 'Sprzedane',
      value: stats.soldFrames,
      icon: ShoppingCart,
      color: 'bg-amber-500',
      bgColor: 'bg-amber-50',
    },
    {
      label: 'Przychód',
      value: `${stats.totalSales.toLocaleString('pl-PL')} zł`,
      icon: DollarSign,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50',
    },
  ]

  const availSoldPie = [
    { label: 'Dostępne', value: stats.availableFrames },
    { label: 'Sprzedane', value: stats.soldFrames },
  ]

  const topSellersData = stats.topSellers.map(t => ({
    label: `${t.name} ${t.width}×${t.height}`,
    value: t.count,
    sub: 'szt.',
  }))

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Panel główny</h1>
        <p className="text-slate-500 mt-1">Przegląd stanu magazynu i sprzedaży</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => (
          <div
            key={card.label}
            className={`${card.bgColor} rounded-2xl p-6 border border-white shadow-sm`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">{card.label}</p>
                <p className="text-3xl font-bold text-slate-800 mt-2">{card.value}</p>
              </div>
              <div className={`${card.color} w-12 h-12 rounded-xl flex items-center justify-center`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Stan magazynu</h2>
          <PieChart data={availSoldPie} label="ramki" />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Najczęściej sprzedawane</h2>
          {topSellersData.length > 0 ? (
            <HorizontalBarChart data={topSellersData} valueLabel="szt." />
          ) : (
            <p className="text-slate-400 text-center py-8">Brak danych</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">Ostatnie sprzedaże</h2>
        </div>
        <div className="p-6">
          {stats.recentSales.length === 0 ? (
            <p className="text-slate-400 text-center py-8">Brak ostatnich sprzedaży</p>
          ) : (
            <div className="space-y-4">
              {stats.recentSales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-xl"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                      <ShoppingCart className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{sale.name}</p>
                      <p className="text-sm text-slate-500">
                        {sale.width} × {sale.height} cm
                        {sale.supplier && <span> · {sale.supplier}</span>}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(sale.sale_date).toLocaleDateString('pl-PL')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-emerald-600">
                      +{sale.sale_price.toLocaleString('pl-PL')} zł
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {stats.salesByMonth.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-slate-800">Sprzedaż miesięczna</h2>
          </div>
          <div className="p-6">
            <HorizontalBarChart
              data={[...stats.salesByMonth].reverse().map(m => ({
                label: m.month,
                value: m.total,
                sub: `${m.count} szt.`,
              }))}
              valueLabel="zł"
            />
          </div>
        </div>
      )}
    </div>
  )
}
