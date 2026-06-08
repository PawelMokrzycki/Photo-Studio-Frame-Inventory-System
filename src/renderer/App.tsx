import { HashRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Magazyn from './pages/Magazyn'
import DodajRamke from './pages/DodajRamke'
import EdytujRamke from './pages/EdytujRamke'
import SkanerQR from './pages/SkanerQR'
import DrukujEtykiety from './pages/DrukujEtykiety'
import Raporty from './pages/Raporty'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="magazyn" element={<Magazyn />} />
          <Route path="dodaj" element={<DodajRamke />} />
          <Route path="edytuj/:id" element={<EdytujRamke />} />
          <Route path="skaner" element={<SkanerQR />} />
          <Route path="etykiety" element={<DrukujEtykiety />} />
          <Route path="raporty" element={<Raporty />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
