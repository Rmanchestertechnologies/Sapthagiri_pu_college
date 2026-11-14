import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { installToastAlerts } from './utils/toast'
import { installErrorReporting } from './maintenance/reportErrors'

// alert(...) calls show a non-blocking message instead of a browser dialog
installToastAlerts()
installErrorReporting()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
