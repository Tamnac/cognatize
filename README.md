<h1 align="center"> Cognatize </h1>
<h2 align="center"> Readable and concise concatenative programming </h2>
<p align="center">
<img src="https://github.com/cognate-lang/cognate/actions/workflows/test-debian-gcc.yml/badge.svg">
<img src="https://github.com/cognate-lang/cognate/actions/workflows/test-debian-clang.yml/badge.svg">
<img src="https://github.com/cognate-lang/cognate/actions/workflows/test-debian-tcc.yml/badge.svg">
<img src="https://github.com/cognate-lang/cognate/actions/workflows/test-macos-clang.yml/badge.svg">
<img src="https://img.shields.io/github/license/cognate-lang/cognate.svg">
</p>

Cognatize is a fork of [Cognate](https://github.com/cognate-lang/cognate) with Windows support, a few compiler conveniences and a VS Code extension. See [What Cognatize adds](#what-cognatize-adds).

<img src="screenshots/fizzbuzz.png" width="100%" title="Fizzbuzz in Cognate (font is Hermit)">

Cognate is a project aiming to create a human readable programming language with as little syntax as possible. Where natural language programming usually uses many complex syntax rules, instead Cognate takes them away. What it adds is simple, a way to embed comments into statements.

<img src="screenshots/hanoi.png" width="100%" title="Towers of Hanoi in Cognate (font is Hermit)">

As you can see, Cognate ignores words starting with lowercase letters, allowing them to be used to describe functionality and enhance readability. This makes Cognate codebases intuitive and maintainable.

<img src="screenshots/square.png" width="100%" title="Map function in Cognate (font is Hermit)">

Cognate is a stack-oriented programming language similar to Forth or Factor, except statements are evaluated right to left. This gives the expressiveness of concatenative programming as well as the readability of prefix notation. Statements can be delimited at arbitrary points, allowing them to read as sentences would in English.

<img src="screenshots/prime.png" width="100%" title="Prime numbers in Cognate (font is Hermit)">

Cognate borrows from other concatenative languages, but also adds unique features of its own.

- Point-free functions
- Operation chaining
- Multiple return values
- Combinator oriented programming
- Predicate pattern matching
- Natural language programming

Interested? Read the [tutorial](https://cognate-lang.github.io/learn/), and check out one of Cognate's implementations:

- CognaC (this repository) is the original compiler -- it performs type inference and produces efficient binaries.
- [Cognate Playground](https://cognate-playground.hedy.dev/) (developed by [hedyhli](https://github.com/hedyhli)) runs Cognate programs in a web browser.
- [Cogni](https://github.com/dragoncoder047/cogni) (developed by [dragoncoder047](https://github.com/dragoncoder047)) interprets Cognate programs and is optimised to run on microcontrollers.

## What Cognatize adds

The language itself is unchanged. The additions are in the compiler, the runtime and the tooling.

- **Native Windows support.** The compiler and runtime build with MinGW-w64 GCC, with no `windows.h` include (the used Win32 functions are declared directly, which roughly halves C compile time). The runtime commits memory lazily, handles exceptions, provides its own POSIX-style regex engine with leftmost-longest matching and UTF-8 bracket expressions, uses binary stdout/stderr and a 64-bit random generator, and bounds the length of spawned command lines.
- **`cognac run file.cog`.** Compiles the program and then runs it, returning its exit status.
- **`-quiet` flag.** Hides the banner and progress output.
- **`Clock` builtin.** Returns monotonic time in seconds.
- **Parser fixes.** The whole source is read into a buffer, so files without a trailing newline parse and report errors correctly. Errors in the prelude show the offending source line from any directory.
- **VS Code extension** in [editors/vscode](editors/vscode): syntax and semantic highlighting, diagnostics for lexical and bracket errors, outline, folding, and hover and completion for builtins, prelude functions and user definitions.

## Cognac

CognaC is the original Cognate compiler, it compiles Cognate programs into efficient C, which is then compiled into a small executable. As well as all language features, CognaC...

- Performs type inference (for optimisation and error reporting at compile time)
- Features a generational garbage collector
- Prints pretty error messages and backtraces (in debug mode)
- Approaches the speed of C for some small programs

### Building Cognate
Cognate runs on Linux, MacOS and Windows (see below for Windows). To build Cognate, you will need `make`, `flex`, `bison`, and a C compiler (currently supported are GCC, Clang, and TCC). After installing these, simply run:
```
make
```
If that succeeds, install the compiler with:
```
make install
```
This installs cognate to the `.local` prefix. To install to a different directory:
```
make PREFIX=/my/prefix/dir install
```
You should then run the test script to test Cognate's functionality. This should work regardless of operating system.
```
make test -j
```
If the tests all pass (they should!), you can then try running some of the included demo programs:
```
cognac examples/fizzbuzz.cog
./examples/fizzbuzz
```

#### Windows
On Windows, Cognate builds natively with MinGW-w64 GCC (for example from Scoop or MSYS2) and a `make` that provides `rm`, `grep` and `xxd` (such as the one in Git for Windows). `flex` and `bison` are available as `win_flex` and `win_bison` from [winflexbison](https://github.com/lexxmark/winflexbison). Make sure `gcc` is on your `PATH`, then run:
```
make FLEX=win_flex BISON=win_bison
```
The Windows runtime uses its own POSIX-style regular expression engine, so no extra libraries are needed. Alternatively, you can still use the Windows Subsystem for Linux.

[Here](https://cognate-lang.github.io/learn.html) is an work-in-progress introduction to the language.
