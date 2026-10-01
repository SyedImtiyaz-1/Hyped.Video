# Fonts for "Behind you"

The display fonts for the big words in "Behind you" reels, one per font style (`BIG_LOOKS` in `src/reel.ts`). The
Dockerfile copies them into the render image (`/usr/share/fonts/truetype/hyped`), where libass finds them by family
name. Classic and Outline use Inter Black from Debian's `fonts-inter` package instead.

| Style     | Font                    | File                          | Licence    |
| --------- | ----------------------- | ----------------------------- | ---------- |
| Impact    | Anton                   | `Anton-Regular.ttf`           | OFL 1.1    |
| Editorial | Abril Fatface           | `AbrilFatface-Regular.ttf`    | OFL 1.1    |
| Elegant   | DM Serif Display Italic | `DMSerifDisplay-Italic.ttf`   | OFL 1.1    |
| Script    | Kaushan Script          | `KaushanScript-Regular.ttf`   | OFL 1.1    |
| Marker    | Permanent Marker        | `PermanentMarker-Regular.ttf` | Apache 2.0 |
| Pop       | Archivo Black           | `ArchivoBlack-Regular.ttf`    | OFL 1.1    |

All six come from Google Fonts' repository, [google/fonts](https://github.com/google/fonts) at commit
`9710da1eacb3be272583c3224dcb70f9da6eadbb`. Each font's licence file is next to it. The web app shows previews with copies
in `web/components/reels/fonts`.

To add a font: put the file here and its copy in the web folder, then regenerate the measurements the placement uses
(`src/fonts.ts`) from all the fonts, Inter Black included:

```bash
docker run --rm --entrypoint cat <render image> /usr/share/fonts/opentype/inter/Inter-Black.otf > Inter-Black.otf
python3 scripts/font-metrics.py Inter-Black.otf runner/fonts/*.ttf
```
