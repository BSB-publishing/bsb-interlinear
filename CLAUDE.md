# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

**BSB Interlinear** is a lightweight web application for exploring the Berean Standard Bible with Strong's concordance integration. Designed for mobile-first usage, it provides easy access to original language resources.

### Key Features

- **BSB Bible text** with embedded Strong's numbers
- **4 display modes**: Plain text, Strong's numbers, Interlinear compact, Interlinear full
- **Hebrew/Greek lexicon** lookups with detailed word information
- **Concordance search** - find all verses containing a specific Strong's number
- **Cross-references** displayed in interlinear full mode
- **Hebrew word order toggle** for OT with true RTL display
- **Mobile-optimized** with swipe navigation between chapters
- **Clickable words** - tap any word to see its Strong's entry

### Tech Stack

- Vite + React 18 + TypeScript
- Emotion CSS-in-JS
- No external UI libraries - minimal dependencies

## Project Structure

```
src/
├── App.tsx                    # Main application (~750 lines)
├── main.tsx                   # Entry point
├── assets/
│   └── bible_versions/
│       └── books-desc.ts      # Book metadata (English + French names)
└── helpers/
    ├── bsbDataApi.ts          # BSB data loading and search
    └── strongsApi.ts          # Strong's lexicon loading

public/
├── bsb-data/                  # BSB Bible data
│   ├── ATTRIBUTION.md         # Data source attributions
│   └── base/
│       ├── display/           # JSONL verse data per book
│       ├── headings.jsonl     # Section headings
│       └── index-cc-by/       # Cross-refs and morphology (CC-BY)
└── data/
    └── strongs/
        └── lexicon/           # Hebrew and Greek lexicon JSON
```

## Commands

```bash
yarn dev          # Start development server (port 5173)
yarn build        # Production build to dist/
yarn preview      # Preview production build
yarn lint         # ESLint check
yarn format       # Prettier format
yarn typecheck    # TypeScript type checking
```

## Data Flow

1. `loadEnrichedBSBChapter()` loads verse data, headings, and cross-refs
2. Verses render based on selected `displayMode`
3. Clicking any word with a Strong's number opens the lexicon modal
4. `searchConcordance()` finds all occurrences of a Strong's number

## Display Modes

| Mode | Description |
|------|-------------|
| `text` | Plain verse text (words still clickable) |
| `strongs` | Text with inline Strong's number badges |
| `interlinear-compact` | Word tiles: original word + English |
| `interlinear-full` | Word tiles with Strong's number + cross-refs |

## Color Palette

Colors are defined in `App.tsx`:

| Name | Purpose |
|------|---------|
| `text` | Main text color |
| `background` | Background color |
| `backgroundAlt` | Alternate background |
| `textMuted` | Secondary/muted text |
| `primary` | Primary accent (blue) |
| `primaryLight` | Light primary (hover states) |
| `secondary` | Secondary text color |
| `accent` | Accent color (Hebrew badge, errors) |

## Attribution

This project is based on [bible-strong](https://github.com/smontlouis/bible-strong) by Stéphane Music.

Data sources are documented in `public/bsb-data/ATTRIBUTION.md`. Key attributions:
- **BSB text**: CC0 Public Domain
- **Strong's Concordance**: Public Domain
- **Hebrew morphology (OSHB)**: CC-BY 4.0 (attribution required)
