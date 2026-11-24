# EnergyOS — Sons ambiente do foco

This folder holds the ambient audio assets for the focus timer (rain + fireplace).
The engine (`src/lib/ambient-sounds/engine.ts`) lazy-loads `/sounds/<id>.ogg`
first and falls back to `.mp3`.

## Required files

| File | Content | Suggested length |
|---|---|---|
| `rain.ogg` / `rain.mp3` | Gentle steady rain, no thunder cracks | seamless loop, ~2–3 min |
| `fireplace.ogg` / `fireplace.mp3` | Warm crackling fireplace | seamless loop, ~2–3 min |
| `chime.ogg` / `chime.mp3` | (optional) soft completion chime | ~2–4 s one-shot |

## Specs

- **Format**: Ogg Opus preferred; MP3 fallback. Mono or light stereo.
- **Loop**: must loop seamlessly — crossfade the tail into the head (~1–2 s)
  before exporting, or the Web Audio loop point will click.
- **Loudness**: normalize both files to similar perceived loudness; the app
  applies per-sound + master gain anyway.
- **Size**: keep files small (Opus ~64–96 kbps is plenty for ambience).
- **License**: CC0 or equivalent commercial-friendly license only. Record the
  source + license in `CREDITS.md`.

## Good royalty-free sources

- [Freesound.org](https://freesound.org) — filter by CC0 license
- [Pixabay Sound Effects](https://pixabay.com/sound-effects/) — Pixabay Content License
- [BBC Sound Effects](https://sound-effects.bbcrewind.co.uk) — RemArc license (personal/educational; check terms)
- [Mixkit](https://mixkit.co/free-sound-effects/) — Mixkit License

Until real files are added, the current `.ogg`/`.mp3` files are **placeholders**
(1-byte stubs). The UI shows a small non-blocking "couldn't load" message if
decoding fails and the session continues normally — the app never breaks.

## Processing (how the shipped loops were made)

Real recordings were trimmed, looped with an end→start crossfade, downmixed to
mono, EQ'd (highpass 40 Hz / lowpass 12 kHz) and loudness-normalized
(`loudnorm=I=-24:TP=-2:LRA=11`). Full ffmpeg commands, sources and licenses are
in `CREDITS.md`.

## CREDITS

See `CREDITS.md` for the per-file source/license table.
