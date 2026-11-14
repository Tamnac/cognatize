#include "winport.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <windows.h>

char* win_reserve_heap(void)
{
	MEMORYSTATUSEX mem = { .dwLength = sizeof mem };
	GlobalMemoryStatusEx(&mem);
	return VirtualAlloc(NULL, mem.ullTotalPhys, MEM_RESERVE, PAGE_READWRITE);
}

void win_commit(char* addr, size_t size)
{
	if (!VirtualAlloc(addr, size, MEM_COMMIT, PAGE_READWRITE))
	{
		fprintf(stderr, "Out of memory\n");
		exit(EXIT_FAILURE);
	}
}

void win_temp_path(char path[WIN_PATH_MAX])
{
	char dir[WIN_PATH_MAX];
	GetTempPathA(sizeof dir, dir);
	GetTempFileNameA(dir, "cog", 0, path);
	for (char* c = path ; *c ; ++c) if (*c == '\\') *c = '/';
}

void* win_spawn(char** args)
{
	char cmdline[8192] = "";
	for ( ; *args ; ++args)
	{
		strcat(cmdline, "\"");
		strcat(cmdline, *args);
		strcat(cmdline, "\" ");
	}
	STARTUPINFOA si = { .cb = sizeof si };
	PROCESS_INFORMATION pi;
	if (!CreateProcessA(NULL, cmdline, NULL, NULL, FALSE, 0, NULL, NULL, &si, &pi)) return NULL;
	CloseHandle(pi.hThread);
	return pi.hProcess;
}

bool win_poll(void* process, int* status)
{
	if (WaitForSingleObject(process, 50) == WAIT_TIMEOUT) return false;
	DWORD code;
	GetExitCodeProcess(process, &code);
	CloseHandle(process);
	*status = code;
	return true;
}
