import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './ui/layout/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
