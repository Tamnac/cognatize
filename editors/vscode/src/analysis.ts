import { lex, type Problem, type Token } from './lexer.ts'
import type { Library } from './library.ts'
import { itemEnd, parse, type Block } from './parser.ts'

export interface Range {
  start: number
  end: number
}

export type DeclarationKind = 'function' | 'variable'

export interface Declaration {
  name: string
  label: string
  keyword: string
  kind: DeclarationKind
  nameToken: Token
  topLevel: boolean
  doc?: string
}

export interface OutlineNode extends Range {
  name: string
  kind: DeclarationKind
  selection: Range
  children: OutlineNode[]
}

export interface Analysis {
  tokens: Token[]
  problems: Problem[]
  declarations: Declaration[]
  kinds: Map<string, DeclarationKind>
  outline: OutlineNode[]
  foldable: Range[]
}

function commentText(token: Token): string {
  const inner = token.text.slice(1, token.text.length > 1 && token.text.endsWith('~') ? -1 : undefined)
  const lines = inner.split('\n')
  const indents = lines.filter((line) => line.trim()).map((line) => /^\s*/.exec(line)![0].length)
  const indent = Math.min(...indents, Infinity)
  return lines.map((line) => line.slice(indent === Infinity ? 0 : indent)).join('\n').trim()
}

// A block comment directly before a Def documents it.
function collectDocs(tokens: Token[]): Map<Token, string> {
  const docs = new Map<Token, string>()
  tokens.forEach((token, i) => {
    if (token.kind === 'def' && tokens[i - 1]?.kind === 'blockComment') docs.set(token, commentText(tokens[i - 1]))
  })
  return docs
}

export function analyze(text: string): Analysis {
  const { tokens, problems } = lex(text)
  const { root, problems: parseProblems } = parse(tokens)
  const docs = collectDocs(tokens)
  const declarations: Declaration[] = []
  const foldable: Range[] = []
  const outline: OutlineNode[] = []

  for (const token of tokens) {
    if (token.kind === 'blockComment' && token.text.length > 1 && token.text.endsWith('~'))
      foldable.push({ start: token.start, end: token.end - 1 })
  }

  const walk = (block: Block, depth: number, scope: OutlineNode[]) => {
    if (block.open && block.close) foldable.push({ start: block.open.start, end: block.close.start })
    for (const { items } of block.statements) {
      let owner: OutlineNode | undefined
      items.forEach((item, index) => {
        if (item.kind !== 'def' && item.kind !== 'let') return
        // `Def F;` only names a value taken from the stack. A function has a body after it.
        const kind: DeclarationKind = item.kind === 'def' && index < items.length - 1 ? 'function' : 'variable'
        declarations.push({
          name: item.name.text.toLowerCase(),
          label: item.name.text,
          keyword: item.keyword.text,
          kind,
          nameToken: item.name,
          topLevel: depth === 0,
          doc: docs.get(item.keyword),
        })
        if (kind === 'variable' && depth > 0) return
        const node: OutlineNode = {
          name: item.name.text,
          kind,
          start: item.keyword.start,
          end: itemEnd(items[items.length - 1]),
          selection: { start: item.name.start, end: item.name.end },
          children: [],
        }
        scope.push(node)
        if (kind === 'function') owner ??= node
      })
      for (const item of items) if (item.kind === 'block') walk(item, depth + 1, owner ? owner.children : scope)
    }
  }
  walk(root, 0, outline)

  const kinds = new Map<string, DeclarationKind>()
  for (const { name, kind } of declarations) if (kind === 'function' || !kinds.has(name)) kinds.set(name, kind)

  return { tokens, problems: [...problems, ...parseProblems], declarations, kinds, outline, foldable }
}

function isInside(token: Token, offset: number): boolean {
  const closing = token.kind === 'string' ? '"' : '~'
  const closed = token.kind !== 'lineComment' && token.text.length > 1 && token.text.endsWith(closing)
  return token.start < offset && (closed ? offset < token.end : offset <= token.end)
}

export function tokenAt(analysis: Analysis, offset: number): Token | undefined {
  return analysis.tokens.find((token) => token.start <= offset && offset < token.end)
}

export function inStringOrComment(analysis: Analysis, offset: number): boolean {
  return analysis.tokens.some(
    (token) =>
      (token.kind === 'string' || token.kind === 'blockComment' || token.kind === 'lineComment') &&
      isInside(token, offset),
  )
}

export interface Description {
  header: string
  doc?: string
}

export function describe(name: string, analysis: Analysis, library: Library): Description | undefined {
  const local = analysis.declarations.filter((declaration) => declaration.name === name)
  const declared = local.find((declaration) => declaration.doc) ?? local[0]
  if (declared) return { header: `${declared.keyword} ${declared.label}`, doc: declared.doc }
  const entry = library.get(name)
  return entry && { header: entry.signature ?? entry.label, doc: entry.doc }
}

export const TOKEN_TYPES = ['namespace', 'function', 'variable'] as const
export const TOKEN_MODIFIERS = ['declaration', 'defaultLibrary'] as const
const DECLARATION = 1
const DEFAULT_LIBRARY = 2

export interface SemanticToken {
  start: number
  length: number
  type: number
  modifiers: number
}

export function semanticTokens(analysis: Analysis, library: Library): SemanticToken[] {
  const declared = new Set(analysis.declarations.map((declaration) => declaration.nameToken))
  const type = (name: (typeof TOKEN_TYPES)[number]) => TOKEN_TYPES.indexOf(name)
  const result: SemanticToken[] = []
  for (const token of analysis.tokens) {
    if (token.kind === 'identifier') {
      const name = token.text.toLowerCase()
      const kind = analysis.kinds.get(name)
      const length = token.end - token.start
      if (kind) {
        result.push({ start: token.start, length, type: type(kind), modifiers: declared.has(token) ? DECLARATION : 0 })
      } else if (library.has(name)) {
        result.push({ start: token.start, length, type: type('function'), modifiers: DEFAULT_LIBRARY })
      }
    } else if (token.kind === 'module') {
      const colon = token.text.indexOf(':')
      result.push({ start: token.start, length: colon, type: type('namespace'), modifiers: 0 })
      result.push({ start: token.start + colon + 1, length: token.text.length - colon - 1, type: type('function'), modifiers: 0 })
    }
  }
  return result
}
