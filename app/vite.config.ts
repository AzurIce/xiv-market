import { readFileSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
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

function getGitCommit() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
  } catch {
    return 'unknown'
  }
}

const version = getVersionInfo()
const gitCommit = getGitCommit()

export default defineConfig({
  base: process.env.BASE_URL || '/',
  plugins: [solid(), tailwindcss()],
  define: {
    __BUILD_COMMIT__: JSON.stringify(version.commit),
    __BUILD_DATE__: JSON.stringify(version.date),
    __GIT_COMMIT__: JSON.stringify(gitCommit),
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
