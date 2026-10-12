import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// BUILD_ID versions the lazily fetched song files so a cached old bundle never meets new-format data (or the reverse)
export default defineConfig({ plugins: [react()], base: '/rhythm/', define: { __BUILD_ID__: JSON.stringify(Date.now().toString(36)) } })
