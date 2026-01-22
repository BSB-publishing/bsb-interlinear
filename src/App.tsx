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
  getBookCode,
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
type PaneType = 'image' | 'map' | null

// UBS image URL pattern
const UBS_IMAGE_BASE = 'https://github.com/ubsicap/ubs-open-license/raw/main/images'

// Helper to format parallel passage reference for display
const formatParallelRef = (ref: string): string => {
  // ref format: "GEN.5.2" -> "Gen 5:2"
  const parts = ref.split('.')
  if (parts.length !== 3) return ref
  const [bookCode, chapter, verse] = parts
  // Find book number and use abbreviation
  const bookNum = Object.entries(bookAbbrev).find(([num]) => {
    const code = getBookCode(parseInt(num))
    return code === bookCode
  })
  const abbr = bookNum ? bookNum[1] : bookCode
  return `${abbr} ${chapter}:${verse}`
}

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
  const [selectedVerseNum, setSelectedVerseNum] = useState<number | null>(null)
  const [lexiconEntry, setLexiconEntry] = useState<LexiconEntry | null>(null)
  const [showLexicon, setShowLexicon] = useState(false)

  // Concordance state
  const [concordanceStrong, setConcordanceStrong] = useState<string | null>(null)
  const [concordanceResults, setConcordanceResults] = useState<ConcordanceResult[]>([])
  const [concordanceLoading, setConcordanceLoading] = useState(false)

  // Image/Map pane state
  const [activePane, setActivePane] = useState<PaneType>(null)
  const [paneImages, setPaneImages] = useState<string[]>([])
  const [paneImageIndex, setPaneImageIndex] = useState(0)
  const [paneMapCoords, setPaneMapCoords] = useState<string[]>([])
  const [paneVerseRef, setPaneVerseRef] = useState<string>('')

  // Verse footer expand state
  const [expandedVerses, setExpandedVerses] = useState<Set<number>>(new Set())

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
  const handleStrongsPress = (strongsNumber: string, verseNum?: number) => {
    setSelectedStrongs(strongsNumber)
    setSelectedVerseNum(verseNum ?? null)
  }

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

  // Image/Map pane functions
  // @ts-ignore - kept for future use when images are hosted
  const _openImagePane = (images: string[], verseNum: number) => {
    setPaneImages(images)
    setPaneImageIndex(0)
    setPaneVerseRef(`${currentBook.name} ${chapter}:${verseNum}`)
    setActivePane('image')
  }

  const openMapPane = (coords: string[], verseNum: number) => {
    setPaneMapCoords(coords)
    setPaneVerseRef(`${currentBook.name} ${chapter}:${verseNum}`)
    setActivePane('map')
  }

  const closePane = () => {
    setActivePane(null)
    setPaneImages([])
    setPaneMapCoords([])
    setPaneImageIndex(0)
  }

  const toggleVerseExpand = (verseNum: number) => {
    setExpandedVerses(prev => {
      const next = new Set(prev)
      if (next.has(verseNum)) next.delete(verseNum)
      else next.add(verseNum)
      return next
    })
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
                  onClick={() => handleStrongsPress(strongs, verse.v)}
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
                  onClick={() => handleStrongsPress(strongs, verse.v)}
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

    // Get index entry for footer data in full mode
    const indexEntry = displayMode === 'interlinear-full' ? bsbIndex.get(verse.v) : null
    const hasImages = indexEntry?.img && indexEntry.img.length > 0
    const hasMap = indexEntry?.map && indexEntry.map.length > 0
    const hasTopics = indexEntry?.tp && indexEntry.tp.length > 0
    const hasParallels = indexEntry?.par && indexEntry.par.length > 0
    const hasCrossRefs = indexEntry?.x && indexEntry.x.length > 0
    const hasExpandableContent = hasTopics || hasParallels || hasCrossRefs
    const showFooter =
      displayMode === 'interlinear-full' && (hasImages || hasMap || hasExpandableContent)

    return (
      <div key={verse.v} css={styles.verseRow}>
        <span css={styles.verseNumber}>{verse.v}</span>
        <div css={styles.interlinearWrapper}>
          <div
            css={[styles.interlinearContent, useHebrewWordOrder && isHebrew && styles.hebrewOrder]}
          >
            {wordPairs.map((pair, idx) => (
              <button
                key={idx}
                css={[styles.wordCard, isCompact && styles.wordCardCompact]}
                onClick={() => handleStrongsPress(pair.strongs, verse.v)}
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
          {showFooter && (
            <div css={styles.verseFooter}>
              {/* Line 1: Map icon + expand toggle */}
              <div css={styles.footerIconRow}>
                {/* Images disabled until hosted locally
                {hasImages && (
                  <button
                    css={styles.footerIcon}
                    onClick={() => _openImagePane(indexEntry!.img!, verse.v)}
                    title="View images"
                  >
                    📷
                  </button>
                )}
                */}
                {hasMap && (
                  <button
                    css={styles.footerIcon}
                    onClick={() => openMapPane(indexEntry!.map!, verse.v)}
                    title="View on map"
                  >
                    📍
                  </button>
                )}
                {hasExpandableContent && (
                  <button
                    css={styles.expandIcon}
                    onClick={() => toggleVerseExpand(verse.v)}
                    title={
                      expandedVerses.has(verse.v) ? 'Hide details' : 'Show references & topics'
                    }
                  >
                    {expandedVerses.has(verse.v) ? '▲' : '▼'}
                  </button>
                )}
              </div>
              {/* Expanded content: Topics, Cross-refs & Parallels */}
              {expandedVerses.has(verse.v) && (
                <>
                  {/* Nave's Topics */}
                  {hasTopics && (
                    <div css={styles.expandedTopics}>{indexEntry!.tp!.join(' • ')}</div>
                  )}
                  {/* Cross-references */}
                  {hasCrossRefs && (
                    <div css={styles.expandedRefs}>
                      {indexEntry!.x!.map((ref, idx) => (
                        <button
                          key={idx}
                          css={styles.expandedRefBtn}
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
                    </div>
                  )}
                  {/* Parallel passages */}
                  {hasParallels && (
                    <div css={styles.expandedSection}>
                      <span css={styles.expandedLabel}>Parallels:</span>
                      <div css={styles.expandedRefs}>
                        {indexEntry!.par!.map((ref, idx) => (
                          <button
                            key={idx}
                            css={styles.expandedRefBtn}
                            onClick={() => {
                              const parts = ref.split('.')
                              if (parts.length === 3) {
                                setBookNumber(getBookNumber(parts[0]))
                                setChapter(parseInt(parts[1]))
                              }
                            }}
                          >
                            {formatParallelRef(ref)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderHeading = (heading: BSBHeading) => (
    <div key={heading.id} css={[styles.heading, heading.level === 'r' && styles.headingRef]}>
      {heading.text}
    </div>
  )

  // Cross-refs now rendered inside verse footer when expanded

  const renderContent = () => {
    if (!bsbData) return null
    const elements: JSX.Element[] = []

    for (const verse of bsbData.verses) {
      // Headings before verse
      for (const h of bsbHeadings.filter(h => h.before_v === verse.v)) {
        elements.push(renderHeading(h))
      }
      elements.push(renderVerse(verse))
    }
    return elements
  }

  // Image pane
  const renderImagePane = () => {
    if (activePane !== 'image' || paneImages.length === 0) return null
    const currentImage = paneImages[paneImageIndex]
    const imageUrl = `${UBS_IMAGE_BASE}/${currentImage}.jpg`
    // Format image name for display (e.g., "WEB-0195_the_earth" -> "The Earth")
    const imageName = currentImage
      .replace(/^WEB-\d+_/, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())

    return (
      <div css={styles.paneOverlay}>
        <div css={styles.pane}>
          <div css={styles.paneHeader}>
            <span css={styles.paneTitle}>Images</span>
            <button css={styles.paneCloseBtn} onClick={closePane}>
              ✕
            </button>
          </div>
          <div css={styles.paneContent}>
            <div css={styles.imageContainer}>
              <img
                src={imageUrl}
                alt={imageName}
                css={styles.paneImage}
                onError={e => {
                  const img = e.target as HTMLImageElement
                  img.style.display = 'none'
                }}
              />
            </div>
            <div css={styles.imageCaption}>
              "{imageName}" — {paneVerseRef}
            </div>
            {paneImages.length > 1 && (
              <div css={styles.imageNav}>
                <button
                  css={styles.imageNavBtn}
                  onClick={() => setPaneImageIndex(Math.max(0, paneImageIndex - 1))}
                  disabled={paneImageIndex === 0}
                >
                  ← Prev
                </button>
                <span css={styles.imageNavInfo}>
                  {paneImageIndex + 1} of {paneImages.length}
                </span>
                <button
                  css={styles.imageNavBtn}
                  onClick={() =>
                    setPaneImageIndex(Math.min(paneImages.length - 1, paneImageIndex + 1))
                  }
                  disabled={paneImageIndex === paneImages.length - 1}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
          <div css={styles.paneAttribution}>Images from United Bible Societies (CC-BY-SA 4.0)</div>
        </div>
      </div>
    )
  }

  // Map pane
  const renderMapPane = () => {
    if (activePane !== 'map' || paneMapCoords.length === 0) return null
    const coords = paneMapCoords[0] // Use first coordinate
    const [lat, lng] = coords.split(',')
    const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`

    return (
      <div css={styles.paneOverlay}>
        <div css={styles.pane}>
          <div css={styles.paneHeader}>
            <span css={styles.paneTitle}>Map</span>
            <button css={styles.paneCloseBtn} onClick={closePane}>
              ✕
            </button>
          </div>
          <div css={styles.paneContent}>
            <div css={styles.mapContainer}>
              <div css={styles.mapPlaceholder}>
                <span css={styles.mapPin}>📍</span>
                <div css={styles.mapCoords}>
                  {lat}, {lng}
                </div>
              </div>
            </div>
            <div css={styles.mapCaption}>Location from {paneVerseRef}</div>
            <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" css={styles.mapLink}>
              Open in Google Maps →
            </a>
            {paneMapCoords.length > 1 && (
              <div css={styles.mapExtra}>
                +{paneMapCoords.length - 1} more location{paneMapCoords.length > 2 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Lexicon modal
  const renderLexiconModal = () => {
    if (!lexiconEntry || !showLexicon) return null
    const langType = selectedStrongs ? getStrongsLanguage(selectedStrongs) : 'Hebrew'

    // Get word sense and domain data from the verse index
    const verseIndex = selectedVerseNum ? bsbIndex.get(selectedVerseNum) : null

    // Find word sense for this Strong's number
    let wordSenseGloss: string | null = null
    if (verseIndex?.ws && selectedStrongs) {
      const wsEntries = Object.values(verseIndex.ws)
      const matchingWs = wsEntries.find(ws => ws.s === selectedStrongs)
      if (matchingWs && matchingWs.gl && matchingWs.gl !== '-') {
        wordSenseGloss = matchingWs.gl
      }
    }

    // Get semantic domains
    const domains = verseIndex?.dom || []

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
            {/* Word sense - context-specific meaning */}
            {wordSenseGloss && (
              <div css={styles.lexSection}>
                <div css={styles.lexLabel}>In This Verse</div>
                <div css={styles.lexWordSense}>{wordSenseGloss}</div>
              </div>
            )}
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
            {/* Semantic domains */}
            {domains.length > 0 && (
              <div css={styles.lexSection}>
                <div css={styles.lexLabel}>Semantic Domains</div>
                <div css={styles.lexDomains}>
                  {domains.slice(0, 6).map((domain, idx) => (
                    <span key={idx} css={styles.domainTag}>
                      {domain}
                    </span>
                  ))}
                  {domains.length > 6 && <span css={styles.domainMore}>+{domains.length - 6}</span>}
                </div>
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
      {renderImagePane()}
      {renderMapPane()}

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

  // Interlinear wrapper for footer
  interlinearWrapper: css({ flex: 1, display: 'flex', flexDirection: 'column' }),

  // Verse footer (interlinear-full mode)
  verseFooter: css({
    marginTop: 8,
    paddingTop: 6,
    borderTop: `1px solid ${colors.border}`,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  }),
  footerIconRow: css({
    display: 'flex',
    gap: 8,
  }),
  footerIcon: css({
    padding: '2px 6px',
    fontSize: 16,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    borderRadius: 4,
    transition: 'background-color 0.15s',
    '&:hover': { backgroundColor: colors.primaryLight },
  }),
  expandIcon: css({
    padding: '2px 6px',
    fontSize: 10,
    color: colors.textMuted,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    borderRadius: 4,
    transition: 'all 0.15s',
    '&:hover': { backgroundColor: colors.primaryLight, color: colors.primary },
  }),
  // Expanded section styles (smaller fonts for dense content)
  expandedSection: css({
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    alignItems: 'baseline',
    marginTop: 2,
  }),
  expandedLabel: css({
    fontSize: 9,
    fontWeight: 600,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginRight: 4,
  }),
  expandedRefs: css({
    display: 'flex',
    flexWrap: 'wrap',
    gap: 3,
  }),
  expandedRefBtn: css({
    padding: '1px 4px',
    fontSize: 9,
    fontWeight: 500,
    color: colors.primary,
    backgroundColor: colors.primaryLight,
    border: 'none',
    borderRadius: 3,
    cursor: 'pointer',
    '&:hover': { backgroundColor: colors.primary, color: '#fff' },
  }),
  expandedTopics: css({
    fontSize: 9,
    color: colors.secondary,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.2px',
    lineHeight: 1.4,
  }),

  // Image/Map pane styles
  paneOverlay: css({
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  }),
  pane: css({
    backgroundColor: colors.background,
    borderRadius: 12,
    maxWidth: 500,
    width: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
  }),
  paneHeader: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: `1px solid ${colors.border}`,
  }),
  paneTitle: css({
    fontSize: 17,
    fontWeight: 600,
    color: colors.text,
  }),
  paneCloseBtn: css({
    padding: '4px 8px',
    fontSize: 18,
    color: colors.textMuted,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    borderRadius: 4,
    '&:hover': { backgroundColor: colors.backgroundAlt },
  }),
  paneContent: css({
    padding: 16,
    overflow: 'auto',
    flex: 1,
  }),
  paneAttribution: css({
    padding: '10px 16px',
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
    borderTop: `1px solid ${colors.border}`,
  }),

  // Image pane
  imageContainer: css({
    display: 'flex',
    justifyContent: 'center',
    backgroundColor: colors.backgroundAlt,
    borderRadius: 8,
    overflow: 'hidden',
    minHeight: 200,
  }),
  paneImage: css({
    maxWidth: '100%',
    maxHeight: 400,
    objectFit: 'contain',
  }),
  imageCaption: css({
    marginTop: 12,
    fontSize: 14,
    color: colors.secondary,
    textAlign: 'center',
    fontStyle: 'italic',
  }),
  imageNav: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
  }),
  imageNavBtn: css({
    padding: '6px 12px',
    fontSize: 13,
    color: colors.primary,
    backgroundColor: colors.primaryLight,
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    '&:disabled': { opacity: 0.4, cursor: 'not-allowed' },
    '&:hover:not(:disabled)': { backgroundColor: colors.primary, color: '#fff' },
  }),
  imageNavInfo: css({
    fontSize: 13,
    color: colors.textMuted,
  }),

  // Map pane
  mapContainer: css({
    display: 'flex',
    justifyContent: 'center',
    backgroundColor: colors.backgroundAlt,
    borderRadius: 8,
    overflow: 'hidden',
    minHeight: 200,
  }),
  mapPlaceholder: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  }),
  mapPin: css({
    fontSize: 48,
    marginBottom: 12,
  }),
  mapCoords: css({
    fontSize: 14,
    color: colors.secondary,
    fontFamily: 'monospace',
  }),
  mapCaption: css({
    marginTop: 12,
    fontSize: 14,
    color: colors.secondary,
    textAlign: 'center',
  }),
  mapLink: css({
    display: 'block',
    marginTop: 12,
    padding: '10px 16px',
    fontSize: 14,
    fontWeight: 600,
    color: '#fff',
    backgroundColor: colors.primary,
    border: 'none',
    borderRadius: 8,
    textAlign: 'center',
    textDecoration: 'none',
    cursor: 'pointer',
    '&:hover': { opacity: 0.9 },
  }),
  mapExtra: css({
    marginTop: 8,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  }),

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
  lexWordSense: css({ fontSize: 16, fontWeight: 600, color: colors.accent, fontStyle: 'italic' }),
  lexDef: css({ fontSize: 15, color: colors.text, lineHeight: 1.5 }),
  lexDomains: css({ display: 'flex', flexWrap: 'wrap', gap: 6 }),
  domainTag: css({
    padding: '3px 8px',
    fontSize: 11,
    fontWeight: 500,
    color: colors.secondary,
    backgroundColor: colors.backgroundAlt,
    borderRadius: 4,
    border: `1px solid ${colors.border}`,
  }),
  domainMore: css({ fontSize: 11, color: colors.textMuted, alignSelf: 'center' }),
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
