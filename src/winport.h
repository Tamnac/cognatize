#ifndef WINPORT_H
#define WINPORT_H

#include <stdbool.h>
#include <stddef.h>

// Windows-only helpers. They live in their own translation unit because
// <windows.h> clashes with Cognate's identifiers (bind, boolean, ...).

#define WIN_PATH_MAX 260

char* win_reserve_heap(void);
void win_commit(char* addr, size_t size);
void win_temp_path(char path[WIN_PATH_MAX]);
void* win_spawn(char** args);
bool win_poll(void* process, int* status);

#endif
