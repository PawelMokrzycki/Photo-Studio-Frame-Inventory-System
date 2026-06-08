import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  getAllFrames: (status?: string) => ipcRenderer.invoke('db:getAllFrames', status),
  getFrameById: (id: number) => ipcRenderer.invoke('db:getFrameById', id),
  getFrameByBarcode: (barcode: string) => ipcRenderer.invoke('db:getFrameByBarcode', barcode),
  addFrame: (frame: any) => ipcRenderer.invoke('db:addFrame', frame),
  addFrames: (frames: any[]) => ipcRenderer.invoke('db:addFrames', frames),
  updateFrame: (id: number, frame: any) => ipcRenderer.invoke('db:updateFrame', id, frame),
  deleteFrame: (id: number) => ipcRenderer.invoke('db:deleteFrame', id),
  deleteFrames: (ids: number[]) => ipcRenderer.invoke('db:deleteFrames', ids),
  sellFrame: (frameId: number, salePrice: number, customerName: string, notes: string) =>
    ipcRenderer.invoke('db:sellFrame', frameId, salePrice, customerName, notes),
  getSales: (startDate?: string, endDate?: string) => ipcRenderer.invoke('db:getSales', startDate, endDate),
  getStats: () => ipcRenderer.invoke('db:getStats'),
  searchFrames: (query: string) => ipcRenderer.invoke('db:searchFrames', query),
  getFontBase64: () => ipcRenderer.invoke('app:getFontBase64'),
})
