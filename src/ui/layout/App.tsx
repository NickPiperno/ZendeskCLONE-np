import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { MainLayout } from './MainLayout'
import { WelcomePage } from '../../modules/home/pages/WelcomePage'
import { DashboardPage } from '../../modules/dashboard/pages/DashboardPage'
import { TicketsPage } from '../../modules/tickets/pages/TicketsPage'
import { SettingsPage } from '../../modules/settings/pages/SettingsPage'

function App() {
  return (
    <BrowserRouter>
      <MainLayout>
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/tickets" element={<TicketsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  )
}

export default App 