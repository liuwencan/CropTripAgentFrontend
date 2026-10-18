import { readdir, readFile } from 'node:fs/promises'
import { join, extname } from 'node:path'

const root = new URL('../src/', import.meta.url)
const rules = {
  views: [/from ['"]@\/views\//, /from ['"]@\/layouts\//],
  components: [/from ['"]@\/views\//, /from ['"]@\/layouts\//, /from ['"]@\/store\//, /from ['"]@\/api\//],
  api: [/from ['"]@\/views\//, /from ['"]@\/components\//, /from ['"]@\/store\//],
  store: [/from ['"]@\/views\//, /from ['"]@\/components\//],
}

async function walk(url) {
  const entries = await readdir(url, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const child = new URL(entry.name + (entry.isDirectory() ? '/' : ''), url)
    if (entry.isDirectory()) files.push(...await walk(child))
    else if (['.ts', '.vue'].includes(extname(entry.name))) files.push(child)
  }
  return files
}

const errors = []
for (const file of await walk(root)) {
  const relative = file.pathname.replace(root.pathname, '').split('/')[0]
  const content = await readFile(file, 'utf8')
  for (const pattern of rules[relative] ?? []) if (pattern.test(content)) errors.push(`${relative}: ${file.pathname}`)
}
if (errors.length) { console.error('Boundary violations:\n' + errors.join('\n')); process.exit(1) }
console.log('Boundary check passed')
