/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useEffect, useState, useRef } from 'react'

import { getLexiconEntry, LexiconEntry, getStrongsLanguage } from '~helpers/strongsApi'
import {
  loadEnrichedBSBChapter,
  BSBChapter,
  BSBVerse,
  BSBHeading,
  BSBIndexEntry,
  getBookNumber,
  isOldTestament,
  searchConcordance,
  ConcordanceResult,
} from '~helpers/bsbDataApi'
import books from '~assets/bible_versions/books-desc'

// Color palette
const colors = {
  text: 'rgb(0,0,0)',
  background: 'rgb(255,255,255)',
  border: 'rgb(230,230,230)',
  backgroundAlt: '#F4F7FF',
  textMuted: 'rgba(0,0,0,0.5)',
  primary: 'rgb(89,131,240)',
  primaryLight: 'rgb(233, 243, 252)',
  secondary: 'rgb(98,113,122)',
  accent: 'rgb(194,40,57)',
}

// Text cleaning helpers
const PUNCTUATION_REGEX = /^[\s.,;:!?'"()\[\]\-—–׃׀]+$/
const SKIP_MARKERS_REGEX = /^[-–—]+$|^\.+\s*\.+\s*\.+$|^vvv$/
const isPunctuation = (text: string) => PUNCTUATION_REGEX.test(text)
const shouldSkipWord = (text: string, strongs: string | null) =>
  strongs && SKIP_MARKERS_REGEX.test(text.trim())
const cleanText = (text: string) => text.replace(/[\[\]{}]/g, '')

// Types
type DisplayMode = 'text' | 'strongs' | 'interlinear-compact' | 'interlinear-full'
type Screen = 'reader' | 'passageSelector' | 'concordance' | 'strongDetail'
type Testament = 'OT' | 'NT'

// Book abbreviations for compact display
const bookAbbrev: Record<number, string> = {
  1: 'Gen',
  2: 'Exo',
  3: 'Lev',
  4: 'Num',
  5: 'Deu',
  6: 'Jos',
  7: 'Jdg',
  8: 'Rut',
  9: '1Sa',
  10: '2Sa',
  11: '1Ki',
  12: '2Ki',
  13: '1Ch',
  14: '2Ch',
  15: 'Ezr',
  16: 'Neh',
  17: 'Est',
  18: 'Job',
  19: 'Psa',
  20: 'Pro',
  21: 'Ecc',
  22: 'Son',
  23: 'Isa',
  24: 'Jer',
  25: 'Lam',
  26: 'Eze',
  27: 'Dan',
  28: 'Hos',
  29: 'Joe',
  30: 'Amo',
  31: 'Oba',
  32: 'Jon',
  33: 'Mic',
  34: 'Nah',
  35: 'Hab',
  36: 'Zep',
  37: 'Hag',
  38: 'Zec',
  39: 'Mal',
  40: 'Mat',
  41: 'Mar',
  42: 'Luk',
  43: 'Joh',
  44: 'Act',
  45: 'Rom',
  46: '1Co',
  47: '2Co',
  48: 'Gal',
  49: 'Eph',
  50: 'Phi',
  51: 'Col',
  52: '1Th',
  53: '2Th',
  54: '1Ti',
  55: '2Ti',
  56: 'Tit',
  57: 'Phm',
  58: 'Heb',
  59: 'Jam',
  60: '1Pe',
  61: '2Pe',
  62: '1Jn',
  63: '2Jn',
  64: '3Jn',
  65: 'Jud',
  66: 'Rev',
}

// localStorage keys
const STORAGE_KEYS = {
  bookNumber: 'bsb-bookNumber',
  chapter: 'bsb-chapter',
  displayMode: 'bsb-displayMode',
  useHebrewWordOrder: 'bsb-useHebrewWordOrder',
}

// Helper to safely get from localStorage
const getStoredValue = <T,>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key)
    if (stored === null) return defaultValue
    return JSON.parse(stored) as T
  } catch {
    return defaultValue
  }
}

// Helper to save to localStorage
const setStoredValue = <T,>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore storage errors
  }
}

