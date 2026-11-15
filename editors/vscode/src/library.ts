export interface LibraryEntry {
  name: string
  label: string
  signature?: string
  doc?: string
}

export type Library = ReadonlyMap<string, LibraryEntry>

export function createLibrary(entries: LibraryEntry[]): Library {
  return new Map(entries.map((entry) => [entry.name, entry]))
}
