// BSB Data API - loads pre-generated BSB Bible data with Strong's numbers
// Data source: /public/bsb-data/
//
// Data structure (2024):
// - display/{BOOK}/{BOOK}{CHAPTER}.json - chapter data with eng/heb/grk arrays
// - index-cc-by/{BOOK}/{BOOK}{CHAPTER}.jsonl - per-verse index with cross-refs, morphology
// - concordance/strongs-to-verses.json - pre-built Strong's number lookup
// - headings.jsonl - section headings

// Book code mapping (book number to 3-letter code)
const BOOK_CODES: Record<number, string> = {
  1: 'GEN',
  2: 'EXO',
  3: 'LEV',
  4: 'NUM',
  5: 'DEU',
  6: 'JOS',
  7: 'JDG',
  8: 'RUT',
  9: '1SA',
  10: '2SA',
  11: '1KI',
  12: '2KI',
  13: '1CH',
  14: '2CH',
  15: 'EZR',
  16: 'NEH',
  17: 'EST',
  18: 'JOB',
  19: 'PSA',
  20: 'PRO',
  21: 'ECC',
  22: 'SNG',
  23: 'ISA',
  24: 'JER',
  25: 'LAM',
  26: 'EZK',
  27: 'DAN',
  28: 'HOS',
  29: 'JOL',
  30: 'AMO',
  31: 'OBA',
  32: 'JON',
  33: 'MIC',
  34: 'NAM',
  35: 'HAB',
  36: 'ZEP',
  37: 'HAG',
  38: 'ZEC',
  39: 'MAL',
  40: 'MAT',
  41: 'MRK',
  42: 'LUK',
  43: 'JHN',
  44: 'ACT',
  45: 'ROM',
  46: '1CO',
  47: '2CO',
  48: 'GAL',
  49: 'EPH',
  50: 'PHP',
  51: 'COL',
  52: '1TH',
  53: '2TH',
  54: '1TI',
  55: '2TI',
  56: 'TIT',
  57: 'PHM',
  58: 'HEB',
  59: 'JAS',
  60: '1PE',
  61: '2PE',
  62: '1JN',
  63: '2JN',
  64: '3JN',
  65: 'JUD',
  66: 'REV',
}

// Reverse mapping (code to number)
const BOOK_NUMBERS: Record<string, number> = Object.fromEntries(
  Object.entries(BOOK_CODES).map(([num, code]) => [code, parseInt(num)])
)

// Book code aliases for flexibility
const BOOK_ALIASES: Record<string, string> = {
  GEN: 'GEN',
  EXO: 'EXO',
  LEV: 'LEV',
  NUM: 'NUM',
  DEU: 'DEU',
  JOS: 'JOS',
  JDG: 'JDG',
  RUT: 'RUT',
  '1SA': '1SA',
  '2SA': '2SA',
  '1KI': '1KI',
  '2KI': '2KI',
  '1CH': '1CH',
  '2CH': '2CH',
  EZR: 'EZR',
  NEH: 'NEH',
  EST: 'EST',
  JOB: 'JOB',
  PSA: 'PSA',
  PRO: 'PRO',
  ECC: 'ECC',
  SNG: 'SNG',
  SOL: 'SNG', // Song of Solomon alias
  ISA: 'ISA',
  JER: 'JER',
  LAM: 'LAM',
  EZK: 'EZK',
  EZE: 'EZK', // Ezekiel alias
  DAN: 'DAN',
  HOS: 'HOS',
  JOL: 'JOL',
  JOE: 'JOL', // Joel alias
  AMO: 'AMO',
  OBA: 'OBA',
  OBD: 'OBA', // Obadiah alias
  JON: 'JON',
  MIC: 'MIC',
  NAM: 'NAM',
  NAH: 'NAM', // Nahum alias
  HAB: 'HAB',
  ZEP: 'ZEP',
  HAG: 'HAG',
  ZEC: 'ZEC',
  MAL: 'MAL',
  MAT: 'MAT',
  MRK: 'MRK',
  MAR: 'MRK', // Mark alias
  LUK: 'LUK',
  JHN: 'JHN',
  JOH: 'JHN', // John alias
  ACT: 'ACT',
  ROM: 'ROM',
  '1CO': '1CO',
  '2CO': '2CO',
  GAL: 'GAL',
  EPH: 'EPH',
  PHP: 'PHP',
  PHI: 'PHP', // Philippians alias
  COL: 'COL',
  '1TH': '1TH',
  '2TH': '2TH',
  '1TI': '1TI',
  '2TI': '2TI',
  TIT: 'TIT',
  PHM: 'PHM',
  HEB: 'HEB',
  JAS: 'JAS',
  JAM: 'JAS', // James alias
  '1PE': '1PE',
  '2PE': '2PE',
  '1JN': '1JN',
  '1JO': '1JN', // 1 John alias
  '2JN': '2JN',
  '2JO': '2JN', // 2 John alias
  '3JN': '3JN',
  '3JO': '3JN', // 3 John alias
  JUD: 'JUD',
  JDE: 'JUD', // Jude alias
  REV: 'REV',
}

