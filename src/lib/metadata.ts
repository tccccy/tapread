type LanguageMap = string | Record<string, string> | undefined | null
type Contributor = string | { name?: LanguageMap } | undefined | null

export interface RawMetadata {
  title?: LanguageMap
  author?: Contributor | Contributor[]
  language?: string | string[]
}

export interface BookMetadata {
  title: string
  author: string
  language: string
}

const asString = (value: unknown) => (typeof value === 'string' ? value : '')

// EPUB 的 OPF 可能有缺漏或型別錯誤，一律只接受字串
const fromLanguageMap = (value: LanguageMap): string => {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''
  return asString(Object.values(value)[0])
}

const fromContributor = (value: Contributor): string => {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''
  return fromLanguageMap(value.name)
}

const fromContributors = (value: RawMetadata['author']): string => {
  const list = Array.isArray(value) ? value : [value]
  return list.map(fromContributor).filter(Boolean).join(', ')
}

const primaryLanguage = (value: RawMetadata['language']): string => {
  const first = Array.isArray(value) ? value[0] : value
  return asString(first).split('-')[0].trim().toLowerCase()
}

const stripExtension = (fileName: string) => fileName.replace(/\.[^.]+$/, '')

export function normalizeMetadata(meta: RawMetadata | undefined, fileName: string): BookMetadata {
  return {
    title: fromLanguageMap(meta?.title).trim() || stripExtension(fileName),
    author: fromContributors(meta?.author),
    language: primaryLanguage(meta?.language),
  }
}
