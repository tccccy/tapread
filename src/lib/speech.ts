// 發音：用瀏覽器內建的語音合成（免費、可離線）。iPad 上語音要由使用者點擊觸發

export type VoiceLike = Pick<SpeechSynthesisVoice, 'name' | 'lang' | 'localService'>

const baseLang = (lang: string) => lang.toLowerCase().replace('_', '-').split('-')[0]
const HIGH_QUALITY = /enhanced|premium|neural|natural/i
// 蘋果的趣味／機器人語音（Eddy、Grandma…），念書不自然，除非沒有別的才用
const NOVELTY = /^(eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley|albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|junior|ralph|fred|kathy)\b/i

/** 挑選某語言最好聽的語音：高品質 > 裝置內建 > 其他；趣味語音排最後 */
export function pickVoice<T extends VoiceLike>(voices: T[], language: string): T | undefined {
  if (!language) return undefined
  const want = baseLang(language)
  const same = voices.filter((voice) => baseLang(voice.lang) === want)
  const normal = same.filter((voice) => !NOVELTY.test(voice.name))
  const pool = normal.length > 0 ? normal : same
  return pool.find((voice) => HIGH_QUALITY.test(voice.name))
    ?? pool.find((voice) => voice.localService)
    ?? pool[0]
}

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window

export function speak(text: string, language: string, rate = 0.9): void {
  if (!canSpeak() || !text.trim()) return
  const synth = window.speechSynthesis
  // 連點時先停掉上一段
  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  const voice = pickVoice(synth.getVoices(), language)
  if (voice) utterance.voice = voice
  if (language) utterance.lang = voice?.lang ?? language
  utterance.rate = rate
  synth.speak(utterance)
}

export const stopSpeaking = () => {
  if (canSpeak()) window.speechSynthesis.cancel()
}
