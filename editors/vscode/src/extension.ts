import type { ExtensionContext } from 'vscode'
import { LanguageClient, TransportKind } from 'vscode-languageclient/node'

let client: LanguageClient | undefined

export function activate(context: ExtensionContext) {
  const module = context.asAbsolutePath('dist/server.cjs')
  client = new LanguageClient(
    'cognate',
    'Cognate Language Server',
    {
      run: { module, transport: TransportKind.ipc },
      debug: { module, transport: TransportKind.ipc, options: { execArgv: ['--nolazy', '--inspect=6009'] } },
    },
    { documentSelector: [{ language: 'cognate' }] },
  )
  return client.start()
}

export function deactivate() {
  return client?.stop()
}
