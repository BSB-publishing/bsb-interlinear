// BSB Data API - loads pre-generated BSB Bible data with Strong's numbers
// Data source: /public/bsb-data/base/

// Book code mapping
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

const BOOK_NUMBERS: Record<string, number> = Object.fromEntries(
  Object.entries(BOOK_CODES).map(([num, code]) => [code, parseInt(num)])
)

// Types
export type BSBWord = [string, string | null] // [text, strongs_number]

export type BSBVerse = {
  b: string
  c: number
  v: number
  w: BSBWord[]
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

export type BSBIndexEntry = {
  id: string
  b: string
  c: number
  v: number
  t: string
  s: string[]
  x: string[]
  m?: BSBMorphEntry[]
}

export type ConcordanceResult = {
  bookCode: string
  bookNumber: number
  chapter: number
  verse: number
  text: string
}

// Cache
const bookCache = new Map<string, BSBVerse[]>()
const indexCache = new Map<string, BSBIndexEntry>()
let headingsCache: BSBHeading[] | null = null
let indexLoaded = false

const BSB_DATA_BASE = '/bsb-data/base'

// Load book display data
async function loadBookData(bookCode: string): Promise<BSBVerse[]> {
  if (bookCache.has(bookCode)) return bookCache.get(bookCode)!

  try {
    const response = await fetch(`${BSB_DATA_BASE}/display/${bookCode}.jsonl`)
    if (!response.ok) return []

    const text = await response.text()
    const verses: BSBVerse[] = text
      .trim()
      .split('\n')
      .map(line => JSON.parse(line))
    bookCache.set(bookCode, verses)
    return verses
  } catch (error) {
    console.error(`Error loading book ${bookCode}:`, error)
    return []
  }
}

// Load headings
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

// Load index (cross-refs, morphology)
async function loadIndex(): Promise<void> {
  if (indexLoaded) return

  try {
    const response = await fetch(`${BSB_DATA_BASE}/index-cc-by/bible-index.jsonl`)
    if (!response.ok) return

    const text = await response.text()
    for (const line of text.trim().split('\n')) {
      const entry: BSBIndexEntry = JSON.parse(line)
      indexCache.set(entry.id, entry)
    }
    indexLoaded = true
  } catch (error) {
    console.error('Error loading index:', error)
  }
}

// Load enriched chapter data
export async function loadEnrichedBSBChapter(
  bookNumber: number,
  chapterNumber: number
): Promise<{
  chapter: BSBChapter
  headings: BSBHeading[]
  indexEntries: Map<string, BSBIndexEntry>
} | null> {
  const bookCode = BOOK_CODES[bookNumber]
  if (!bookCode) return null

  const [bookData, allHeadings] = await Promise.all([
    loadBookData(bookCode),
    loadHeadings(),
    loadIndex(),
  ])

  const chapterVerses = bookData.filter(v => v.c === chapterNumber)
  if (chapterVerses.length === 0) return null

  const headings = allHeadings.filter(h => h.b === bookCode && h.c === chapterNumber)

  const chapterIndex = new Map<string, BSBIndexEntry>()
  indexCache.forEach((entry, key) => {
    if (entry.b === bookCode && entry.c === chapterNumber) {
      chapterIndex.set(key, entry)
    }
  })

  return {
    chapter: { book: bookCode, chapter: chapterNumber, verses: chapterVerses },
    headings,
    indexEntries: chapterIndex,
  }
}

// Search concordance
export async function searchConcordance(strongsNumber: string): Promise<ConcordanceResult[]> {
  await loadIndex()

  const normalized = strongsNumber.toUpperCase()
  const isHebrew = normalized.startsWith('H')
  const results: ConcordanceResult[] = []

  indexCache.forEach(entry => {
    const bookNum = BOOK_NUMBERS[entry.b] || 0
    const isOT = bookNum >= 1 && bookNum <= 39

    if (isHebrew !== isOT) return

    if (entry.s?.includes(normalized)) {
      results.push({
        bookCode: entry.b,
        bookNumber: bookNum,
        chapter: entry.c,
        verse: entry.v,
        text: entry.t,
      })
    }
  })

  return results.sort(
    (a, b) => a.bookNumber - b.bookNumber || a.chapter - b.chapter || a.verse - b.verse
  )
}

// Utility functions
export function getBookNumber(bookCode: string): number {
  return BOOK_NUMBERS[bookCode] || 1
}

export function isOldTestament(bookNumber: number): boolean {
  return bookNumber >= 1 && bookNumber <= 39
}
