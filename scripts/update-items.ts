import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const CSV_URL = 'https://raw.githubusercontent.com/thewakingsands/ffxiv-datamining-cn/master/Item.csv'
const COMMITS_API_URL = 'https://api.github.com/repos/thewakingsands/ffxiv-datamining-cn/commits?path=Item.csv&per_page=1'
const ROOT = join(import.meta.dir, '..')
const APPS = ['frontend/lite-app', 'frontend/enhanced-app']

function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (line[i + 1] === '"') { cur += '"'; i++ }
      else { q = !q }
    } else if (c === ',' && !q) { fields.push(cur); cur = '' }
    else { cur += c }
  }
  fields.push(cur)
  return fields
}

function countQuotes(s: string): number {
  let n = 0
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '"') {
      if (s[i + 1] === '"') i++
      else n++
    }
  }
  return n
}

function splitCsv(csv: string): string[] {
  const raw = csv.split('\n')
  const lines: string[] = []
  let buf = ''
  for (const line of raw) {
    if (buf) buf += '\n'
    buf += line
    if (countQuotes(buf) % 2 === 0) {
      lines.push(buf)
      buf = ''
    }
  }
  if (buf.trim()) lines.push(buf)
  return lines
}

async function fetchCommit() {
  console.log('Fetching commit info...')
  const res = await fetch(COMMITS_API_URL, { headers: { 'Accept': 'application/vnd.github+json' } })
  if (!res.ok) throw new Error(`GitHub API ${res.status}`)
  const json: any = (await res.json())[0]
  if (!json) throw new Error('No commits')
  return { sha: json.sha.slice(0, 12), date: new Date(json.commit.committer.date).toLocaleString('zh-CN') }
}

async function main() {
  const tmp = join(ROOT, 'tmp_Item.csv')

  console.log('Downloading Item.csv...')
  let csv: string
  try {
    const res = await fetch(CSV_URL)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    csv = await res.text()
    writeFileSync(tmp, csv)
    console.log(`  ${(csv.length / 1024 / 1024).toFixed(1)} MB`)
  } catch (err: any) {
    console.error('Download failed:', err.message)
    if (existsSync(tmp)) { csv = readFileSync(tmp, 'utf-8'); console.log('  using cached copy') }
    else { process.exit(1) }
  }

  const lines = splitCsv(csv)
  const items: Record<number, { name: string; icon: number }> = {}
  for (let i = 3; i < lines.length; i++) {
    const f = parseCsvLine(lines[i].trim())
    if (!f[0]) continue
    const id = +f[0], name = f[10], icon = +f[11]
    if (id && name) items[id] = { name, icon: icon }
  }
  console.log(`Parsed ${Object.keys(items).length} items`)

  const json = JSON.stringify(items)
  console.log(`Output: ${(json.length / 1024).toFixed(0)} KB`)

  let commit = { sha: 'unknown', date: new Date().toLocaleString('zh-CN') }
  try { commit = await fetchCommit(); console.log(`  commit: ${commit.sha} (${commit.date})`) }
  catch (e: any) { console.warn('Commit info fetch failed:', e.message) }

  for (const app of APPS) {
    const out = join(ROOT, app, 'public')
    if (!existsSync(out)) mkdirSync(out, { recursive: true })
    writeFileSync(join(out, 'items.json'), json)
    writeFileSync(join(out, 'version.json'), JSON.stringify({ commit: commit.sha, date: commit.date }))
    console.log(`  → ${app}/public/`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
