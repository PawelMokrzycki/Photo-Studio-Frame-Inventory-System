import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import Database from 'better-sqlite3'

let mainWindow: BrowserWindow | null = null
let db: Database.Database

function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'ramki.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS frames (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      width REAL NOT NULL,
      height REAL NOT NULL,
      color TEXT NOT NULL DEFAULT '',
      price REAL NOT NULL DEFAULT 0,
      cost REAL NOT NULL DEFAULT 0,
      supplier TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'sold')),
      image_path TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      barcode TEXT NOT NULL,
      date_added DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      frame_id INTEGER NOT NULL,
      sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      sale_price REAL NOT NULL,
      customer_name TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      FOREIGN KEY (frame_id) REFERENCES frames(id)
    );

    CREATE INDEX IF NOT EXISTS idx_frames_status ON frames(status);
    CREATE INDEX IF NOT EXISTS idx_frames_barcode ON frames(barcode);
    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
    CREATE INDEX IF NOT EXISTS idx_sales_frame ON sales(frame_id);
  `)

  const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='frames'").get() as any
  if (tableInfo && tableInfo.sql.includes('UNIQUE')) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS frames_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        width REAL NOT NULL,
        height REAL NOT NULL,
        color TEXT NOT NULL DEFAULT '',
        price REAL NOT NULL DEFAULT 0,
        cost REAL NOT NULL DEFAULT 0,
        supplier TEXT NOT NULL DEFAULT '',
        location TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'sold')),
        image_path TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        barcode TEXT NOT NULL,
        date_added DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO frames_new SELECT * FROM frames;
      DROP TABLE frames;
      ALTER TABLE frames_new RENAME TO frames;
      CREATE INDEX IF NOT EXISTS idx_frames_status ON frames(status);
      CREATE INDEX IF NOT EXISTS idx_frames_barcode ON frames(barcode);
      CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
      CREATE INDEX IF NOT EXISTS idx_sales_frame ON sales(frame_id);
    `)
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'Pan Fotograf - Ramki',
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
    show: false,
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// IPC Handlers
ipcMain.handle('db:getAllFrames', (_, status?: string) => {
  if (status) {
    return db.prepare('SELECT * FROM frames WHERE status = ? ORDER BY date_added DESC').all(status)
  }
  return db.prepare('SELECT * FROM frames ORDER BY date_added DESC').all()
})

ipcMain.handle('db:getFrameById', (_, id: number) => {
  return db.prepare('SELECT * FROM frames WHERE id = ?').get(id)
})

ipcMain.handle('db:getFrameByBarcode', (_, barcode: string) => {
  return db.prepare("SELECT * FROM frames WHERE barcode = ? AND status = 'available' ORDER BY id LIMIT 1").get(barcode)
})

ipcMain.handle('db:addFrame', (_, frame) => {
  const stmt = db.prepare(`
    INSERT INTO frames (name, width, height, color, price, cost, supplier, location, status, image_path, notes, barcode)
    VALUES (@name, @width, @height, @color, @price, @cost, @supplier, @location, @status, @image_path, @notes, @barcode)
  `)
  const result = stmt.run(frame)
  return result.lastInsertRowid
})

ipcMain.handle('db:addFrames', (_, frames: any[]) => {
  const stmt = db.prepare(`
    INSERT INTO frames (name, width, height, color, price, cost, supplier, location, status, image_path, notes, barcode)
    VALUES (@name, @width, @height, @color, @price, @cost, @supplier, @location, @status, @image_path, @notes, @barcode)
  `)
  const insertMany = db.transaction((items: any[]) => {
    const ids: number[] = []
    for (const frame of items) {
      const result = stmt.run(frame)
      ids.push(Number(result.lastInsertRowid))
    }
    return ids
  })
  return insertMany(frames)
})

ipcMain.handle('db:updateFrame', (_, id: number, frame) => {
  const stmt = db.prepare(`
    UPDATE frames SET
      name = @name, width = @width, height = @height, color = @color,
      price = @price, cost = @cost, supplier = @supplier, location = @location,
      status = @status, image_path = @image_path, notes = @notes
    WHERE id = @id
  `)
  return stmt.run({ ...frame, id })
})

ipcMain.handle('db:deleteFrame', (_, id: number) => {
  return db.prepare('DELETE FROM frames WHERE id = ?').run(id)
})

ipcMain.handle('db:deleteFrames', (_, ids: number[]) => {
  if (ids.length === 0) return { changes: 0 }
  const placeholders = ids.map(() => '?').join(',')
  return db.prepare(`DELETE FROM frames WHERE id IN (${placeholders})`).run(...ids)
})

ipcMain.handle('db:sellFrame', (_, frameId: number, salePrice: number, customerName: string, notes: string) => {
  const transaction = db.transaction(() => {
    db.prepare('UPDATE frames SET status = ? WHERE id = ?').run('sold', frameId)
    db.prepare('INSERT INTO sales (frame_id, sale_price, customer_name, notes) VALUES (?, ?, ?, ?)').run(frameId, salePrice, customerName, notes)
  })
  transaction()
  return true
})

