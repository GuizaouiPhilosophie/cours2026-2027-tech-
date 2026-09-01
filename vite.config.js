import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Project page GitHub Pages : le site sera servi sous
  // https://guizaouiphilosophie.github.io/cours2026-2027-tech-/
  // base doit correspondre EXACTEMENT au nom du repo (avec le tiret final).
  base: '/cours2026-2027-tech-/',
})