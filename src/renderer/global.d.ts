interface Window {
  api: {
    getAllFrames: (status?: string) => Promise<any[]>
    getFrameById: (id: number) => Promise<any>
    getFrameByBarcode: (barcode: string) => Promise<any>
    addFrame: (frame: any) => Promise<number>
    addFrames: (frames: any[]) => Promise<number[]>
    getFontBase64: () => Promise<string>
    updateFrame: (id: number, frame: any) => Promise<void>
    deleteFrame: (id: number) => Promise<void>
    deleteFrames: (ids: number[]) => Promise<any>
    sellFrame: (frameId: number, salePrice: number, customerName: string, notes: string) => Promise<boolean>
    getSales: (startDate?: string, endDate?: string) => Promise<any[]>
    getStats: () => Promise<any>
    searchFrames: (query: string) => Promise<any[]>
  }
}
