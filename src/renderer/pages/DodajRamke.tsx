import { useState, useEffect, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Save, ArrowLeft, Printer } from 'lucide-react'
import JsBarcode from 'jsbarcode'

const SIZE_PRESETS = [
  { label: '10×15', width: 10, height: 15 },
  { label: '15×21', width: 15, height: 21 },
  { label: '21×30', width: 21, height: 30 },
  { label: '30×40', width: 30, height: 40 },
  { label: '40×50', width: 40, height: 50 },
  { label: '50×70', width: 50, height: 70 },
]

const SUPPLIER_PRESETS = [
  'Rama', 'Forte', 'OBI', 'IKEA', 'Castorama', 'Lidl', 'Inny',
]

const NAME_PRESETS = [
  'Ramka biała', 'Ramka czarna', 'Ramka srebrna', 'Ramka złota',
  'Ramka drewniana', 'Ramka plastikowa',
]

function generateTypeBarcode(name: string, width: number, height: number, price: number): string {
  const str = `${name}|${width}|${height}|${price}`
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  const num = Math.abs(hash).toString()
  return num.padStart(12, '0').slice(0, 12)
}

const BarcodePreview = memo(function BarcodePreview({ code }: { code: string }) {
  useEffect(() => {
    const canvas = document.getElementById('barcode-canvas') as HTMLCanvasElement
    if (canvas && code) {
      try {
        JsBarcode(canvas, code, {
          format: 'CODE128',
          width: 2,
          height: 60,
          displayValue: true,
          fontSize: 14,
          margin: 8,
        })
      } catch (e) {}
    }
  }, [code])

  return <canvas id="barcode-canvas" />
})

export default function DodajRamke() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [price, setPrice] = useState('')
  const [supplier, setSupplier] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [recentSuppliers, setRecentSuppliers] = useState<string[]>([])
  const [recentNames, setRecentNames] = useState<string[]>([])

  const barcode = generateTypeBarcode(name, parseFloat(width) || 0, parseFloat(height) || 0, parseFloat(price) || 0)

  useEffect(() => {
    loadRecent()
  }, [])

  const loadRecent = async () => {
    const data = await window.api.getAllFrames()
    const suppliers = [...new Set(data.map(f => f.supplier).filter(Boolean))]
    const names = [...new Set(data.map(f => f.name))]
    setRecentSuppliers(suppliers)
    setRecentNames(names)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const baseFrame = {
      name,
      width: parseFloat(width) || 0,
      height: parseFloat(height) || 0,
      color: '',
      price: parseFloat(price) || 0,
      cost: 0,
      supplier,
      location: '',
      status: 'available' as const,
      image_path: '',
      notes: '',
      barcode,
    }

    if (quantity > 1) {
      const frames = Array.from({ length: quantity }, () => ({ ...baseFrame }))
      const ids = await window.api.addFrames(frames)
      navigate('/etykiety', { state: { selectedIds: ids } })
    } else {
      const id = await window.api.addFrame(baseFrame)
      navigate('/etykiety', { state: { selectedIds: [id] } })
    }
  }

  const allNames = [...new Set([...NAME_PRESETS, ...recentNames])]
  const allSuppliers = [...new Set([...SUPPLIER_PRESETS, ...recentSuppliers])]

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Dodaj ramkę</h1>
          <p className="text-slate-500 mt-1">Wypełnij dane nowej ramki</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Dane ramki</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Nazwa ramki *</label>
                  <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
                    list="name-presets" placeholder="np. Ramka biała 30x40"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                  <datalist id="name-presets">
                    {allNames.map(n => <option key={n} value={n} />)}
                  </datalist>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Rozmiar</label>
                  <div className="flex flex-wrap gap-2">
                    {SIZE_PRESETS.map(p => (
                      <button key={p.label} type="button"
                        onClick={() => { setWidth(String(p.width)); setHeight(String(p.height)); }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                          width === String(p.width) && height === String(p.height)
                            ? 'bg-primary-100 border-primary-300 text-primary-700'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Szerokość (cm) *</label>
                  <input type="number" required step="0.1" value={width} onChange={(e) => setWidth(e.target.value)} placeholder="30"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Wysokość (cm) *</label>
                  <input type="number" required step="0.1" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="40"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Ilość sztuk</label>
                  <input type="number" min="1" max="999" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                  {quantity > 1 && (
                    <p className="text-xs text-primary-600 mt-1">
                      Zostanie wygenerowanych {quantity} unikalnych kodów
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Cena sprzedaży (zł) *</label>
                  <input type="number" required step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="149.99"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Dostawca</label>
                  <input type="text" value={supplier} onChange={(e) => setSupplier(e.target.value)}
                    list="supplier-presets" placeholder="Nazwa dostawcy"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                  <datalist id="supplier-presets">
                    {allSuppliers.map(s => <option key={s} value={s} />)}
                  </datalist>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {allSuppliers.slice(0, 5).map(s => (
                      <button key={s} type="button" onClick={() => setSupplier(s)}
                        className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
                          supplier === s
                            ? 'bg-primary-100 border-primary-300 text-primary-700'
                            : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Kod kreskowy</h2>
              <div className="text-center">
                <div className="bg-white rounded-xl p-4 mb-4 border border-slate-100">
                  <BarcodePreview code={barcode} />
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="font-mono text-lg font-bold text-slate-800">{barcode}</p>
                  <p className="text-xs text-slate-400 mt-1">Wygenerowany z danych ramki</p>
                </div>
              </div>
            </div>

            <button type="submit"
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl transition-colors shadow-sm">
              <Printer className="w-5 h-5" />
              Dodaj {quantity > 1 ? `${quantity} szt. ` : ''}i drukuj etykiety
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
