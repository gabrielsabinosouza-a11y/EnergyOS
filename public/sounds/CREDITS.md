# Sound credits

All ambient audio files in this folder are royalty-free for commercial use.

| File | Title | Author | Source | License | Processing |
|---|---|---|---|---|---|
| rain.ogg / rain.mp3 | "Long rain ambience" (Mixkit SFX #1247) | Mixkit | https://mixkit.co/free-sound-effects/rain/ | Mixkit License (free commercial use, no attribution) | trimmed 170 s → seamless 165 s loop (5 s crossfade), mono, highpass 40 Hz / lowpass 12 kHz, loudnorm -24 LUFS |
| fireplace.ogg / fireplace.mp3 | "Fireplace with crackling sounds 2 min. RK" | RonKoster2023 | https://pixabay.com/sound-effects/film-special-effects-fireplace-with-crackling-sounds-2-min-rk-178392/ | Pixabay Content License | trimmed ~105 s → seamless 97 s loop (4 s crossfade), mono, highpass 40 Hz / lowpass 12 kHz, loudnorm -24 LUFS |
| chime.ogg / chime.mp3 | not shipped — the completion chime is synthesized via Web Audio in `src/lib/session-alerts.ts` | — | — | — | — |

## Reproducing the processing (ffmpeg)

Loop-crossfade pattern used for both files (replace `IN`, `START`, `END`,
`XFADE` seconds; `L = END - START`):

```bash
ffmpeg -y -i IN.mp3 -filter_complex "
[0:a]atrim=START:END,asetpts=PTS-STARTPTS,pan=mono|c0=0.5*c0+0.5*c1,asplit=2[a][b];
[b]atrim=L-XFADE:L,asetpts=PTS-STARTPTS[tail];
[a]atrim=0:XFADE,asetpts=PTS-STARTPTS[head];
[tail][head]acrossfade=d=XFADE:c1=tri:c2=tri[cf];
[a]atrim=XFADE:L-XFADE,asetpts=PTS-STARTPTS[body];
[body][cf]concat=n=2:v=0:a=1,asetpts=PTS-STARTPTS,
highpass=f=40,lowpass=f=12000,loudnorm=I=-24:TP=-2:LRA=11[out]" \
  -map "[out]" -c:a pcm_s16le loop.wav

ffmpeg -y -i loop.wav -c:a libopus -b:a 96k NAME.ogg
ffmpeg -y -i loop.wav -c:a libmp3lame -b:a 128k NAME.mp3
```

Parameters actually used:

- rain: `START=60 END=230 XFADE=5` → 165 s loop
- fireplace: `START=5 END=110 XFADE=4` → 97 s loop

Measured output: rain -22.9 LUFS / fireplace -24.2 LUFS integrated;
`defaultVolume` in `src/lib/ambient-sounds/config.ts` compensates
(rain 0.65, fireplace 0.75) so both feel balanced at the same master volume.
