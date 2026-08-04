import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { LifeLogPage } from './pages/LifeLogPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LifeLogPage />
  </StrictMode>,
)