ipcMain.handle('db:getSales', (_, startDate?: string, endDate?: string) => {
  if (startDate && endDate) {
    return db.prepare(`
      SELECT s.*, f.name, f.width, f.height, f.color, f.supplier
      FROM sales s JOIN frames f ON s.frame_id = f.id
      WHERE s.sale_date BETWEEN ? AND ?
      ORDER BY s.sale_date DESC
    `).all(startDate, endDate)
  }
  return db.prepare(`
    SELECT s.*, f.name, f.width, f.height, f.color, f.supplier
    FROM sales s JOIN frames f ON s.frame_id = f.id
    ORDER BY s.sale_date DESC
  `).all()
})

ipcMain.handle('db:getStats', () => {
  const totalFrames = db.prepare('SELECT COUNT(*) as count FROM frames').get() as any
  const availableFrames = db.prepare("SELECT COUNT(*) as count FROM frames WHERE status = 'available'").get() as any
  const soldFrames = db.prepare("SELECT COUNT(*) as count FROM frames WHERE status = 'sold'").get() as any
  const totalSales = db.prepare('SELECT COALESCE(SUM(sale_price), 0) as total FROM sales').get() as any
  const totalCost = db.prepare('SELECT COALESCE(SUM(cost), 0) as total FROM frames WHERE status = \'sold\'').get() as any
  const recentSales = db.prepare(`
    SELECT s.*, f.name, f.width, f.height, f.supplier FROM sales s
    JOIN frames f ON s.frame_id = f.id
    ORDER BY s.sale_date DESC LIMIT 5
  `).all()
  const salesByMonth = db.prepare(`
    SELECT strftime('%Y-%m', sale_date) as month, COUNT(*) as count, SUM(sale_price) as total
    FROM sales GROUP BY month ORDER BY month DESC LIMIT 12
  `).all()
  const salesByType = db.prepare(`
    SELECT f.name, COUNT(*) as count, SUM(s.sale_price) as total
    FROM sales s JOIN frames f ON s.frame_id = f.id
    GROUP BY f.name ORDER BY total DESC
  `).all()
  const salesBySupplier = db.prepare(`
    SELECT f.supplier, COUNT(*) as count, SUM(s.sale_price) as total
    FROM sales s JOIN frames f ON s.frame_id = f.id
    WHERE f.supplier != ''
    GROUP BY f.supplier ORDER BY total DESC
  `).all()
  const topSellers = db.prepare(`
    SELECT f.name, f.width, f.height, COUNT(*) as count
    FROM sales s JOIN frames f ON s.frame_id = f.id
    GROUP BY f.name, f.width, f.height ORDER BY count DESC LIMIT 5
  `).all()

  return {
    totalFrames: totalFrames.count,
    availableFrames: availableFrames.count,
    soldFrames: soldFrames.count,
    totalSales: totalSales.total,
    totalCost: totalCost.total,
    recentSales,
    salesByMonth,
    salesByType,
    salesBySupplier,
    topSellers,
  }
})

ipcMain.handle('db:searchFrames', (_, query: string) => {
  return db.prepare(`
    SELECT * FROM frames
    WHERE name LIKE ? OR color LIKE ? OR supplier LIKE ? OR location LIKE ? OR barcode LIKE ?
    ORDER BY date_added DESC
  `).all(...Array(5).fill(`%${query}%`))
})

ipcMain.handle('app:getFontBase64', () => {
  const fontPath = path.join(app.getAppPath(), 'public', 'arial.ttf')
  const fontBuffer = fs.readFileSync(fontPath)
  return fontBuffer.toString('base64')
})

