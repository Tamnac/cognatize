// Builds src/library.generated.json from the compiler sources: builtins.c gives names and
// argument types, prelude.cog gives the documented prelude functions.
import { readFileSync, writeFileSync } from 'node:fs'
import { analyze } from '../src/analysis.ts'
import type { LibraryEntry } from '../src/library.ts'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
const typeName = (type: string) => (type === 'io' ? 'IO' : capitalise(type))

function builtinEntries(source: string): LibraryEntry[] {
  return source
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('//'))
    .flatMap((line) => {
      const name = /^\{\.name="([^"]+)"/.exec(line)?.[1]
      if (!name) return []
      const argc = Number(/\.argc=(\d+)/.exec(line)?.[1] ?? 0)
      const args = (/\.args=\{([^}]*)\}/.exec(line)?.[1] ?? '')
        .split(',')
        .map((arg) => arg.trim())
        .filter(Boolean)
        .slice(0, argc)
      const returns = line.includes('.returns=true') ? /\.rettype=(\w+)/.exec(line)?.[1] : undefined
      const label = capitalise(name)
      const signature = [label, ...args.map(typeName)].join(' ') + (returns ? ` → ${typeName(returns)}` : '')
      return [{ name, label, signature }]
    })
}

function preludeEntries(source: string): LibraryEntry[] {
  return analyze(source)
    .declarations.filter((declaration) => declaration.topLevel && declaration.kind === 'function')
    .map(({ name, label, doc }) => ({ name, label, doc }))
}

const entries = new Map<string, LibraryEntry>()
for (const entry of [...builtinEntries(read('../../../src/builtins.c')), ...preludeEntries(read('../../../src/prelude.cog'))])
  entries.set(entry.name, { ...entries.get(entry.name), ...entry })

writeFileSync(new URL('../src/library.generated.json', import.meta.url), JSON.stringify([...entries.values()], null, 1) + '\n')
console.log(`Wrote ${entries.size} library entries`)
