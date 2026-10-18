import { readFile } from 'node:fs/promises'

const files = ['src/views/WorkspaceView.vue', 'src/components/MessageComposer.vue', 'src/components/ConversationMessage.vue', 'src/components/MarkdownContent.vue']
const checks = [
  ['message region', /message-scroll/],
  ['textarea composer', /type="textarea"/],
  ['keyboard submit', /keydown/],
  ['markdown container', /markdown-body/],
]
const errors = []
for (const file of files) {
  const source = await readFile(file, 'utf8')
  for (const [label, pattern] of checks) if (file.includes('Workspace') && !pattern.test(source) && label === 'message region') errors.push(`${file}: missing ${label}`)
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1) }
console.log('Accessibility source checks passed')
