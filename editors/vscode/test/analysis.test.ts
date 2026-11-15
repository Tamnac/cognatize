import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { analyze, describe, inStringOrComment, semanticTokens } from '../src/analysis.ts'
import { lex } from '../src/lexer.ts'
import { createLibrary } from '../src/library.ts'

const library = createLibrary([{ name: 'print', label: 'Print', signature: 'Print Any' }])
const kinds = (text: string) => lex(text).tokens.map((token) => token.kind)
const messages = (text: string) => analyze(text).problems.map((problem) => problem.message)

test('real programs have no problems', () => {
  const root = new URL('../../../', import.meta.url)
  for (const dir of ['tests', 'examples']) {
    for (const file of readdirSync(new URL(dir, root)).filter((name) => name.endsWith('.cog'))) {
      const problems = messages(readFileSync(new URL(`${dir}/${file}`, root), 'utf8'))
      assert.deepEqual(problems, [], `${dir}/${file}`)
    }
  }
  assert.deepEqual(messages(readFileSync(new URL('src/prelude.cog', root), 'utf8')), [])
})

test('lexer follows the flex rules', () => {
  assert.deepEqual(kinds('Def Foo -5 1.5e-3 \\sym Mod:Word "hi\\n" ; ( )'), [
    'def', 'identifier', 'number', 'number', 'symbol', 'module', 'string', 'semicolon', 'open', 'close',
  ])
  assert.deepEqual(kinds('print the Value'), ['informal', 'informal', 'identifier'])
  assert.deepEqual(kinds('~~ line\nPrint ~ block\ncomment ~ 1'), ['lineComment', 'identifier', 'blockComment', 'number'])
  assert.deepEqual(kinds('Define Def? -'), ['identifier', 'identifier', 'identifier'])
})

test('lexer problems', () => {
  assert.deepEqual(messages('Print "abc'), ['unterminated string'])
  assert.deepEqual(messages('Print "a\\qb"'), ['invalid escape sequence'])
  assert.deepEqual(messages('Print @'), ['invalid token'])
  assert.deepEqual(messages('~ never closed'), ['unterminated comment'])
})

test('parser problems', () => {
  assert.deepEqual(messages('Print (1 2'), ['unclosed parenthesis'])
  assert.deepEqual(messages('Print 1 )'), ['unbalanced parenthesis'])
  assert.deepEqual(messages('Def ;'), ['expected a name after Def'])
  assert.deepEqual(messages('Def (a) Let 1'), ['expected a name after Def', 'expected a name after Let'])
})

test('outline nests functions and keeps top-level variables', () => {
  const { outline } = analyze('Let X be 1;\nDef Outer (\n  Let Hidden be 2;\n  Def Inner as (1)\n);\nDef Param;')
  assert.deepEqual(
    outline.map((node) => [node.name, node.kind, node.children.map((child) => child.name)]),
    [['X', 'variable', []], ['Outer', 'function', ['Inner']], ['Param', 'variable', []]],
  )
})

test('doc comments attach to the following Def', () => {
  const analysis = analyze('~\n  Adds one.\n\n  More.\n~\nDef Inc as (+ 1);\nDef Plain as (1);')
  assert.equal(describe('inc', analysis, library)?.doc, 'Adds one.\n\nMore.')
  assert.equal(describe('plain', analysis, library)?.doc, undefined)
  assert.equal(describe('print', analysis, library)?.header, 'Print Any')
})

test('semantic tokens separate local and library words', () => {
  const analysis = analyze('Def Foo as (Print Bar);\nLet Bar be 1;')
  const types = semanticTokens(analysis, library).map(({ start, type, modifiers }) => [
    analysis.tokens.find((token) => token.start === start)!.text,
    type,
    modifiers,
  ])
  assert.deepEqual(types, [['Foo', 1, 1], ['Print', 1, 2], ['Bar', 2, 0], ['Bar', 2, 1]])
})

test('strings and comments are detected at the cursor', () => {
  const analysis = analyze('Print "abc" ~ note ~ Foo')
  assert.equal(inStringOrComment(analysis, 9), true)
  assert.equal(inStringOrComment(analysis, 15), true)
  assert.equal(inStringOrComment(analysis, 12), false)
  assert.equal(inStringOrComment(analysis, 22), false)
})
