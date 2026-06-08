export interface Frame {
  id: number
  name: string
  width: number
  height: number
  color: string
  price: number
  cost: number
  supplier: string
  location: string
  status: 'available' | 'sold'
  image_path: string
  notes: string
  barcode: string
  date_added: string
}

export interface Sale {
  id: number
  frame_id: number
  sale_date: string
  sale_price: number
  customer_name: string
  notes: string
  name: string
  width: number
  height: number
  color: string
  supplier: string
}

export interface Stats {
  totalFrames: number
  availableFrames: number
  soldFrames: number
  totalSales: number
  totalCost: number
  recentSales: (Sale & { name: string })[]
  salesByMonth: { month: string; count: number; total: number }[]
  salesByType: { name: string; count: number; total: number }[]
  salesBySupplier: { supplier: string; count: number; total: number }[]
  topSellers: { name: string; width: number; height: number; count: number }[]
}

export interface Window {
  api: {
    getAllFrames: (status?: string) => Promise<Frame[]>
    getFrameById: (id: number) => Promise<Frame>
    getFrameByBarcode: (barcode: string) => Promise<Frame | undefined>
    addFrame: (frame: Omit<Frame, 'id' | 'date_added'>) => Promise<number>
    addFrames: (frames: Omit<Frame, 'id' | 'date_added'>[]) => Promise<number[]>
    updateFrame: (id: number, frame: Partial<Frame>) => Promise<void>
    deleteFrame: (id: number) => Promise<void>
    sellFrame: (frameId: number, salePrice: number, customerName: string, notes: string) => Promise<boolean>
    getSales: (startDate?: string, endDate?: string) => Promise<Sale[]>
    getStats: () => Promise<Stats>
    searchFrames: (query: string) => Promise<Frame[]>
  }
}
