# Agent Treasury Competition Demo Video

## Final deliverable

- Final video: `Agent-Treasury-Demo-v0.1.0-rc.5.mp4`
- Duration: 185.5 seconds
- Canvas: 1920×1080, 30 fps
- Video: H.264
- Audio: AAC, 48 kHz
- Narration: Simplified Chinese
- Subtitles: burned-in Simplified Chinese + English; editable SRT is included

## Truthful demo boundary

The product interactions were recorded from an isolated Agent Treasury service and mock-payment database. The automatic, approval, exception, accounting-query, and vendor-import states are real application states. No real wallet transaction was triggered during filming. The final proof card refers to the separately verified 0.10 USDT BSC transaction recorded by the project.

The vendor-import scene uses public metadata for CoinGecko API, Twelve Data, and Marketstack. No account was created, no API key was stored, and no paid endpoint was called.

## Reproducible sources

- `01-narration-zh.txt` — Chinese narration
- `02-bilingual-subtitles.srt` — editable bilingual subtitles
- `03-production-blueprint.md` — shot plan and safety boundary
- `04-vendor-sources.md` — public vendor pricing sources
- `vendor-import-demo.csv` — import demonstration data
- `record-product-demo.js` — isolated real-interaction recorder
- `make-video-cards.js` — reproducible title/proof cards
