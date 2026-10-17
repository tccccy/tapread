import { describe, expect, it } from 'vitest'
import { normalizeMetadata } from '../src/lib/metadata'

describe('normalizeMetadata', () => {
  it('處理字串形式的書名、作者、語言', () => {
    expect(normalizeMetadata({ title: 'Don Quijote', author: 'Cervantes', language: 'es-ES' }, 'f.epub'))
      .toEqual({ title: 'Don Quijote', author: 'Cervantes', language: 'es' })
  })

  it('處理語言對照表形式的書名', () => {
    expect(normalizeMetadata({ title: { it: 'Il Principe', en: 'The Prince' } }, 'f.epub').title).toBe('Il Principe')
  })

  it('處理多位作者（字串或物件）', () => {
    const meta = { author: [{ name: 'Ana' }, 'Bruno', { name: { pt: 'Caio' } }] }
    expect(normalizeMetadata(meta, 'f.epub').author).toBe('Ana, Bruno, Caio')
  })

  it('語言為陣列時取第一個，並轉小寫主標籤', () => {
    expect(normalizeMetadata({ language: ['PT-br', 'en'] }, 'f.epub').language).toBe('pt')
  })

  it('沒有書名時用檔名（去掉副檔名）', () => {
    expect(normalizeMetadata({}, 'mi libro.epub').title).toBe('mi libro')
  })

  it('欄位型別不正確時不會丟錯，改用預設值', () => {
    const bad = { title: { en: 42 }, author: [null, 7, { name: 'Ok' }], language: [3] } as never
    expect(normalizeMetadata(bad, 'x.epub')).toEqual({ title: 'x', author: 'Ok', language: '' })
  })

  it('metadata 為 undefined 時給安全預設值', () => {
    expect(normalizeMetadata(undefined, 'x.epub')).toEqual({ title: 'x', author: '', language: '' })
  })
})
