import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import './styles/globals.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './app/App'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Renderer root elementi topilmadi.')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
)