// Types
export type BSBWord = [string, string | null] // [text, strongs_number]

export type BSBVerse = {
  v: number
  w: BSBWord[]
  heb?: BSBWord[] // Hebrew words (OT only) - in Hebrew word order
  grk?: BSBWord[] // Greek words (NT only) - in Greek word order
}

export type BSBChapter = {
  book: string
  chapter: number
  verses: BSBVerse[]
}

export type BSBHeading = {
  id: string
  b: string
  c: number
  before_v: number
  level: 's1' | 's2' | 'r'
  text: string
  refs: string[]
}

export type BSBMorphEntry = {
  s: string // Strong's number
  m: string // morphology code
  p: string // part of speech
  l: string // lemma (original word)
}

export type BSBWordSense = {
  si: number // Sense index
  s: string // Strong's number
  gl: string // Gloss for this sense
}

export type BSBMarbleSense = {
  lem: string // Hebrew/Aramaic lemma
  dom: string // Semantic domain
  sid: string // Sense ID
}

export type BSBIndexEntry = {
  s: string[] // Strong's numbers
  x: string[] // Cross-references
  m?: BSBMorphEntry[] // Morphology
  tp?: string[] // Nave's Topical Bible topics
  par?: string[] // Parallel passages
  img?: string[] // Image IDs from UBS
  map?: string[] // Map coordinates (lat,lng)
  dom?: string[] // Semantic domains
  ws?: Record<string, BSBWordSense> // Word sense disambiguation
  msense?: Record<string, BSBMarbleSense> // MARBLE sense data
  g?: Record<string, { lemma?: string; glosses?: string[]; def?: string }> // Glosses
}

export type ConcordanceResult = {
  id: string
  bookCode: string
  bookNumber: number
  chapter: number
  verse: number
}

// Cache
const chapterCache = new Map<string, BSBChapter>()
const chapterIndexCache = new Map<string, Map<number, BSBIndexEntry>>()
let headingsCache: BSBHeading[] | null = null
let concordanceCache: Map<string, string[]> | null = null

const BSB_DATA_BASE = '/bsb-data'

/**
 * Normalize a book code to the standard BSB format
 */
export function normalizeBookCode(bookCode: string): string | null {
  if (!bookCode) return null
  const upper = bookCode.toUpperCase()
  return BOOK_ALIASES[upper] || null
}

/**
 * Get book number from book code
 */
export function getBookNumber(bookCode: string): number {
  const normalized = normalizeBookCode(bookCode)
  return normalized ? BOOK_NUMBERS[normalized] || 0 : 0
}

/**
 * Get book code from book number
 */
