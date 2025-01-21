import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './ui/layout/App'
import './index.css'
import { AuthProvider } from './lib/auth/AuthContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
