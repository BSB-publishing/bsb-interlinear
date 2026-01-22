// Strong's Lexicon API - loads Hebrew and Greek lexicon data

export type LexiconEntry = {
  word: string
  translit: string
  pron: string
  def: string
  fullDef: string
  kjv: string
  gloss?: string
  morph?: string
  stepDef?: string
}

// Cache
const lexiconCache: {
  hebrew: Record<string, LexiconEntry> | null
  greek: Record<string, LexiconEntry> | null
} = {
  hebrew: null,
  greek: null,
}

const DATA_BASE = '/data/strongs'

async function loadHebrewLexicon(): Promise<Record<string, LexiconEntry>> {
  if (lexiconCache.hebrew) return lexiconCache.hebrew

  try {
    const response = await fetch(`${DATA_BASE}/lexicon/hebrew.json`)
    if (!response.ok) return {}
    const data = await response.json()
    lexiconCache.hebrew = data
    return data
  } catch (error) {
    console.error('Error loading Hebrew lexicon:', error)
    return {}
  }
}

async function loadGreekLexicon(): Promise<Record<string, LexiconEntry>> {
  if (lexiconCache.greek) return lexiconCache.greek

  try {
    const response = await fetch(`${DATA_BASE}/lexicon/greek.json`)
    if (!response.ok) return {}
    const data = await response.json()
    lexiconCache.greek = data
    return data
  } catch (error) {
    console.error('Error loading Greek lexicon:', error)
    return {}
  }
}

export async function getLexiconEntry(strongsNumber: string): Promise<LexiconEntry | null> {
  if (!strongsNumber) return null

  const normalized = strongsNumber.toUpperCase()
  const lexicon = normalized.startsWith('H') ? await loadHebrewLexicon() : await loadGreekLexicon()
  return lexicon[normalized] || null
}

export async function getLexiconEntries(
  strongsNumbers: string[]
): Promise<Record<string, LexiconEntry>> {
  const [hebrew, greek] = await Promise.all([loadHebrewLexicon(), loadGreekLexicon()])
  const results: Record<string, LexiconEntry> = {}

  for (const num of strongsNumbers) {
    if (!num) continue
    const normalized = num.toUpperCase()
    const entry = normalized.startsWith('H') ? hebrew[normalized] : greek[normalized]
    if (entry) results[normalized] = entry
  }

  return results
}

/**
 * Check if a Strong's number is Hebrew
 */
export function isHebrewStrongs(strongsNumber: string): boolean {
  return !!strongsNumber && strongsNumber.toUpperCase().startsWith('H')
}

/**
 * Check if a Strong's number is Greek
 */
export function isGreekStrongs(strongsNumber: string): boolean {
  return !!strongsNumber && strongsNumber.toUpperCase().startsWith('G')
}

/**
 * Get the language label for a Strong's number
 */
export function getStrongsLanguage(strongsNumber: string): 'Hebrew' | 'Greek' {
  return isHebrewStrongs(strongsNumber) ? 'Hebrew' : 'Greek'
}

/**
 * Clear the lexicon cache (useful for testing or memory management)
 */
export function clearLexiconCache(): void {
  lexiconCache.hebrew = null
  lexiconCache.greek = null
}

/**
 * Preload both lexicons (useful for interlinear modes)
 */
export async function preloadLexicons(): Promise<void> {
  await Promise.all([loadHebrewLexicon(), loadGreekLexicon()])
}
