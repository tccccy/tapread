import type { ReaderDb, Shelf } from '../db'

export class ShelfNameError extends Error {
  name = 'ShelfNameError'
}

const MAX_NAME = 40

export interface ShelfStore {
  list(): Promise<Shelf[]>
  create(name: string): Promise<Shelf>
  rename(id: string, name: string): Promise<void>
  /** 刪除書架；書本身不刪，只從這個書架移出 */
  remove(id: string): Promise<void>
}

export function createShelfStore(db: ReaderDb): ShelfStore {
  const validName = async (raw: string, exceptId?: string) => {
    const name = raw.trim().slice(0, MAX_NAME)
    if (!name) throw new ShelfNameError('書架名稱不能空白。')
    const taken = (await db.shelves.toArray()).some(
      (s) => s.id !== exceptId && s.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    )
    if (taken) throw new ShelfNameError(`已經有叫「${name}」的書架了。`)
    return name
  }

  return {
    list: () => db.shelves.orderBy('order').toArray(),

    async create(raw) {
      const name = await validName(raw)
      const last = await db.shelves.orderBy('order').last()
      const shelf: Shelf = { id: crypto.randomUUID(), name, order: (last?.order ?? -1) + 1, createdAt: Date.now() }
      await db.shelves.add(shelf)
      return shelf
    },

    async rename(id, raw) {
      const name = await validName(raw, id)
      await db.shelves.update(id, { name })
    },

    remove: (id) =>
      db.transaction('rw', db.shelves, db.books, async () => {
        await db.shelves.delete(id)
        const books = await db.books.filter((b) => !!b.shelfIds?.includes(id)).toArray()
        for (const b of books) await db.books.update(b.id, { shelfIds: b.shelfIds!.filter((s) => s !== id) })
      }),
  }
}
