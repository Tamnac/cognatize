export type TokenKind =
  | 'def'
  | 'let'
  | 'number'
  | 'identifier'
  | 'module'
  | 'symbol'
  | 'string'
  | 'semicolon'
  | 'open'
  | 'close'
  | 'informal'
  | 'blockComment'
  | 'lineComment'

export interface Token {
  kind: TokenKind
  start: number
  end: number
  text: string
}

export interface Problem {
  start: number
  end: number
  message: string
  severity: 'error' | 'warning'
}

export interface LexResult {
  tokens: Token[]
  problems: Problem[]
}

type RuleKind = TokenKind | 'whitespace' | 'invalidString'

// These mirror src/lexer.l. Like flex, the longest match wins and the first rule wins ties.
const END = '(?=[;()$^~ \\t\\n\\v\\f\\r]|$)'
const ALLOW = "[A-Za-z0-9\\-?!'+/*>=<^.]"
const FORMAL = '[A-Z\\-?!+/*><=^.]'

const rules: { kind: RuleKind; regex: RegExp }[] = (
  [
    ['def', 'D[eE][fF]' + END],
    ['let', 'L[eE][tT]' + END],
    ['number', '-?(?:[1-9][0-9]*|[0-9])(?:\\.[0-9]+)?(?:e-?[0-9]+)?' + END],
    ['identifier', FORMAL + ALLOW + '*' + END],
    ['module', ALLOW + '+:' + FORMAL + ALLOW + '*' + END],
    ['symbol', '\\\\' + ALLOW + '+' + END],
    ['string', '"(?:\\\\[abfnrtv\\\\"]|[^\\n"\\\\])*"' + END],
    ['invalidString', '"(?:\\\\.|[^\\n"\\\\])*"' + END],
    ['semicolon', ';'],
    ['open', '\\('],
    ['close', '\\)'],
    ['informal', "[a-z][a-z0-9'\\-?!.]*"],
    ['whitespace', '[ \\t\\n\\v\\f\\r]+'],
  ] as const
).map(([kind, source]) => ({ kind, regex: new RegExp(source, 'uy') }))

const VALID_ESCAPES = 'abfnrtv\\"'

function longestMatch(text: string, pos: number) {
  let best: { kind: RuleKind; length: number } | undefined
  for (const { kind, regex } of rules) {
    regex.lastIndex = pos
    const match = regex.exec(text)
    if (match && (!best || match[0].length > best.length)) best = { kind, length: match[0].length }
  }
  return best
}

function lineEnd(text: string, pos: number) {
  const newline = text.indexOf('\n', pos)
  return newline < 0 ? text.length : newline
}

function invalidEscape(text: string, start: number, end: number): [number, number] {
  for (let i = start + 1; i < end - 1; i++) {
    if (text[i] !== '\\') continue
    if (!VALID_ESCAPES.includes(text[i + 1])) return [i, i + 2]
    i++
  }
  return [start, end]
}

export function lex(text: string): LexResult {
  const tokens: Token[] = []
  const problems: Problem[] = []
  const push = (kind: TokenKind, start: number, end: number) =>
    tokens.push({ kind, start, end, text: text.slice(start, end) })
  const report = (start: number, end: number, message: string, severity: Problem['severity'] = 'error') =>
    problems.push({ start, end, message, severity })

  let pos = 0
  while (pos < text.length) {
    if (text[pos] === '~') {
      let end: number
      if (text[pos + 1] === '~') {
        end = lineEnd(text, pos)
        push('lineComment', pos, end)
      } else {
        const close = text.indexOf('~', pos + 1)
        end = close < 0 ? text.length : close + 1
        if (close < 0) report(pos, end, 'unterminated comment', 'warning')
        push('blockComment', pos, end)
      }
      pos = end
      continue
    }

    const match = longestMatch(text, pos)
    if (!match) {
      const end = text[pos] === '"' ? lineEnd(text, pos) : pos + String.fromCodePoint(text.codePointAt(pos)!).length
      if (text[pos] === '"') {
        report(pos, end, 'unterminated string')
        push('string', pos, end)
      } else {
        report(pos, end, 'invalid token')
      }
      pos = end
      continue
    }

    const end = pos + match.length
    if (match.kind === 'invalidString') {
      report(...invalidEscape(text, pos, end), 'invalid escape sequence')
      push('string', pos, end)
    } else if (match.kind !== 'whitespace') {
      push(match.kind, pos, end)
    }
    pos = end
  }
  return { tokens, problems }
}
