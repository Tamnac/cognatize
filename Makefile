CC=cc
CFLAGS=-std=gnu17 -Og -ggdb3 -g -Wall -Wpedantic
FLEX=flex
BISON=bison
PREFIX=`echo ~`/.local
BINDIR=$(PREFIX)/bin
TESTS=$(basename $(wildcard tests/*.cog))

ifeq ($(OS),Windows_NT)
EXE=.exe
CFLAGS+=-D__USE_MINGW_ANSI_STDIO=1
PLATFORM_SRC=src/winport.c
else
EXE=
PLATFORM_SRC=
CFLAGS+=-rdynamic
endif

cognac$(EXE): src/cognac.h src/cognac.c src/parser.c src/parser.h src/lexer.c src/runtime_bytes.h src/prelude.h src/builtins.c src/winport.c src/winport.h
	$(CC) $(CFLAGS) src/lexer.c src/parser.c src/cognac.c $(PLATFORM_SRC) -o cognac -DCC=$(CC)

install: cognac$(EXE)
	mkdir -p $(BINDIR)
	cp cognac$(EXE) $(BINDIR)/cognac$(EXE)

uninstall:
	rm -rf $(BINDIR)/cognac$(EXE)

src/runtime_bytes.h: src/runtime.h
	xxd -i src/runtime.h > src/runtime_bytes.h

src/prelude.h: src/prelude.cog
	xxd -i src/prelude.cog > src/prelude.h

src/lexer.c: src/lexer.l
	$(FLEX) -o src/lexer.c src/lexer.l

src/parser.c src/parser.h: src/parser.y
	$(BISON) src/parser.y --defines=src/parser.h -o src/parser.c

clean:
	rm -f src/lexer.c src/parser.c src/parser.h cognac$(EXE) src/runtime_bytes.h src/prelude.h

test: $(TESTS)

$(TESTS): cognac$(EXE)
	@rm -f $@.log $@.c $@ $@$(EXE)
	./cognac $@.cog > $@.log
	./$@ >> $@.log
	./cognac $@.cog -debug > $@-debug.log
	./$@ >> $@-debug.log
	./cognac $@.cog -GCTEST > $@-GCTEST.log
	./$@ >> $@-GCTEST.log
	./cognac $@.cog -NOINLINE > $@-NOINLINE.log
	./$@ >> $@-NOINLINE.log
	./cognac $@.cog -GCTEST -NOINLINE > $@-BOTH.log
	./$@ >> $@-BOTH.log
	@! grep "^FAIL" $@.log --color
	@! grep "^FAIL" $@-debug.log --color
	@! grep "^FAIL" $@-GCTEST.log --color
	@! grep "^FAIL" $@-NOINLINE.log --color
	@! grep "^FAIL" $@-BOTH.log --color
