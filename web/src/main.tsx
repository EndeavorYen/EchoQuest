import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Game from './game/Game'

const root = document.getElementById('root')

if (root) {
  createRoot(root).render(
    <StrictMode>
      <Game />
    </StrictMode>,
  )
} else {
  console.error('Root element not found')
}
