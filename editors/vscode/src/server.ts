import {
  CompletionItemKind,
  createConnection,
  DiagnosticSeverity,
  FoldingRangeKind,
  MarkupKind,
  ProposedFeatures,
  SemanticTokensBuilder,
  SymbolKind,
  TextDocumentSyncKind,
  TextDocuments,
  type CompletionItem,
  type DocumentSymbol,
  type FoldingRange,
} from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'
import {
  analyze,
  describe,
  inStringOrComment,
  semanticTokens,
  tokenAt,
  TOKEN_MODIFIERS,
  TOKEN_TYPES,
  type Analysis,
  type OutlineNode,
} from './analysis.ts'
import entries from './library.generated.json'
import { createLibrary } from './library.ts'

const library = createLibrary(entries)
const connection = createConnection(ProposedFeatures.all)
const documents = new TextDocuments(TextDocument)
const cache = new Map<string, { version: number; analysis: Analysis }>()

function analysisOf(document: TextDocument): Analysis {
  const cached = cache.get(document.uri)
  if (cached?.version === document.version) return cached.analysis
  const analysis = analyze(document.getText())
  cache.set(document.uri, { version: document.version, analysis })
  return analysis
}

connection.onInitialize(() => ({
  capabilities: {
    textDocumentSync: TextDocumentSyncKind.Incremental,
    hoverProvider: true,
    completionProvider: {},
    documentSymbolProvider: true,
    foldingRangeProvider: true,
    semanticTokensProvider: {
      legend: { tokenTypes: [...TOKEN_TYPES], tokenModifiers: [...TOKEN_MODIFIERS] },
      full: true,
    },
  },
}))

documents.onDidChangeContent(({ document }) => {
  const { problems } = analysisOf(document)
  connection.sendDiagnostics({
    uri: document.uri,
    diagnostics: problems.map((problem) => ({
      range: { start: document.positionAt(problem.start), end: document.positionAt(problem.end) },
      severity: problem.severity === 'error' ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
      message: problem.message,
      source: 'cognate',
    })),
  })
})

documents.onDidClose(({ document }) => {
  cache.delete(document.uri)
  connection.sendDiagnostics({ uri: document.uri, diagnostics: [] })
})

connection.onHover(({ textDocument, position }) => {
  const document = documents.get(textDocument.uri)
  if (!document) return null
  const analysis = analysisOf(document)
  const token = tokenAt(analysis, document.offsetAt(position))
  if (token?.kind !== 'identifier') return null
  const description = describe(token.text.toLowerCase(), analysis, library)
  if (!description) return null
  const header = '```cognate\n' + description.header + '\n```'
  return {
    contents: { kind: MarkupKind.Markdown, value: description.doc ? `${header}\n\n${description.doc}` : header },
    range: { start: document.positionAt(token.start), end: document.positionAt(token.end) },
  }
})

const WORD_CHAR = /[A-Za-z0-9\-?!'+/*>=<^.]/

connection.onCompletion(({ textDocument, position }): CompletionItem[] => {
  const document = documents.get(textDocument.uri)
  if (!document) return []
  const analysis = analysisOf(document)
  const offset = document.offsetAt(position)
  if (inStringOrComment(analysis, offset)) return []

  // Lowercase words are comments, so they are not completed.
  const text = document.getText()
  let wordStart = offset
  while (wordStart > 0 && WORD_CHAR.test(text[wordStart - 1])) wordStart--
  if (/[a-z]/.test(text[wordStart] ?? '') && wordStart < offset) return []

  const items = new Map<string, CompletionItem>()
  const add = (name: string, label: string, kind: CompletionItemKind, detail?: string, doc?: string) => {
    if (items.has(name)) return
    items.set(name, {
      label,
      kind,
      detail,
      documentation: doc ? { kind: MarkupKind.Markdown, value: doc } : undefined,
    })
  }
  for (const { name, label, kind, doc } of analysis.declarations)
    add(name, label, kind === 'function' ? CompletionItemKind.Function : CompletionItemKind.Variable, undefined, doc)
  for (const { name, label, signature, doc } of library.values())
    add(name, label, CompletionItemKind.Function, signature, doc)
  return [...items.values()]
})

function toSymbol(document: TextDocument, node: OutlineNode): DocumentSymbol {
  return {
    name: node.name,
    kind: node.kind === 'function' ? SymbolKind.Function : SymbolKind.Variable,
    range: { start: document.positionAt(node.start), end: document.positionAt(node.end) },
    selectionRange: { start: document.positionAt(node.selection.start), end: document.positionAt(node.selection.end) },
    children: node.children.map((child) => toSymbol(document, child)),
  }
}

connection.onDocumentSymbol(({ textDocument }) => {
  const document = documents.get(textDocument.uri)
  return document ? analysisOf(document).outline.map((node) => toSymbol(document, node)) : []
})

connection.onFoldingRanges(({ textDocument }): FoldingRange[] => {
  const document = documents.get(textDocument.uri)
  if (!document) return []
  const text = document.getText()
  return analysisOf(document).foldable.flatMap(({ start, end }) => {
    const startLine = document.positionAt(start).line
    const closing = document.positionAt(end)
    // Keep a closing delimiter that starts its own line visible when folded.
    const alone = !text.slice(document.offsetAt({ line: closing.line, character: 0 }), end).trim()
    const endLine = alone ? closing.line - 1 : closing.line
    return endLine > startLine ? [{ startLine, endLine, kind: FoldingRangeKind.Region }] : []
  })
})

connection.languages.semanticTokens.on(({ textDocument }) => {
  const builder = new SemanticTokensBuilder()
  const document = documents.get(textDocument.uri)
  if (document) {
    for (const token of semanticTokens(analysisOf(document), library)) {
      const { line, character } = document.positionAt(token.start)
      builder.push(line, character, token.length, token.type, token.modifiers)
    }
  }
  return builder.build()
})

documents.listen(connection)
connection.listen()
