import { readFile } from 'node:fs/promises'

const css = await readFile('src/assets/styles.css', 'utf8')
const workspace = await readFile('src/views/WorkspaceView.vue', 'utf8')
const required = [/@media \(max-width: 720px\)/, /overflow-x: auto/, /min-width: 320px/]
if (!required.every((pattern) => pattern.test(css + workspace))) throw new Error('responsive layout checks failed')
console.log('Responsive source checks passed')