export default function App() {
  // Navigation state - initialized from localStorage
  const [screen, setScreen] = useState<Screen>('reader')
  const [bookNumber, setBookNumber] = useState(() => getStoredValue(STORAGE_KEYS.bookNumber, 1))
  const [chapter, setChapter] = useState(() => getStoredValue(STORAGE_KEYS.chapter, 1))

  // Display state - initialized from localStorage
  const [displayMode, setDisplayMode] = useState<DisplayMode>(() =>
    getStoredValue(STORAGE_KEYS.displayMode, 'text')
  )
  const [showModeDropdown, setShowModeDropdown] = useState(false)
  const [useHebrewWordOrder, setUseHebrewWordOrder] = useState(() =>
    getStoredValue(STORAGE_KEYS.useHebrewWordOrder, false)
  )

  // Passage selector state
  const [selectorTestament, setSelectorTestament] = useState<Testament>(() =>
    getStoredValue(STORAGE_KEYS.bookNumber, 1) <= 39 ? 'OT' : 'NT'
  )
  const [selectorBook, setSelectorBook] = useState<number | null>(null)

  // BSB data
  const [bsbData, setBsbData] = useState<BSBChapter | null>(null)
  const [bsbHeadings, setBsbHeadings] = useState<BSBHeading[]>([])
  const [bsbIndex, setBsbIndex] = useState<Map<number, BSBIndexEntry>>(new Map())
  const [loading, setLoading] = useState(true)

  // Lexicon state
  const [selectedStrongs, setSelectedStrongs] = useState<string | null>(null)
  const [lexiconEntry, setLexiconEntry] = useState<LexiconEntry | null>(null)
  const [showLexicon, setShowLexicon] = useState(false)

  // Concordance state
  const [concordanceStrong, setConcordanceStrong] = useState<string | null>(null)
  const [concordanceResults, setConcordanceResults] = useState<ConcordanceResult[]>([])
  const [concordanceLoading, setConcordanceLoading] = useState(false)

  // Swipe handling
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)
  const isSwiping = useRef(false)

  // Derived values
  const currentBook = books.find(b => b.id === bookNumber) || books[0]
  const isHebrew = isOldTestament(bookNumber)
  const isInterlinear = displayMode === 'interlinear-compact' || displayMode === 'interlinear-full'

  // Persist state to localStorage
  useEffect(() => {
    setStoredValue(STORAGE_KEYS.bookNumber, bookNumber)
    setStoredValue(STORAGE_KEYS.chapter, chapter)
    setStoredValue(STORAGE_KEYS.displayMode, displayMode)
    setStoredValue(STORAGE_KEYS.useHebrewWordOrder, useHebrewWordOrder)
  }, [bookNumber, chapter, displayMode, useHebrewWordOrder])

  // Default to Hebrew/Greek word order when switching to interlinear modes
  useEffect(() => {
    if (isInterlinear && !useHebrewWordOrder) {
      setUseHebrewWordOrder(true)
    }
  }, [displayMode])

  // Load BSB chapter data
  useEffect(() => {
    setLoading(true)
    loadEnrichedBSBChapter(bookNumber, chapter)
      .then(result => {
        if (result) {
          setBsbData(result.chapter)
          setBsbHeadings(result.headings)
          setBsbIndex(result.indexEntries)
        }
        setLoading(false)
      })
      .catch(err => {
        console.error('Error loading BSB data:', err)
        setLoading(false)
      })
  }, [bookNumber, chapter])

  // Load lexicon entry when Strong's number selected
  useEffect(() => {
    if (selectedStrongs) {
      getLexiconEntry(selectedStrongs)
        .then(entry => {
          setLexiconEntry(entry)
          setShowLexicon(true)
        })
        .catch(console.error)
    }
  }, [selectedStrongs])

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showModeDropdown) return
    const handleClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-dropdown]')) {
        setShowModeDropdown(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [showModeDropdown])

  // Navigation functions
  const goToPrevChapter = () => {
    if (chapter > 1) {
      setChapter(chapter - 1)
    } else if (bookNumber > 1) {
      const prevBook = books.find(b => b.id === bookNumber - 1)
      if (prevBook) {
        setBookNumber(bookNumber - 1)
        setChapter(prevBook.chapters)
      }
    }
  }

  const goToNextChapter = () => {
    if (chapter < currentBook.chapters) {
      setChapter(chapter + 1)
    } else if (bookNumber < 66) {
      setBookNumber(bookNumber + 1)
      setChapter(1)
    }
  }

  // Swipe handlers - only trigger on deliberate horizontal swipes
  const SWIPE_THRESHOLD = 100 // Minimum distance for a swipe

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchEndX.current = e.touches[0].clientX
    isSwiping.current = false
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX
    // Mark as swiping only if moved significantly
    if (Math.abs(touchEndX.current - touchStartX.current) > SWIPE_THRESHOLD) {
      isSwiping.current = true
    }
  }

  const handleTouchEnd = () => {
    // Only navigate if we detected a deliberate swipe
    if (isSwiping.current) {
      const diff = touchStartX.current - touchEndX.current
      if (diff > SWIPE_THRESHOLD) {
        goToNextChapter()
      } else if (diff < -SWIPE_THRESHOLD) {
        goToPrevChapter()
      }
    }
    isSwiping.current = false
  }

  // Lexicon functions
  const handleStrongsPress = (strongsNumber: string) => setSelectedStrongs(strongsNumber)

  const closeLexicon = () => {
    setShowLexicon(false)
    setSelectedStrongs(null)
    setLexiconEntry(null)
  }

  const openConcordance = async (strongsNumber: string) => {
    setConcordanceStrong(strongsNumber)
    setScreen('concordance')
    closeLexicon()
    setConcordanceLoading(true)
    try {
      const results = await searchConcordance(strongsNumber)
      setConcordanceResults(results)
    } catch (error) {
      console.error('Concordance search error:', error)
    }
    setConcordanceLoading(false)
  }

  // Display mode labels
  const modeLabels: Record<DisplayMode, string> = {
    text: 'Text',
    strongs: "Strong's Numbers",
    'interlinear-compact': `${isHebrew ? 'Hebrew' : 'Greek'} Compact`,
    'interlinear-full': `${isHebrew ? 'Hebrew' : 'Greek'} Full`,
  }

  // Render functions
  const renderVerse = (verse: BSBVerse) => {
    const isCompact = displayMode === 'interlinear-compact'
    const originalWords = verse.heb || verse.grk || []

    // Build original word lookup: Strong's -> original text
    const originalWordMap = new Map<string, string>()
    for (const [text, strongs] of originalWords) {
      if (strongs && !originalWordMap.has(strongs)) {
        originalWordMap.set(strongs, text)
      }
    }

    // Plain text mode
    if (displayMode === 'text') {
      return (
        <div key={verse.v} css={styles.verseRow}>
          <span css={styles.verseNumber}>{verse.v}</span>
          <span css={styles.verseText}>
            {verse.w.map(([text, strongs], idx) => {
              if (shouldSkipWord(text, strongs)) return null
              if (!strongs || isPunctuation(text)) return <span key={idx}>{text}</span>
              return (
                <span
                  key={idx}
                  css={styles.clickableWord}
                  onClick={() => handleStrongsPress(strongs)}
                >
                  {cleanText(text)}
                </span>
              )
            })}
          </span>
        </div>
      )
    }

    // Strong's inline mode
    if (displayMode === 'strongs') {
      return (
        <div key={verse.v} css={styles.verseRow}>
          <span css={styles.verseNumber}>{verse.v}</span>
          <div css={styles.strongsInline}>
            {verse.w.map(([text, strongs], idx) => {
              if (!strongs || isPunctuation(text)) return <span key={idx}>{text}</span>
              return (
                <span
                  key={idx}
                  css={styles.clickableWord}
                  onClick={() => handleStrongsPress(strongs)}
                >
                  <span>{text}</span>
                  <span css={styles.strongsTag}>{strongs}</span>
                </span>
              )
            })}
          </div>
        </div>
      )
    }

    // Interlinear mode - build word pairs
    type WordPair = { original: string; english: string; strongs: string }
    let wordPairs: WordPair[]

    if (useHebrewWordOrder && originalWords.length > 0) {
      // Original language word order
      const usedEnglishIndices = new Set<number>()
      wordPairs = originalWords
        .filter(([text, strongs]) => strongs && !isPunctuation(text))
        .map(([origText, strongs]) => {
          let englishText = ''
          for (let i = 0; i < verse.w.length; i++) {
            const [engText, engStrongs] = verse.w[i]
            if (engStrongs === strongs && !usedEnglishIndices.has(i)) {
              englishText = cleanText(engText)
              usedEnglishIndices.add(i)
              break
            }
          }
          return { original: origText, english: englishText, strongs: strongs! }
        })
    } else {
      // English word order
      wordPairs = verse.w
        .filter(
          ([text, strongs]) => strongs && !isPunctuation(text) && !shouldSkipWord(text, strongs)
        )
        .map(([text, strongs]) => ({
          original: originalWordMap.get(strongs!) || '',
          english: cleanText(text),
          strongs: strongs!,
        }))
    }

    return (
      <div key={verse.v} css={styles.verseRow}>
        <span css={styles.verseNumber}>{verse.v}</span>
        <div
          css={[styles.interlinearContent, useHebrewWordOrder && isHebrew && styles.hebrewOrder]}
        >
          {wordPairs.map((pair, idx) => (
            <button
              key={idx}
              css={[styles.wordCard, isCompact && styles.wordCardCompact]}
              onClick={() => handleStrongsPress(pair.strongs)}
            >
              {!isCompact && <span css={styles.strongsNum}>{pair.strongs}</span>}
              {pair.original && (
                <span css={[styles.originalWord, isCompact && styles.originalWordCompact]}>
                  {pair.original}
                </span>
              )}
              <span css={styles.englishWord}>{pair.english}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const renderHeading = (heading: BSBHeading) => (
    <div key={heading.id} css={[styles.heading, heading.level === 'r' && styles.headingRef]}>
      {heading.text}
    </div>
  )

  const renderCrossRefs = (verseNum: number) => {
    if (displayMode !== 'interlinear-full' || !bsbData) return null
    const crossRefs = bsbIndex.get(verseNum)?.x || []
    if (crossRefs.length === 0) return null

    return (
      <div css={styles.crossRefs}>
        {crossRefs.slice(0, 3).map((ref, idx) => (
          <button
            key={idx}
            css={styles.crossRefBtn}
            onClick={() => {
              const match = ref.match(/^([A-Z0-9]+)\.(\d+)\.(\d+)$/)
              if (match) {
                setBookNumber(getBookNumber(match[1]))
                setChapter(parseInt(match[2]))
              }
            }}
          >
            {ref.replace(/\./g, ' ').replace(/(\d+) (\d+)$/, '$1:$2')}
          </button>
        ))}
        {crossRefs.length > 3 && <span css={styles.crossRefMore}>+{crossRefs.length - 3}</span>}
      </div>
    )
  }

  const renderContent = () => {
    if (!bsbData) return null
    const elements: JSX.Element[] = []

    for (const verse of bsbData.verses) {
      // Headings before verse
      for (const h of bsbHeadings.filter(h => h.before_v === verse.v)) {
        elements.push(renderHeading(h))
      }
      elements.push(renderVerse(verse))
      const xrefs = renderCrossRefs(verse.v)
      if (xrefs)
        elements.push(
          <div key={`xref-${verse.v}`} css={styles.crossRefRow}>
            {xrefs}
          </div>
        )
    }
    return elements
  }

  // Lexicon modal
  const renderLexiconModal = () => {
    if (!lexiconEntry || !showLexicon) return null
    const langType = selectedStrongs ? getStrongsLanguage(selectedStrongs) : 'Hebrew'

    return (
      <>
        <div css={[styles.overlay, styles.overlayVisible]} onClick={closeLexicon} />
        <div css={[styles.bottomSheet, styles.bottomSheetVisible]}>
          <div css={styles.sheetHandle}>
            <div css={styles.handleBar} />
          </div>
          <div css={styles.sheetContent}>
            <div css={styles.sheetHeader}>
              <span
                css={[
                  styles.badge,
                  { backgroundColor: langType === 'Hebrew' ? colors.accent : colors.primary },
                ]}
              >
                {langType}
              </span>
              <span css={styles.strongsCode}>{selectedStrongs}</span>
              <button css={styles.closeBtn} onClick={closeLexicon}>
                ✕
              </button>
            </div>
            <div css={styles.lexWord}>{lexiconEntry.word}</div>
            <div css={styles.lexUnderline} />
            {lexiconEntry.translit && <div css={styles.lexTranslit}>{lexiconEntry.translit}</div>}
            {lexiconEntry.pron && <div css={styles.lexPron}>/{lexiconEntry.pron}/</div>}
            {lexiconEntry.gloss && (
              <div css={styles.lexSection}>
                <div css={styles.lexLabel}>Gloss</div>
                <div css={styles.lexGloss}>{lexiconEntry.gloss}</div>
              </div>
            )}
            {lexiconEntry.def && (
              <div css={styles.lexSection}>
                <div css={styles.lexLabel}>Definition</div>
                <div css={styles.lexDef}>{lexiconEntry.def}</div>
              </div>
            )}
            <div css={styles.sheetActions}>
              <button
                css={styles.actionBtn}
                onClick={() => {
                  setShowLexicon(false)
                  setScreen('strongDetail')
                }}
              >
                View Details
              </button>
              <button css={styles.actionBtn} onClick={() => openConcordance(selectedStrongs!)}>
                Concordance
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  // Combined passage selector screen
  if (screen === 'passageSelector') {
    const otBooks = books.filter(b => b.id <= 39)
    const ntBooks = books.filter(b => b.id > 39)
    const displayedBooks = selectorTestament === 'OT' ? otBooks : ntBooks
    const selectedBookData = selectorBook ? books.find(b => b.id === selectorBook) : null

    return (
      <div css={styles.container}>
        <div css={styles.header}>
          <button css={styles.backBtn} onClick={() => setScreen('reader')}>
            ← Back
          </button>
          <span css={styles.headerTitle}>Select Passage</span>
          <span css={styles.headerSpacer} />
        </div>
        <div css={styles.selectorContent}>
          {/* Testament tabs */}
          <div css={styles.testamentTabs}>
            <button
              css={[styles.testamentTab, selectorTestament === 'OT' && styles.testamentTabActive]}
              onClick={() => {
                setSelectorTestament('OT')
                setSelectorBook(null)
              }}
            >
              Old Testament
            </button>
            <button
              css={[styles.testamentTab, selectorTestament === 'NT' && styles.testamentTabActive]}
              onClick={() => {
                setSelectorTestament('NT')
                setSelectorBook(null)
              }}
            >
              New Testament
            </button>
          </div>

          {/* Book chips grid */}
          <div css={styles.bookChipsGrid}>
            {displayedBooks.map(book => (
              <button
                key={book.id}
                css={[
                  styles.bookChip,
                  book.id === selectorBook && styles.bookChipSelected,
                  book.id === bookNumber && styles.bookChipCurrent,
                ]}
                onClick={() => setSelectorBook(selectorBook === book.id ? null : book.id)}
              >
                {bookAbbrev[book.id]}
              </button>
            ))}
          </div>

          {/* Chapter grid (shown when book selected) */}
          {selectedBookData && (
            <div css={styles.chapterSection}>
              <div css={styles.chapterSectionHeader}>
                <span css={styles.chapterSectionTitle}>{selectedBookData.name}</span>
                <span css={styles.chapterSectionMeta}>{selectedBookData.chapters} chapters</span>
              </div>
              <div css={styles.chapterGrid}>
                {Array.from({ length: selectedBookData.chapters }, (_, i) => i + 1).map(ch => (
                  <button
                    key={ch}
                    css={[
                      styles.chapterItem,
                      selectorBook === bookNumber && ch === chapter && styles.chapterItemCurrent,
                    ]}
                    onClick={() => {
                      setBookNumber(selectorBook!)
                      setChapter(ch)
                      setScreen('reader')
                    }}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Concordance screen
  if (screen === 'concordance') {
    return (
      <div css={styles.container}>
        <div css={styles.header}>
          <button css={styles.backBtn} onClick={() => setScreen('reader')}>
            ← Back
          </button>
          <span css={styles.headerTitle}>Concordance {concordanceStrong}</span>
          <span css={styles.headerSpacer} />
        </div>
        <div css={styles.list}>
          {concordanceLoading && <div css={styles.loading}>Searching...</div>}
          {!concordanceLoading && concordanceResults.length === 0 && (
            <div css={styles.empty}>No verses found</div>
          )}
          {concordanceResults.map((result, idx) => {
            const book = books.find(b => b.id === result.bookNumber)
            return (
              <button
                key={idx}
                css={styles.listItem}
                onClick={() => {
                  setBookNumber(result.bookNumber)
                  setChapter(result.chapter)
                  setScreen('reader')
                }}
              >
                <span css={styles.concordanceRef}>
                  {book?.name || result.bookCode} {result.chapter}:{result.verse}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // Strong's detail screen
  if (screen === 'strongDetail' && lexiconEntry) {
    const langType = selectedStrongs ? getStrongsLanguage(selectedStrongs) : 'Hebrew'
    return (
      <div css={styles.container}>
        <div css={styles.header}>
          <button css={styles.backBtn} onClick={() => setScreen('reader')}>
            ← Back
          </button>
          <span css={styles.headerTitle}>{lexiconEntry.word}</span>
          <span
            css={[
              styles.badge,
              { backgroundColor: langType === 'Hebrew' ? colors.accent : colors.primary },
            ]}
          >
            {langType}
          </span>
        </div>
        <div css={styles.detailContent}>
          <div css={styles.strongsCode}>{selectedStrongs}</div>
          {lexiconEntry.translit && <div css={styles.lexTranslit}>{lexiconEntry.translit}</div>}
          {lexiconEntry.pron && <div css={styles.lexPron}>/{lexiconEntry.pron}/</div>}
          {lexiconEntry.gloss && (
            <div css={styles.lexSection}>
              <div css={styles.lexLabel}>Gloss</div>
              <div css={styles.lexGloss}>{lexiconEntry.gloss}</div>
            </div>
          )}
          {lexiconEntry.morph && (
            <div css={styles.lexSection}>
              <div css={styles.lexLabel}>Morphology</div>
              <div css={styles.lexMorph}>{lexiconEntry.morph}</div>
            </div>
          )}
          {lexiconEntry.def && (
            <div css={styles.lexSection}>
              <div css={styles.lexLabel}>Definition</div>
              <div css={styles.lexDef}>{lexiconEntry.def}</div>
            </div>
          )}
          {lexiconEntry.stepDef && (
            <div css={styles.lexSection}>
              <div css={styles.lexLabel}>Extended</div>
              <div css={styles.lexStepDef}>{lexiconEntry.stepDef}</div>
            </div>
          )}
          {lexiconEntry.kjv && (
            <div css={styles.lexSection}>
              <div css={styles.lexLabel}>KJV</div>
              <div css={styles.lexKjv}>{lexiconEntry.kjv}</div>
            </div>
          )}
          <button css={styles.primaryBtn} onClick={() => openConcordance(selectedStrongs!)}>
            View Concordance
          </button>
        </div>
      </div>
    )
  }

  // Main reader view
  return (
    <div css={styles.container}>
      {renderLexiconModal()}

      {/* Header */}
      <div css={styles.header}>
        <button
          css={styles.navBtn}
          onClick={() => {
            setSelectorTestament(bookNumber <= 39 ? 'OT' : 'NT')
            setSelectorBook(bookNumber)
            setScreen('passageSelector')
          }}
        >
          {currentBook.name} {chapter}
        </button>
        <span css={styles.headerSpacer} />
      </div>

      {/* Toolbar */}
      <div css={styles.toolbar}>
        <div css={styles.dropdown} data-dropdown>
          <button
            css={[styles.dropdownBtn, displayMode !== 'text' && styles.dropdownBtnActive]}
            onClick={() => setShowModeDropdown(!showModeDropdown)}
          >
            {modeLabels[displayMode]} <span css={styles.arrow}>{showModeDropdown ? '▲' : '▼'}</span>
          </button>
          {showModeDropdown && (
            <div css={styles.dropdownMenu}>
              {(Object.keys(modeLabels) as DisplayMode[]).map(mode => (
                <button
                  key={mode}
                  css={[styles.dropdownItem, displayMode === mode && styles.dropdownItemActive]}
                  onClick={() => {
                    setDisplayMode(mode)
                    setShowModeDropdown(false)
                  }}
                >
                  {modeLabels[mode]}
                </button>
              ))}
            </div>
          )}
        </div>
        {loading && <span css={styles.loadingText}>Loading...</span>}
        {isHebrew && isInterlinear && (
          <button
            css={[styles.toggleBtn, useHebrewWordOrder && styles.toggleBtnActive]}
            onClick={() => setUseHebrewWordOrder(!useHebrewWordOrder)}
          >
            {useHebrewWordOrder ? '← עב' : 'EN →'}
          </button>
        )}
      </div>

      {/* Content */}
      <div
        css={styles.content}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {loading ? (
          <div css={styles.centered}>
            <div css={styles.loadingText}>Loading...</div>
          </div>
        ) : bsbData ? (
          renderContent()
        ) : (
          <div css={styles.centered}>
            <div css={styles.errorText}>Failed to load chapter</div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div css={styles.footer}>
        <button
          css={styles.footerBtn}
          onClick={goToPrevChapter}
          disabled={bookNumber === 1 && chapter === 1}
        >
          ← Prev
        </button>
        <span css={styles.footerInfo}>
          {chapter} / {currentBook.chapters}
        </span>
        <button
          css={styles.footerBtn}
          onClick={goToNextChapter}
          disabled={bookNumber === 66 && chapter === currentBook.chapters}
        >
          Next →
        </button>
      </div>
    </div>
  )
}

// Styles with hardcoded colors
const styles = {
  // Layout
  container: css({
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: colors.backgroundAlt,
    color: colors.text,
  }),
  header: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: `1px solid ${colors.border}`,
    backgroundColor: colors.background,
    minHeight: 54,
  }),
  toolbar: css({
    display: 'flex',
    alignItems: 'center',
    padding: '8px 16px',
    backgroundColor: colors.background,
    borderBottom: `1px solid ${colors.border}`,
    gap: 10,
  }),
  content: css({ flex: 1, overflow: 'auto', padding: 16, touchAction: 'pan-y' }),
  footer: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 16px',
    borderTop: `1px solid ${colors.border}`,
    backgroundColor: colors.background,
  }),
  centered: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  }),

  // Header buttons
  navBtn: css({
    fontSize: 15,
    color: colors.primary,
    fontWeight: 500,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 0',
    '&:hover': { opacity: 0.8 },
  }),
  backBtn: css({
    fontSize: 15,
    color: colors.primary,
    fontWeight: 500,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  }),
  headerTitle: css({ fontSize: 17, fontWeight: 600, color: colors.text }),
  headerSpacer: css({ width: 60 }),

  // Dropdown
  dropdown: css({ position: 'relative' }),
  dropdownBtn: css({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    borderRadius: 16,
    backgroundColor: colors.backgroundAlt,
    color: colors.secondary,
    fontSize: 13,
    fontWeight: 500,
    border: `1px solid ${colors.border}`,
    cursor: 'pointer',
    '&:hover': { backgroundColor: colors.primaryLight },
  }),
  dropdownBtnActive: css({
    backgroundColor: colors.primaryLight,
    color: colors.primary,
    borderColor: colors.primary,
  }),
  arrow: css({ fontSize: 8, marginLeft: 2 }),
  dropdownMenu: css({
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: 4,
    backgroundColor: colors.background,
    borderRadius: 8,
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    border: `1px solid ${colors.border}`,
    overflow: 'hidden',
    zIndex: 100,
    minWidth: 160,
  }),
  dropdownItem: css({
    display: 'block',
    width: '100%',
    padding: '10px 14px',
    fontSize: 13,
    color: colors.text,
    backgroundColor: 'transparent',
    border: 'none',
    textAlign: 'left',
    cursor: 'pointer',
    '&:hover': { backgroundColor: colors.backgroundAlt },
  }),
  dropdownItemActive: css({
    backgroundColor: colors.primaryLight,
    color: colors.primary,
    fontWeight: 600,
  }),

  // Toggle button
  toggleBtn: css({
    padding: '4px 10px',
    borderRadius: 12,
    backgroundColor: colors.backgroundAlt,
    color: colors.secondary,
    fontSize: 12,
    fontWeight: 600,
    border: `1px solid ${colors.border}`,
    cursor: 'pointer',
    minWidth: 52,
    '&:hover': { backgroundColor: colors.primaryLight },
  }),
  toggleBtnActive: css({
    backgroundColor: colors.primaryLight,
    color: colors.primary,
    borderColor: colors.primary,
  }),

  // Loading/Error
  loadingText: css({ fontSize: 12, color: colors.textMuted }),
  errorText: css({ fontSize: 16, color: colors.accent }),

  // Verse display
  verseRow: css({ display: 'flex', marginBottom: 12 }),
  verseNumber: css({
    width: 30,
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: 600,
    paddingTop: 3,
    flexShrink: 0,
  }),
  verseText: css({ flex: 1, fontSize: 17, lineHeight: 1.65, color: colors.text }),
  clickableWord: css({
    cursor: 'pointer',
    borderRadius: 2,
    transition: 'background-color 0.15s',
    '&:hover': { backgroundColor: colors.primaryLight },
  }),

  // Strong's inline mode
  strongsInline: css({ flex: 1, lineHeight: 1.8 }),
  strongsTag: css({
    display: 'inline',
    padding: '1px 4px',
    marginLeft: 1,
    marginRight: 2,
    fontSize: 10,
    fontWeight: 600,
    color: colors.primary,
    backgroundColor: colors.primaryLight,
    borderRadius: 3,
    border: 'none',
    cursor: 'pointer',
    verticalAlign: 'super',
    '&:hover': { backgroundColor: colors.primary, color: '#fff' },
  }),

  // Interlinear mode
  interlinearContent: css({
    flex: 1,
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 3,
  }),
  hebrewOrder: css({ direction: 'rtl' }),
  wordCard: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '3px 5px',
    backgroundColor: colors.primaryLight,
    borderRadius: 4,
    border: 'none',
    cursor: 'pointer',
    marginBottom: 6,
    transition: 'all 0.15s',
    '&:hover': { backgroundColor: colors.primary, '& span': { color: '#fff' } },
  }),
  wordCardCompact: css({ padding: '2px 4px', marginBottom: 4 }),
  strongsNum: css({ fontSize: 9, color: colors.secondary, fontWeight: 600, opacity: 0.5 }),
  originalWord: css({ fontSize: 16, color: colors.primary, fontWeight: 500, marginTop: 2 }),
  originalWordCompact: css({ fontSize: 14, marginTop: 0 }),
  englishWord: css({ color: colors.primary }),

  // Headings
  heading: css({
    paddingLeft: 30,
    paddingTop: 20,
    paddingBottom: 10,
    fontSize: 18,
    fontWeight: 700,
    color: colors.text,
  }),
  headingRef: css({
    fontSize: 13,
    fontStyle: 'italic',
    color: colors.secondary,
    fontWeight: 400,
    paddingTop: 4,
  }),

  // Cross-references
  crossRefRow: css({ paddingLeft: 30, paddingBottom: 8 }),
  crossRefs: css({ display: 'flex', flexWrap: 'wrap', gap: 6 }),
  crossRefBtn: css({
    padding: '2px 6px',
    fontSize: 11,
    fontWeight: 500,
    color: colors.secondary,
    backgroundColor: colors.backgroundAlt,
    border: `1px solid ${colors.border}`,
    borderRadius: 4,
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: colors.primaryLight,
      color: colors.primary,
      borderColor: colors.primary,
    },
  }),
  crossRefMore: css({ fontSize: 11, color: colors.textMuted, fontStyle: 'italic' }),

  // Footer
  footerBtn: css({
    padding: '8px 14px',
    fontSize: 15,
    color: colors.primary,
    fontWeight: 500,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    '&:disabled': { opacity: 0.3, cursor: 'not-allowed' },
  }),
  footerInfo: css({ fontSize: 14, color: colors.textMuted }),

  // List screens
  list: css({ flex: 1, overflow: 'auto' }),
  listItem: css({
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    padding: '14px 20px',
    borderBottom: `1px solid ${colors.border}`,
    backgroundColor: colors.background,
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    '&:hover': { backgroundColor: colors.backgroundAlt },
  }),
  loading: css({ padding: 20, textAlign: 'center', color: colors.secondary }),
  empty: css({ padding: 40, textAlign: 'center', color: colors.textMuted }),

  // Concordance
  concordanceRef: css({ fontSize: 15, fontWeight: 600, color: colors.primary }),

  // Bottom sheet / Modal
  overlay: css({
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0)',
    zIndex: 999,
    pointerEvents: 'none',
    transition: 'background-color 0.3s',
  }),
  overlayVisible: css({ backgroundColor: 'rgba(0,0,0,0.4)', pointerEvents: 'auto' }),
  bottomSheet: css({
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    zIndex: 1000,
    transform: 'translateY(100%)',
    transition: 'transform 0.3s',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
  }),
  bottomSheetVisible: css({ transform: 'translateY(0)' }),
  sheetHandle: css({ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }),
  handleBar: css({ width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2 }),
  sheetContent: css({ padding: '0 20px 20px', overflow: 'auto', flex: 1 }),
  sheetHeader: css({ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }),
  sheetActions: css({
    display: 'flex',
    gap: 10,
    marginTop: 16,
    paddingTop: 12,
    borderTop: `1px solid ${colors.border}`,
  }),

  // Lexicon
  badge: css({
    padding: '2px 8px',
    borderRadius: 10,
    fontSize: 10,
    fontWeight: 600,
    color: '#fff',
  }),
  strongsCode: css({ fontSize: 13, fontWeight: 600, color: colors.secondary }),
  closeBtn: css({
    marginLeft: 'auto',
    padding: 4,
    fontSize: 18,
    color: colors.textMuted,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  }),
  lexWord: css({ fontSize: 28, fontWeight: 600, color: colors.primary, marginBottom: 4 }),
  lexUnderline: css({ width: 35, height: 3, backgroundColor: colors.primary, marginBottom: 10 }),
  lexTranslit: css({ fontSize: 16, color: colors.secondary, fontStyle: 'italic' }),
  lexPron: css({ fontSize: 14, color: colors.textMuted, marginBottom: 12 }),
  lexSection: css({ marginTop: 12 }),
  lexLabel: css({
    fontSize: 11,
    fontWeight: 700,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 3,
  }),
  lexGloss: css({ fontSize: 16, fontWeight: 600, color: colors.primary }),
  lexDef: css({ fontSize: 15, color: colors.text, lineHeight: 1.5 }),
  lexMorph: css({ fontSize: 14, color: colors.secondary, fontFamily: 'monospace' }),
  lexStepDef: css({ fontSize: 13, color: colors.secondary, lineHeight: 1.5 }),
  lexKjv: css({ fontSize: 14, color: colors.secondary }),
  actionBtn: css({
    flex: 1,
    padding: '10px 12px',
    fontSize: 13,
    fontWeight: 600,
    color: colors.primary,
    backgroundColor: colors.primaryLight,
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    '&:hover': { opacity: 0.9 },
  }),

  // Detail screen
  detailContent: css({ flex: 1, overflow: 'auto', padding: 20 }),
  primaryBtn: css({
    width: '100%',
    padding: 14,
    fontSize: 15,
    fontWeight: 600,
    color: '#fff',
    backgroundColor: colors.primary,
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    marginTop: 20,
    '&:hover': { opacity: 0.9 },
  }),

  // Passage selector
  selectorContent: css({
    flex: 1,
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
  }),
  testamentTabs: css({
    display: 'flex',
    padding: '12px 16px',
    gap: 8,
    backgroundColor: colors.background,
    borderBottom: `1px solid ${colors.border}`,
  }),
  testamentTab: css({
    flex: 1,
    padding: '10px 16px',
    fontSize: 14,
    fontWeight: 600,
    color: colors.secondary,
    backgroundColor: colors.backgroundAlt,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.15s',
    '&:hover': { backgroundColor: colors.primaryLight },
  }),
  testamentTabActive: css({
    color: colors.primary,
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  }),
  bookChipsGrid: css({
    display: 'flex',
    flexWrap: 'wrap',
    padding: 12,
    gap: 6,
    backgroundColor: colors.background,
  }),
  bookChip: css({
    padding: '8px 12px',
    fontSize: 13,
    fontWeight: 500,
    color: colors.text,
    backgroundColor: colors.backgroundAlt,
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'all 0.15s',
    '&:hover': { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  }),
  bookChipSelected: css({
    color: '#fff',
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  }),
  bookChipCurrent: css({
    fontWeight: 700,
    borderColor: colors.primary,
    borderWidth: 2,
  }),
  chapterSection: css({
    padding: 16,
    backgroundColor: colors.backgroundAlt,
    borderTop: `1px solid ${colors.border}`,
    flex: 1,
  }),
  chapterSectionHeader: css({
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 12,
  }),
  chapterSectionTitle: css({
    fontSize: 18,
    fontWeight: 700,
    color: colors.text,
  }),
  chapterSectionMeta: css({
    fontSize: 13,
    color: colors.textMuted,
  }),
  chapterGrid: css({
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  }),
  chapterItem: css({
    width: 44,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 15,
    fontWeight: 500,
    color: colors.text,
    backgroundColor: colors.background,
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'all 0.15s',
    '&:hover': { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  }),
  chapterItemCurrent: css({
    color: colors.primary,
    fontWeight: 700,
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  }),
}
