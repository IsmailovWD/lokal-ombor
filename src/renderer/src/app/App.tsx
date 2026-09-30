import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { HashRouter, Route, Routes } from 'react-router-dom'

import { DashboardPage } from '../pages/DashboardPage'
import { ProductsPage } from '../pages/products/ProductsPage'
import { StockInPage } from '../pages/stock-in/StockInPage'
import { StockOutPage } from '../pages/stock-out/StockOutPage'
import { HistoryPage } from '../pages/history/HistoryPage'
import { SettingsPage } from '../pages/settings/SettingsPage'
import { UnitsPage } from '../pages/units/UnitsPage'
import { ApplicationShell } from './AppShell'
import { theme } from './theme'

export function App() {
  return (
    <MantineProvider defaultColorScheme="light" forceColorScheme="light" theme={theme}>
      <Notifications position="top-right" />
      <HashRouter>
        <Routes>
          <Route element={<ApplicationShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="units" element={<UnitsPage />} />
            <Route path="stock-in" element={<StockInPage />} />
            <Route path="stock-out" element={<StockOutPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </MantineProvider>
  )
}
