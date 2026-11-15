import type { Problem, Token } from './lexer.ts'

export interface Word {
  kind: 'word'
  token: Token
}

export interface Binding {
  kind: 'def' | 'let'
  keyword: Token
  name: Token
}

export interface Block {
  kind: 'block'
  open?: Token
  close?: Token
  statements: Statement[]
}

export type Item = Word | Binding | Block

export interface Statement {
  items: Item[]
}

export interface ParseResult {
  root: Block
  problems: Problem[]
}

const IGNORED = new Set(['informal', 'blockComment', 'lineComment'])

function newBlock(open?: Token): Block {
  return { kind: 'block', open, statements: [{ items: [] }] }
}

export function parse(tokens: Token[]): ParseResult {
  const significant = tokens.filter((token) => !IGNORED.has(token.kind))
  const problems: Problem[] = []
  const report = (token: Token, message: string) =>
    problems.push({ start: token.start, end: token.end, message, severity: 'error' })

  const root = newBlock()
  const stack = [root]
  for (let i = 0; i < significant.length; i++) {
    const token = significant[i]
    const block = stack[stack.length - 1]
    const items = block.statements[block.statements.length - 1].items
    switch (token.kind) {
      case 'semicolon':
        block.statements.push({ items: [] })
        break
      case 'open': {
        const child = newBlock(token)
        items.push(child)
        stack.push(child)
        break
      }
      case 'close':
        if (stack.length > 1) stack.pop()!.close = token
        else report(token, 'unbalanced parenthesis')
        break
      case 'def':
      case 'let': {
        const name = significant[i + 1]
        if (name?.kind === 'identifier') {
          items.push({ kind: token.kind, keyword: token, name })
          i++
        } else {
          report(token, `expected a name after ${token.text}`)
        }
        break
      }
      default:
        items.push({ kind: 'word', token })
    }
  }
  for (const block of stack.slice(1)) report(block.open!, 'unclosed parenthesis')
  return { root, problems }
}

export function itemEnd(item: Item): number {
  switch (item.kind) {
    case 'word':
      return item.token.end
    case 'def':
    case 'let':
      return item.name.end
    case 'block': {
      if (item.close) return item.close.end
      const last = item.statements.flatMap((statement) => statement.items).pop()
      return last ? itemEnd(last) : item.open!.end
    }
  }
}
