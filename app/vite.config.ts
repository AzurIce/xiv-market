import { readFileSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'

function getVersionInfo() {
  try {
    const __dirname = fileURLToPath(new URL('.', import.meta.url))
    const path = resolve(__dirname, 'public', 'version.json')
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return { commit: 'unknown', date: '' }
  }
}
const version = getVersionInfo()

export default defineConfig({
  base: process.env.BASE_URL || '/',
  plugins: [solid(), tailwindcss()],
  define: {
    __BUILD_COMMIT__: JSON.stringify(version.commit),
    __BUILD_DATE__: JSON.stringify(version.date),
  },
  server: {
    proxy: {
      '/api/universalis': {
        target: 'https://universalis.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/universalis/, ''),
      },
    },
  },
})
