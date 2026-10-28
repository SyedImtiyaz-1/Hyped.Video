# Caption fonts

The fonts reel captions are drawn in (`CAPTION_FONTS` in `packages/core/src/captions.ts`), and the display fonts for
the big words in "Behind you" reels (`BIG_LOOKS` in `src/reel.ts`). The Dockerfile copies them into the render image
(`/usr/share/fonts/truetype/hyped`), where libass finds them by family name. Inter comes from Debian's `fonts-inter`
package instead. Each font's licence file is next to it; all are free for commercial use. The web app shows previews
with copies in `web/components/reels/fonts`.

| Caption font     | File(s)                               | Family libass finds              | Licence    |
| ---------------- | ------------------------------------- | -------------------------------- | ---------- |
| Montserrat       | `Montserrat-{Black,ExtraBold,SemiBold,Medium,Light}.ttf` | `Montserrat Black` … `Montserrat Light` | OFL 1.1 |
| Poppins          | `Poppins-ExtraBold.ttf`               | `Poppins ExtraBold`              | OFL 1.1    |
| TikTok Sans      | `TikTokSans-Bold.ttf`                 | `TikTok Sans`                    | OFL 1.1    |
| Roboto           | `Roboto-Black.ttf`                    | `Roboto Black`                   | OFL 1.1    |
| Rubik            | `Rubik-Black.ttf`                     | `Rubik Black`                    | OFL 1.1    |
| Anton            | `Anton-Regular.ttf`                   | `Anton`                          | OFL 1.1    |
| Bebas Neue       | `BebasNeue-Regular.ttf`               | `Bebas Neue`                     | OFL 1.1    |
| Oswald           | `Oswald-Bold.ttf`                     | `Oswald`                         | OFL 1.1    |
| Archivo Black    | `ArchivoBlack-Regular.ttf`            | `Archivo Black`                  | OFL 1.1    |
| Bangers          | `Bangers-Regular.ttf`                 | `Bangers`                        | OFL 1.1    |
| Luckiest Guy     | `LuckiestGuy-Regular.ttf`             | `Luckiest Guy`                   | Apache 2.0 |
| Abril Fatface    | `AbrilFatface-Regular.ttf`            | `Abril Fatface`                  | OFL 1.1    |
| DM Serif Display | `DMSerifDisplay-Italic.ttf`           | `DM Serif Display`               | OFL 1.1    |
| Instrument Serif | `InstrumentSerif-Italic.ttf`          | `Instrument Serif`               | OFL 1.1    |
| Kaushan Script   | `KaushanScript-Regular.ttf`           | `Kaushan Script`                 | OFL 1.1    |
| Caveat           | `Caveat-Bold.ttf`                     | `Caveat`                         | OFL 1.1    |
| Permanent Marker | `PermanentMarker-Regular.ttf`         | `Permanent Marker`               | Apache 2.0 |

"Behind you"'s big-word styles use six of them: Impact (Anton), Editorial (Abril Fatface), Elegant (DM Serif Display
Italic), Script (Kaushan Script), Marker (Permanent Marker) and Pop (Archivo Black); Classic and Outline use Inter Black.

All come from Google Fonts' repository, [google/fonts](https://github.com/google/fonts): the first six at commit
`9710da1eacb3be272583c3224dcb70f9da6eadbb`, the rest at `7085eb89a950e85db5b166b7a58d414544b4140c` (Oct 2026). Montserrat,
Rubik, Roboto, Oswald, Caveat and TikTok Sans are variable fonts there; the files here are fixed weights cut from them
with fontTools (none of those licences reserves a font name), for example:

```bash
fonttools varLib.instancer "Montserrat[wght].ttf" wght=900 --update-name-table -o Montserrat-Black.ttf
fonttools varLib.instancer "TikTokSans[opsz,slnt,wdth,wght].ttf" opsz=36 wdth=100 wght=700 slnt=0 --update-name-table -o TikTokSans-Bold.ttf
```

TikTok Sans's instance was then renamed from "TikTok Sans 36pt" to "TikTok Sans". Playfair Display was left out: its
licence reserves its name, so a cut-down copy couldn't keep it.

To add a font: put the file here and its copy in the web folder, add it to `CAPTION_FONTS` (with its em and capital
height, `CAPTION_FONT_EM` and `CAPTION_FONT_CAP`), `DISPLAY_FACES` in `src/reel.ts` and `caption-fonts.ts` in the web app,
then regenerate the measurements captions and big words are fitted with (`src/fonts.ts`) from all the fonts, Inter's
four weights included:

```bash
for w in Black ExtraBold SemiBold Medium; do docker run --rm --entrypoint cat <render image> /usr/share/fonts/opentype/inter/Inter-$w.otf > Inter-$w.otf; done
python3 scripts/font-metrics.py Inter-Black.otf Inter-ExtraBold.otf Inter-SemiBold.otf Inter-Medium.otf runner/fonts/*.ttf
```
