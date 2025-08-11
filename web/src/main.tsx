// All code comments must be English
import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './modules/App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)


