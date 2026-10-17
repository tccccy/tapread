import { describe, expect, it } from 'vitest'
import { generatedCoverColors } from '../src/lib/books/coverStyle'

describe('generatedCoverColors', () => {
  it('同一個書名永遠得到同一組顏色', () => {
    expect(generatedCoverColors('Mi cuento')).toEqual(generatedCoverColors('Mi cuento'))
  })

  it('不同書名大多會分到不同顏色', () => {
    const titles = ['A', 'Bb', 'Ccc', 'Dddd', 'Eeeee', 'Ffffff', 'Ggggggg', 'Hhhhhhhh']
    const distinct = new Set(titles.map((t) => generatedCoverColors(t).background))
    expect(distinct.size).toBeGreaterThan(3)
  })
})