export function getBookCode(bookNumber: number): string | null {
  return BOOK_CODES[bookNumber] || null
}

/**
 * Check if a book is in the Old Testament
 */
export function isOldTestament(book: number | string): boolean {
  const num = typeof book === 'number' ? book : getBookNumber(book)
  return num >= 1 && num <= 39
}

/**
 * Load a specific chapter from BSB display data
 * New format: /display/{BOOK}/{BOOK}{CHAPTER}.json
 * Contains { eng: { "1": [...], "2": [...] }, heb/grk: { "1": [...], ... } }
 */
async function loadBSBChapter(bookCode: string, chapter: number): Promise<BSBChapter | null> {
  const normalized = normalizeBookCode(bookCode)
  if (!normalized) return null

  const chapterNum = chapter
  const cacheKey = `${normalized}.${chapterNum}`

  if (chapterCache.has(cacheKey)) {
    return chapterCache.get(cacheKey)!
  }

  try {
    const response = await fetch(
      `${BSB_DATA_BASE}/display/${normalized}/${normalized}${chapterNum}.json`
    )
    if (!response.ok) {
      console.error(`Failed to load BSB chapter ${normalized} ${chapterNum}: ${response.status}`)
      return null
    }

    const data = await response.json()

    // Convert new format to expected verse format
    // New format: { eng: { "1": [[word, strongs], ...], "2": [...] }, heb/grk: {...} }
    // Expected format: { book, chapter, verses: [{ v, w, heb/grk }, ...] }
    const verses: BSBVerse[] = []
    const isOT = isOldTestament(normalized)
    const originalLangKey = isOT ? 'heb' : 'grk'

    for (const verseNum of Object.keys(data.eng).sort((a, b) => parseInt(a) - parseInt(b))) {
      const verse: BSBVerse = {
        v: parseInt(verseNum),
        w: data.eng[verseNum],
      }
      // Add Hebrew or Greek data if available
      if (data[originalLangKey] && data[originalLangKey][verseNum]) {
        if (isOT) {
          verse.heb = data[originalLangKey][verseNum]
        } else {
          verse.grk = data[originalLangKey][verseNum]
        }
      }
      verses.push(verse)
    }

    const result: BSBChapter = {
      book: normalized,
      chapter: chapterNum,
      verses,
    }

    chapterCache.set(cacheKey, result)
    return result
  } catch (error) {
    console.error(`Error loading BSB chapter ${normalized} ${chapterNum}:`, error)
    return null
  }
}

/**
 * Load headings
 */
async function loadHeadings(): Promise<BSBHeading[]> {
  if (headingsCache) return headingsCache

  try {
    const response = await fetch(`${BSB_DATA_BASE}/headings.jsonl`)
    if (!response.ok) return []

    const text = await response.text()
    headingsCache = text
      .trim()
      .split('\n')
      .map(line => JSON.parse(line))
    return headingsCache
  } catch (error) {
    console.error('Error loading headings:', error)
    return []
  }
}

/**
 * Load chapter index data (cross-refs, morphology, etc.)
 * New format: /index-cc-by/{BOOK}/{BOOK}{CHAPTER}.jsonl
 */
async function loadChapterIndex(
  bookCode: string,
  chapter: number
): Promise<Map<number, BSBIndexEntry> | null> {
  const normalized = normalizeBookCode(bookCode)
  if (!normalized) return null

  const chapterNum = chapter
  const cacheKey = `${normalized}.${chapterNum}`

  if (chapterIndexCache.has(cacheKey)) {
    return chapterIndexCache.get(cacheKey)!
  }

  try {
    const response = await fetch(
      `${BSB_DATA_BASE}/index-cc-by/${normalized}/${normalized}${chapterNum}.jsonl`
    )
    if (!response.ok) {
      console.error(`Failed to load index for ${normalized} ${chapterNum}: ${response.status}`)
      return null
    }

    const text = await response.text()
    const entries = new Map<number, BSBIndexEntry>()
    const lines = text.trim().split('\n')

    lines.forEach((line, index) => {
      const entry = JSON.parse(line)
      // Verse number is line index + 1 (first line is verse 1)
      entries.set(index + 1, entry)
    })

    chapterIndexCache.set(cacheKey, entries)
    return entries
  } catch (error) {
    console.error(`Error loading index for ${normalized} ${chapterNum}:`, error)
    return null
  }
}

