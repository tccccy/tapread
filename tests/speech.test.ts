import { describe, it, expect } from 'vitest'
import { pickVoice, type VoiceLike } from '../src/lib/speech'

const v = (name: string, lang: string, localService = true): VoiceLike => ({ name, lang, localService })

describe('pickVoice', () => {
  const voices = [v('Samantha', 'en-US'), v('Mónica', 'es-ES'), v('Paulina', 'es-MX'), v('Mónica (Enhanced)', 'es-ES'), v('Google español', 'es-ES', false)]

  it('優先選高品質（Enhanced／Premium）的同語言語音', () => {
    expect(pickVoice(voices, 'es')?.name).toBe('Mónica (Enhanced)')
  })

  it('其次選裝置內建（離線可用）的語音', () => {
    expect(pickVoice([v('Google español', 'es-ES', false), v('Paulina', 'es-MX')], 'es')?.name).toBe('Paulina')
  })

  it('避開 Eddy、Grandma 等趣味語音', () => {
    expect(pickVoice([v('Eddy (西班牙文)', 'es-ES'), v('Grandma (西班牙文)', 'es-ES'), v('Mónica', 'es-ES')], 'es')?.name).toBe('Mónica')
  })

  it('只有趣味語音時仍然可以發音', () => {
    expect(pickVoice([v('Eddy (西班牙文)', 'es-ES')], 'es')?.name).toBe('Eddy (西班牙文)')
  })

  it('語言碼大小寫、底線寫法都能比對', () => {
    expect(pickVoice([v('Thomas', 'fr_FR')], 'FR')?.name).toBe('Thomas')
  })

  it('沒有該語言或語言未知時回傳 undefined', () => {
    expect(pickVoice(voices, 'ja')).toBeUndefined()
    expect(pickVoice(voices, '')).toBeUndefined()
  })
})
