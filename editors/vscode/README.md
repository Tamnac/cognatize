# Cognate for VS Code

Language support for [Cognate](https://github.com/cognate-lang/cognate) `.cog` files.

- Syntax highlighting (TextMate grammar) that follows the lexer in `src/lexer.l`, including informal lowercase words as comments
- Semantic highlighting that tells user functions, variables and prelude/builtin words apart
- Diagnostics for lexical and bracket errors, reported all at once (the compiler stops at the first)
- Outline and breadcrumbs, folding for blocks and comments
- Hover and completion for builtins, prelude functions and names declared in the file. Docs come from the `~ … ~` comment above a `Def`, in `src/prelude.cog` and in user code

The extension does not run `cognac`, so type errors and undefined words are not reported yet.

## Development

Needs Node 22.18 or later.

```
npm install
npm run build      # generates src/library.generated.json from ../../src, then bundles into dist/
npm test
npm run typecheck
npm run package    # builds cognate-0.1.0.vsix
```

Press F5 in VS Code with this folder open to start an extension host, or install the `.vsix`.

The builtin and prelude list is read from `src/builtins.c` and `src/prelude.cog`, so rerun `npm run build` after changing them.
