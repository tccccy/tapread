import type { Definition } from './ai/definition'
import type { ReaderDb } from './db'

export interface DefinitionCache {
  get(key: string): Promise<Definition | undefined>
  put(key: string, definition: Definition): Promise<void>
}

export const createDefinitionCache = (db: ReaderDb): DefinitionCache => ({
  get: async (key) => (await db.definitions.get(key))?.definition,
  put: async (key, definition) => {
    await db.definitions.put({ key, definition, createdAt: Date.now() })
  },
})
