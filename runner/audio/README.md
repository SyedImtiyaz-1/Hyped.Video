# Hyped audio library

Licensed music and sound effects for launch videos. When the brief says to use the library, use these files
instead of synthesizing audio: a real track and a few real effects sound far better than generated tones.

## Music (`music/`)

Tracks by Sascha Ende ([ende.app](https://ende.app/en)), licensed CC BY 4.0. Commercial use is allowed, the
composer waives the credit requirement (credit is appreciated, not required), and his music is not registered with
Content ID, so customers' uploads don't get claimed.

`music/library.json` lists every track with its moods (best fit first), tempo and length. The runner picks one per
video from it (`runner/src/music.ts`): by the tone, then the template, then the video type, long enough for the
video, and rotated per customer. When the brief names a track, use that one. Only when it names none, choose from
the table below.

| File | Length | Tempo |
|---|---|---|
| `happy-beats-business-moves-vol-10-by-ende-dot-app.mp3` | 1:00 | 110 BPM |
| `happy-beats-business-moves-vol-11-by-ende-dot-app.mp3` | 1:27 | 115 BPM |
| `happy-beats-business-moves-vol-9-by-ende-dot-app.mp3` | 1:53 | 115 BPM |
| `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3` | 1:57 | 110 BPM |
| `happy-beats-business-moves-vol-1-by-ende-dot-app.mp3` | 2:43 | 120 BPM |

`music/cues/<track>.music-cues.md` lists beat times and strong cues for the first ~25 seconds (the `.json`
has the whole track). Cut scenes on beats, and land the reveal and the end card on strong cues.

To use a track:
1. Pick a track at least as long as the video, with a tempo that fits the tone (faster for high energy). Start at a strong cue near the top if the intro is weak.
2. Trim it to the video's length. Fade in over 0.2 s and fade out over the last 1.5 s so the end card resolves.
3. Master to about -14 LUFS integrated with a true peak under -1 dBTP (ffmpeg `loudnorm`).
4. Write the chosen file name to `brag-output/music.txt`.

## Sound effects (`sfx/`)

Kenney sound packs, CC0 (no credit needed):

- `ui/` and `interface/`: clicks, switches and rollovers, for UI interactions on screen.
- `keyboard/`: key presses, for typing scenes.
- `impact/`: light and medium impacts, for reveals and the logo moment.

`sfx/sfx-analysis.md` rates every file. Prefer warm sounds with low high-frequency risk. Use 2–6 effects in
total, sitting 6–10 dB under the music, in the same space as the track. Never put one on every cut, and never
repeat the same sound back to back.
