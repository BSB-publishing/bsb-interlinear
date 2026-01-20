# BSB Interlinear

A lightweight, mobile-first web application for exploring the Berean Standard Bible with Strong's concordance integration. Tap any word to instantly access Hebrew and Greek lexicon entries.

## Features

- **4 Display Modes**
  - Plain text (tap words to see Strong's info)
  - Strong's numbers inline
  - Interlinear compact (original word + English)
  - Interlinear full (with cross-references)

- **Original Language Resources**
  - Hebrew and Greek lexicon with definitions
  - Transliteration and pronunciation
  - Morphological data
  - Concordance search

- **Mobile Optimized**
  - Swipe between chapters
  - Hebrew word order toggle (true RTL)
  - Touch-friendly word selection

## Quick Start

```bash
# Install dependencies
yarn install

# Start development server
yarn dev

# Build for production
yarn build
```

## Tech Stack

- **Vite** - Fast build tool
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Emotion** - CSS-in-JS styling

No external UI component libraries - minimal bundle size (~60KB gzipped).

## Project Structure

```
src/
  App.tsx              # Main application
  main.tsx             # Entry point
  helpers/
    bsbDataApi.ts      # Bible data loading
    strongsApi.ts      # Lexicon loading
  assets/
    bible_versions/
      books-desc.ts    # Book metadata

public/
  bsb-data/            # BSB Bible data files
  data/strongs/        # Hebrew/Greek lexicon
```

## Data Sources & Attribution

### Public Domain (CC0)

- **Berean Standard Bible (BSB)** - Bible text with Strong's numbers
  - Source: https://github.com/BSB-publishing/bsb2usfm
  - License: CC0 1.0 Universal

- **Strong's Concordance** - Hebrew and Greek lexicon
  - Source: https://github.com/scrollmapper/bible_databases
  - License: Public Domain

- **Treasury of Scripture Knowledge** - Cross-references
  - Source: https://github.com/scrollmapper/bible_databases
  - License: Public Domain

### CC-BY 4.0 (Attribution Required)

- **Open Scriptures Hebrew Bible (OSHB)** - Hebrew morphology data
  - Source: https://github.com/openscriptures/morphhb
  - License: CC BY 4.0
  - Attribution: Hebrew morphology data from Open Scriptures Hebrew Bible (OSHB), licensed under CC BY 4.0. https://hb.openscriptures.org/

## Acknowledgments

This project is based on [bible-strong](https://github.com/smontlouis/bible-strong) by Stephane Music, a comprehensive React Native Bible study application.

## License

This project is licensed under the **GNU General Public License v3.0**.

You are free to:
- Use the code for your projects
- Modify the source code
- Distribute your modifications

Provided that you:
- Keep the source code open
- Credit the original project
- Use the same GPL v3 license

Based on [bible-strong](https://github.com/smontlouis/bible-strong) by Stephane Music.

The Bible data and lexicon content have their own licenses as noted above.
