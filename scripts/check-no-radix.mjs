import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const config = JSON.parse(readFileSync(join(root, 'components.json'), 'utf8'))
const lock = readFileSync(join(root, 'bun.lock'), 'utf8')
const issues = []

if (!config.style.startsWith('base-')) {
  issues.push('components.json must use a Base UI shadcn style')
}

for (const name of Object.keys({
  ...pkg.dependencies,
  ...pkg.devDependencies,
})) {
  if (name === 'cmdk' || name === 'radix-ui' || name.startsWith('@radix-ui/')) {
    issues.push(`Direct dependency: ${name}`)
  }
}

if (
  lock.includes('@radix-ui/') ||
  lock.includes('"cmdk"') ||
  lock.includes('"radix-ui"')
) {
  issues.push('bun.lock contains a legacy UI package')
}

function scan(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      scan(path)
    } else if (/\.(tsx?|css)$/.test(entry.name)) {
      const source = readFileSync(path, 'utf8')
      if (
        /(?:@radix-ui\/|from ['"](?:radix-ui|cmdk)['"]|--radix-)/.test(source)
      ) {
        issues.push(`Legacy UI reference: ${path}`)
      }
    }
  }
}

scan(join(root, 'src'))

if (issues.length) {
  for (const issue of issues) process.stderr.write(`${issue}\n`)
  process.exitCode = 1
} else {
  process.stdout.write('No Radix or cmdk dependencies in the project.\n')
}
