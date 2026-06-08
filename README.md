# Photo Studio Frame Inventory System

Desktop application for managing photo studio picture frames inventory, printing barcode labels, and tracking sales.

## Features

### Dashboard
- Overview of warehouse status (available vs sold frames)
- Top selling frames chart
- Recent sales list
- Monthly revenue bar chart

### Add Frame
- Batch adding frames (multiple units at once)
- Size presets (10×15, 15×21, 21×30, 30×40, 40×50, 50×70 cm)
- Name and supplier autocomplete from database
- Automatic barcode generation (deterministic hash per frame type)
- Live barcode preview

### Print Labels
- Canvas-based PDF labels rendered at 300 DPI
- Auto-detected label size based on frame dimensions
- Professional layout: name, size, price, barcode with numeric fallback
- Grouped by frame type with quantity controls (+/-)
- Descriptive PDF filenames (e.g. `Ramka_biala_15x21cm_35zl_5szt.pdf`)

### Warehouse (Inventory)
- Table view with sorting (name, size, supplier, price, quantity)
- Column filtering (name text, supplier dropdown)
- Bulk delete with confirmation
- Status filtering (available / sold / all)
- Real-time stock counts

### Barcode Scanner
- Scan frame label to remove from warehouse
- Type-based barcode system (any label of a type finds available frame)
- Visual feedback on successful checkout

### Statistics & Reports
- Monthly revenue with drill-down details
- Interactive pie charts (by frame type, supplier, size)
- Horizontal bar chart (top sellers)
- Vertical bar chart (monthly revenue trend)
- PDF export with Polish character support
- Month-based filtering

## Technologies

- **Electron** — desktop runtime
- **React 18** — UI framework
- **TypeScript** — type safety
- **Vite** — build tool
- **Tailwind CSS** — styling
- **SQLite** (better-sqlite3) — local database
- **JsBarcode** — barcode generation
- **jsPDF** + autoTable — PDF export
- **Lucide React** — icons
- **Canvas API** — label rendering at 300 DPI
- **Embedded Arial font** — Polish character support in PDFs

## Getting Started

```bash
npm install
npx vite build
```

Run with `Uruchom.bat` shortcut.

## Data

- Database: `%APPDATA%/pan-fotograf-ramki/ramki.db`
- Demo data auto-inserted on first run (14 frame types, ~50 sales)
- To reset: delete `ramki.db` and restart
