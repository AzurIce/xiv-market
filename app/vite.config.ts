import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'

function getGitCommit() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
  } catch {
    return 'unknown'
  }
}

const itemsSource = JSON.parse(readFileSync(new URL('./.generated/items-source.json', import.meta.url), 'utf-8'))
const gitCommit = getGitCommit()
const base = (process.env.BASE_URL || '/').replace(/\/?$/, '/')

export default defineConfig({
  base,
  plugins: [solid(), tailwindcss()],
  build: {
    rolldownOptions: {
      input: {
        app: fileURLToPath(new URL('./index.html', import.meta.url)),
        render: fileURLToPath(new URL('./render.html', import.meta.url)),
      },
    },
  },
  define: {
    __BUILD_COMMIT__: JSON.stringify(itemsSource.commit),
    __BUILD_DATE__: JSON.stringify(itemsSource.date),
    __ITEMS_SOURCES__: JSON.stringify([
      { id: 'tos', label: 'TOS', url: itemsSource.url },
      { id: 'github-pages', label: 'GitHub Pages', url: `${base}items/${itemsSource.sha256}.json` },
    ]),
    __ITEMS_SHA256__: JSON.stringify(itemsSource.sha256),
    __ITEMS_SIZE__: JSON.stringify(itemsSource.size),
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
