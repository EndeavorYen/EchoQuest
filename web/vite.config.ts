import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Adjust base when deploying to GitHub Pages at /<repo>/
const base = process.env.GITHUB_REPOSITORY ? `/${process.env.GITHUB_REPOSITORY.split('/').pop()}/` : '/'

export default defineConfig({
  plugins: [react()],
  base,
})


