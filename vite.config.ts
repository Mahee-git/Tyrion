import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative asset paths allow the same build to run at a GitHub Pages project URL.
export default defineConfig({ base: './', plugins: [react()] })