/**
 * Load concordance data (Strong's number to verse references)
 * New format: /concordance/strongs-to-verses.json
 */
async function loadConcordance(): Promise<Map<string, string[]> | null> {
  if (concordanceCache) return concordanceCache

  try {
    const response = await fetch(`${BSB_DATA_BASE}/concordance/strongs-to-verses.json`)
    if (!response.ok) {
      console.error('Failed to load concordance:', response.status)
      return null
    }

    const data = await response.json()
    concordanceCache = new Map(Object.entries(data))
    return concordanceCache
  } catch (error) {
    console.error('Error loading concordance:', error)
    return null
  }
}

/**
 * Load enriched chapter data (chapter + headings + index)
 */
export async function loadEnrichedBSBChapter(
  bookNumber: number,
  chapterNumber: number
): Promise<{
  chapter: BSBChapter
  headings: BSBHeading[]
  indexEntries: Map<number, BSBIndexEntry>
} | null> {
  const bookCode = BOOK_CODES[bookNumber]
  if (!bookCode) return null

  const [chapterData, allHeadings, indexData] = await Promise.all([
    loadBSBChapter(bookCode, chapterNumber),
    loadHeadings(),
    loadChapterIndex(bookCode, chapterNumber),
  ])

  if (!chapterData) return null

  const headings = allHeadings.filter(h => h.b === bookCode && h.c === chapterNumber)

  return {
    chapter: chapterData,
    headings,
    indexEntries: indexData || new Map(),
  }
}

/**
 * Search concordance for all verses containing a Strong's number
 * Uses pre-built concordance lookup file (O(1) lookup)
 */
export async function searchConcordance(strongsNumber: string): Promise<ConcordanceResult[]> {
  const concordance = await loadConcordance()
  if (!concordance) return []

  const normalized = strongsNumber.toUpperCase()
  const verseRefs = concordance.get(normalized)

  if (!verseRefs || verseRefs.length === 0) return []

  // Convert verse references to result objects
  // Reference format: "GEN.1.1"
  const results: ConcordanceResult[] = verseRefs.map(ref => {
    const [bookCode, chapter, verse] = ref.split('.')
    return {
      id: ref,
      bookCode,
      bookNumber: BOOK_NUMBERS[bookCode] || 0,
      chapter: parseInt(chapter),
      verse: parseInt(verse),
    }
  })

  // Already sorted in the concordance file, but ensure sort order
  return results.sort(
    (a, b) => a.bookNumber - b.bookNumber || a.chapter - b.chapter || a.verse - b.verse
  )
}

/**
 * Get cross-references for a specific verse
 */
export async function getCrossReferences(
  bookCode: string,
  chapter: number,
  verse: number
): Promise<string[]> {
  const entries = await loadChapterIndex(bookCode, chapter)
  if (!entries) return []

  const entry = entries.get(verse)
  return entry?.x || []
}

/**
 * Get index entry for a specific verse (includes Strong's, cross-refs, morphology)
 */
export async function getVerseIndex(
  bookCode: string,
  chapter: number,
  verse: number
): Promise<BSBIndexEntry | null> {
  const entries = await loadChapterIndex(bookCode, chapter)
  if (!entries) return null

  return entries.get(verse) || null
}

/**
 * Clear all caches (useful for testing or memory management)
 */
export function clearBSBCache(): void {
  chapterCache.clear()
  chapterIndexCache.clear()
  headingsCache = null
  concordanceCache = null
}
