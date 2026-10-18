import { access, readFile } from 'node:fs/promises'
import { readdir } from 'node:fs/promises'

await access('dist/index.html')
await access('dist/runtime-config.js')
const index = await readFile('dist/index.html', 'utf8')
const config = await readFile('dist/runtime-config.js', 'utf8')
if (!index.includes('/runtime-config.js')) throw new Error('runtime config is not loaded by the built page')
if (/password|secret|private[_-]?key/i.test(config)) throw new Error('runtime config contains a sensitive key')
const assets = await readdir('dist/assets')
const jsFiles = assets.filter((file) => file.endsWith('.js'))
const sizes = await Promise.all(jsFiles.map(async (file) => (await import('node:fs/promises')).stat(`dist/assets/${file}`)))
const largest = Math.max(...sizes.map((file) => file.size), 0)
if (largest > 1_500_000) throw new Error(`largest JavaScript asset is too large: ${largest} bytes`)
console.log('Delivery checks passed')
