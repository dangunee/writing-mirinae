/**
 * Merge Vite `dist/` into `public/` so `next build` ships the SPA assets alongside Next API routes.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const dist = path.join(root, 'dist')
const publicDir = path.join(root, 'public')

function copyRecursive(src, dest) {
  const stat = fs.statSync(src)
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true })
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name))
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(src, dest)
  }
}

if (!fs.existsSync(dist)) {
  console.error('copy-dist-to-public: dist/ not found. Run vite build first.')
  process.exit(1)
}

for (const name of fs.readdirSync(dist)) {
  copyRecursive(path.join(dist, name), path.join(publicDir, name))
}

console.log('copy-dist-to-public: merged dist/ -> public/')