function insertDemoDataIfEmpty() {
  const salesCount = db.prepare('SELECT COUNT(*) as c FROM sales').get() as any
  if (salesCount.c > 0) return

  function typeBarcode(name: string, w: number, h: number, price: number): string {
    const str = `${name}|${w}|${h}|${price}`
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i)
      hash |= 0
    }
    return Math.abs(hash).toString().padStart(12, '0').slice(0, 12)
  }

  const types = [
    { name: 'Ramka biała', w: 10, h: 15, price: 25, supplier: 'Kwiatek', count: 12 },
    { name: 'Ramka biała', w: 15, h: 21, price: 35, supplier: 'Kwiatek', count: 8 },
    { name: 'Ramka biała', w: 30, h: 40, price: 79, supplier: 'Castorama', count: 5 },
    { name: 'Ramka czarna', w: 15, h: 21, price: 38, supplier: 'Rama', count: 14 },
    { name: 'Ramka czarna', w: 30, h: 40, price: 89, supplier: 'Rama', count: 6 },
    { name: 'Ramka czarna', w: 40, h: 50, price: 149, supplier: 'Kwiatek', count: 3 },
    { name: 'Ramka srebrna', w: 21, h: 30, price: 55, supplier: 'Forte', count: 9 },
    { name: 'Ramka srebrna', w: 15, h: 21, price: 42, supplier: 'Forte', count: 5 },
    { name: 'Ramka złota', w: 15, h: 21, price: 45, supplier: 'Forte', count: 4 },
    { name: 'Ramka złota', w: 30, h: 40, price: 95, supplier: 'Forte', count: 3 },
    { name: 'Ramka drewniana', w: 30, h: 40, price: 120, supplier: 'IKEA', count: 5 },
    { name: 'Ramka drewniana', w: 50, h: 70, price: 189, supplier: 'IKEA', count: 2 },
    { name: 'Ramka plastikowa', w: 10, h: 15, price: 15, supplier: 'OBI', count: 15 },
    { name: 'Ramka plastikowa', w: 15, h: 21, price: 22, supplier: 'OBI', count: 10 },
  ]

  const salesPerType = [
    { name: 'Ramka biała', w: 10, h: 15, sales: 5 },
    { name: 'Ramka biała', w: 15, h: 21, sales: 4 },
    { name: 'Ramka biała', w: 30, h: 40, sales: 2 },
    { name: 'Ramka czarna', w: 15, h: 21, sales: 8 },
    { name: 'Ramka czarna', w: 30, h: 40, sales: 3 },
    { name: 'Ramka czarna', w: 40, h: 50, sales: 1 },
    { name: 'Ramka srebrna', w: 21, h: 30, sales: 5 },
    { name: 'Ramka srebrna', w: 15, h: 21, sales: 3 },
    { name: 'Ramka złota', w: 15, h: 21, sales: 2 },
    { name: 'Ramka złota', w: 30, h: 40, sales: 1 },
    { name: 'Ramka drewniana', w: 30, h: 40, sales: 2 },
    { name: 'Ramka drewniana', w: 50, h: 70, sales: 1 },
    { name: 'Ramka plastikowa', w: 10, h: 15, sales: 8 },
    { name: 'Ramka plastikowa', w: 15, h: 21, sales: 5 },
  ]

  const saleDates = [
    '2026-02-05', '2026-02-12', '2026-02-18', '2026-02-22', '2026-02-27',
    '2026-03-03', '2026-03-08', '2026-03-12', '2026-03-15', '2026-03-19',
    '2026-03-24', '2026-03-28', '2026-03-31',
    '2026-04-02', '2026-04-06', '2026-04-10', '2026-04-14', '2026-04-18',
    '2026-04-22', '2026-04-27', '2026-04-30',
    '2026-05-04', '2026-05-09', '2026-05-14', '2026-05-18', '2026-05-23',
    '2026-05-28', '2026-05-31',
    '2026-06-02', '2026-06-05', '2026-06-08',
  ]

  const insertFrame = db.prepare(`
    INSERT INTO frames (name, width, height, color, price, cost, supplier, location, status, image_path, notes, barcode, date_added)
    VALUES (?, ?, ?, '', ?, 0, ?, '', ?, '', '', ?, ?)
  `)
  const insertSale = db.prepare(`
    INSERT INTO sales (frame_id, sale_price, sale_date, customer_name, notes)
    VALUES (?, ?, ?, ?, '')
  `)

  const transaction = db.transaction(() => {
    const allFrameIds: Record<string, number[]> = {}

    for (const t of types) {
      const barcode = typeBarcode(t.name, t.w, t.h, t.price)
      const key = `${t.name}|${t.w}|${t.h}`
      allFrameIds[key] = []
      for (let i = 0; i < t.count; i++) {
        const daysAgo = 90 - Math.floor(Math.random() * 30)
        const dateAdded = new Date(Date.now() - daysAgo * 86400000).toISOString()
        const result = insertFrame.run(t.name, t.w, t.h, t.price, t.supplier, 'available', barcode, dateAdded)
        allFrameIds[key].push(Number(result.lastInsertRowid))
      }
    }

    let saleDateIdx = 0
    for (const st of salesPerType) {
      const key = `${st.name}|${st.w}|${st.h}`
      const ids = allFrameIds[key]
      if (!ids) continue
      const price = types.find(t => t.name === st.name && t.w === st.w && t.h === st.h)?.price || 0
      for (let i = 0; i < Math.min(st.sales, ids.length); i++) {
        const saleDate = saleDates[saleDateIdx % saleDates.length] + 'T12:00:00.000Z'
        saleDateIdx++
        insertSale.run(ids[i], price, saleDate, '')
        db.prepare("UPDATE frames SET status = 'sold' WHERE id = ?").run(ids[i])
      }
    }
  })

  transaction()
}

app.whenReady().then(() => {
  initDatabase()
  insertDemoDataIfEmpty()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (db) db.close()
  if (process.platform !== 'darwin') app.quit()
})
