#!/usr/bin/env python3
"""Writes web/lib/emoji-data.json: every emoji the reel render can draw, for the editor's emoji picker.

The render draws emojis with Noto Color Emoji in headless Chromium (runner/src/reel.ts), so the list is exactly the
font's emojis, written fully qualified (with U+FE0F where Unicode wants it). Names, keywords, categories and order come
from emojilib 2.4.0 (MIT, Mu-An Chiou); emojis newer than emojilib get their Unicode names and a category by name.
Skin tones aren't listed: an emoji that takes them is marked, and the picker adds the tone the customer chose.

    python3 scripts/emoji-data.py <emojilib dir> <NotoColorEmoji.ttf>

The font comes from the render image (Ubuntu's fonts-noto-color-emoji):
    docker run --rm --entrypoint cat <render image> /usr/share/fonts/truetype/noto/NotoColorEmoji.ttf > NotoColorEmoji.ttf
emojilib 2.4.0 is on npm (npm pack emojilib@2.4.0). Needs fontTools (pip install fonttools) and Node 22.
"""
import json
import os
import subprocess
import sys
import unicodedata

from fontTools.ttLib import TTFont

OUT = os.path.join(os.path.dirname(__file__), "..", "web", "lib", "emoji-data.json")
CATEGORIES = ["people", "animals_and_nature", "food_and_drink", "activity", "travel_and_places", "objects", "symbols", "flags"]
TONES = range(0x1F3FB, 0x1F400)
ZWJ, VS16, KEYCAP = 0x200D, 0xFE0F, 0x20E3

# Single emojis newer than emojilib: a category from whole words in their Unicode names (first match wins), else objects.
# Sequences take the category of their first part.
BY_NAME = [
    ("people", ["FACE", "HEART", "HAND", "HANDS", "FINGER", "FINGERS", "PERSON", "PEOPLE", "WOMAN", "MAN", "ADULT", "BODY", "EYES", "MOUTH", "LUNGS", "BRAIN", "FOOTPRINTS", "PALM", "THUMB", "TROLL", "NINJA", "PREGNANT", "BEARD", "BALD", "HAIR", "FAIRY", "ZOMBIE", "CROWN", "HEAD", "VIEWER", "SALUTING", "TEARS", "CLOTHES", "BACKPACK", "SARI", "SHORTS", "BALLET", "THONG", "SANDAL", "HELMET", "GOGGLES", "COAT", "GLOVES", "SCARF", "SOCKS", "FLAT", "KIMONO", "BLOOD"]),
    ("animals_and_nature", ["BISON", "MAMMOTH", "BEAVER", "POLAR", "DODO", "FEATHER", "SEAL", "BEETLE", "COCKROACH", "FLY", "WORM", "ROCK", "WOOD", "PLANT", "LOTUS", "CORAL", "JELLYFISH", "GOOSE", "MOOSE", "DONKEY", "WING", "BIRD", "HYACINTH", "TREE", "LEAF", "SLOTH", "OTTER", "SKUNK", "FLAMINGO", "ORANGUTAN", "DOG", "OYSTER", "NEST", "EGGS", "BUBBLES", "ROOT", "FUNGUS", "MICROBE", "LOBSTER", "SWAN", "PEACOCK", "PARROT", "RACCOON", "HIPPOPOTAMUS", "BADGER", "KANGAROO", "LLAMA", "MOSQUITO", "CRICKET", "HEDGEHOG", "DINOSAUR", "SAUROPOD", "T-REX", "ZEBRA", "GIRAFFE", "ORANGUTAN", "SNOWFLAKE", "TORNADO"]),
    ("food_and_drink", ["BLUEBERRIES", "OLIVE", "PEPPER", "FLATBREAD", "TAMALE", "FONDUE", "TEAPOT", "TEA", "BEANS", "POURING", "GINGER", "PEA", "GARLIC", "ONION", "WAFFLE", "FALAFEL", "BUTTER", "MATE", "ICE", "BEVERAGE", "JAR", "LIME", "MUSHROOM", "CUPCAKE", "MOONCAKE", "DUMPLING", "BAGEL", "SALT", "LEAFY", "MANGO", "CHOPSTICKS"]),
    ("activity", ["DIVING", "KITE", "YO-YO", "PINATA", "NESTING", "WAND", "MIRROR", "BOOMERANG", "FLUTE", "MARACAS", "PLAYGROUND", "SKATE", "DRUM", "ACCORDION", "SLED", "CURLING", "LACROSSE", "SOFTBALL", "FLYING", "JIGSAW", "KNOT", "THREAD", "YARN", "TROPHY"]),
    ("travel_and_places", ["HUT", "TRUCK", "WHEEL", "BUOY", "RICKSHAW", "SCOOTER", "WHEELCHAIR", "TEMPLE", "BRICKS", "PLACARD", "PARACHUTE", "SATELLITE", "ELEVATOR", "HOUSE", "BUILDING", "CANOE", "SAUCER"]),
    ("symbols", ["SIGN", "SYMBOL", "EQUALS", "IDENTIFICATION", "WIRELESS", "KHANDA", "HAMSA", "SQUARE", "CIRCLE", "WAVE", "FINGERPRINT", "INFINITY", "TRANSGENDER"]),
]


def font_sequences(path):
    """Every code point sequence the font draws (U+FE0F left out: the font ignores it)."""
    font = TTFont(path)
    cmap = font.getBestCmap()
    by_glyph = {}
    for cp, glyph in cmap.items():
        by_glyph.setdefault(glyph, cp)
    seqs = {(cp,) for cp in cmap}
    for lookup in font["GSUB"].table.LookupList.Lookup:
        for sub in lookup.SubTable:
            if lookup.LookupType == 7:
                sub = sub.ExtSubTable
            for first, ligatures in getattr(sub, "ligatures", {}).items():
                for lig in ligatures:
                    parts = [first] + list(lig.Component)
                    if all(p in by_glyph for p in parts):
                        seqs.add(tuple(by_glyph[p] for p in parts))
    return seqs


def qualify(candidates):
    """The fully qualified (RGI) form of each sequence, or None when it isn't an emoji on its own; region names for flags."""
    js = r"""
    const seqs = JSON.parse(require("fs").readFileSync(0, "utf8"));
    const rgi = /^\p{RGI_Emoji}$/v;
    const needsVs = /^(?!\p{Emoji_Presentation})(?!\p{Emoji_Modifier})\p{Emoji}$/u;
    const regions = new Intl.DisplayNames(["en"], { type: "region" });
    const out = seqs.map((cps) => {
      const raw = String.fromCodePoint(...cps);
      // U+FE0F after each component that would otherwise show as text (not before a skin tone).
      const full = cps.map((cp, i) => {
        const c = String.fromCodePoint(cp);
        const next = cps[i + 1];
        const keycap = next === 0x20e3;
        return needsVs.test(c) && !(next >= 0x1f3fb && next <= 0x1f3ff) && !(cp >= 0x1f1e6 && cp <= 0x1f1ff) && (keycap || !/[0-9#*]/.test(c)) ? c + "️" : c;
      }).join("");
      const emoji = rgi.test(full) ? full : rgi.test(raw) ? raw : null;
      let region = null;
      if (emoji && cps.length === 2 && cps.every((cp) => cp >= 0x1f1e6 && cp <= 0x1f1ff)) {
        try { region = regions.of(String.fromCharCode(...cps.map((cp) => cp - 0x1f1e6 + 65))); } catch {}
      }
      return [emoji, region];
    });
    process.stdout.write(JSON.stringify(out));
    """
    res = subprocess.run(["node", "-e", js], input=json.dumps(candidates), capture_output=True, text=True, check=True)
    return json.loads(res.stdout)


def unicode_name(cps):
    names = []
    for cp in cps:
        if cp in (ZWJ, VS16) or 0xE0020 <= cp <= 0xE007F:
            continue
        if cp == KEYCAP:
            names.insert(0, "keycap")
            continue
        names.append(unicodedata.name(chr(cp), "").lower())
    name = " ".join(n for n in names if n)
    if len(cps) > 1:
        for old, new in [("emoji component ", ""), ("heavy black heart", "heart"), ("female sign", "woman"), ("male sign", "man"), ("adult", "person"), ("black rightwards arrow", "facing right")]:
            name = name.replace(old, new)
    return name


def category_by_name(name):
    words = set(name.upper().replace("-", " ").split())
    for category, keys in BY_NAME:
        if any(k in words for k in keys):
            return category
    return "objects"


def unprefixed(name):
    """An emojilib name without its gender: "man_astronaut" → "astronaut", "basketball_man" → "basketball"."""
    for prefix in ("man_", "woman_", "male_", "female_"):
        if name.startswith(prefix):
            return name[len(prefix):]
    for suffix in ("_man", "_woman"):
        if name.endswith(suffix):
            return name[: -len(suffix)]
    return name


def main(lib_dir, font_path):
    seqs = font_sequences(font_path)
    lib = json.load(open(os.path.join(lib_dir, "emojis.json")))
    order = json.load(open(os.path.join(lib_dir, "ordered.json")))
    strip = lambda s: tuple(ord(c) for c in s if ord(c) != VS16)

    # Sequences without skin tones and that aren't bare components (tones, hair, letters of a flag, ZWJ, tags).
    def standalone(cps):
        if any(cp in TONES for cp in cps):
            return False
        if len(cps) == 1 and (cps[0] in (ZWJ, KEYCAP) or 0x1F1E6 <= cps[0] <= 0x1F1FF or 0x1F9B0 <= cps[0] <= 0x1F9B3 or 0xE0020 <= cps[0] <= 0xE007F or chr(cps[0]) in "0123456789#*"):
            return False
        return True

    candidates = sorted(s for s in seqs if standalone(s))
    qualified = qualify([list(c) for c in candidates])
    lib_by_seq = {strip(v["char"]): (k, v) for k, v in lib.items() if v.get("char")}
    rank = {name: i for i, name in enumerate(order)}

    def toneable(cps):
        # The tone goes after the first component; the font must draw the result.
        return (cps[0], 0x1F3FB) + tuple(cps[1:]) in seqs

    rows = []
    for cps, (emoji, region) in zip(candidates, qualified):
        if not emoji:
            continue
        known = lib_by_seq.get(cps)
        if known:
            key, entry = known
            name = key.replace("_", " ")
            keywords = [w for w in entry.get("keywords", []) if w.lower() != name]
            category = entry["category"]
            position = rank.get(key, len(order))
        else:
            name, keywords, category = unicode_name(cps), [], None
            first = lib_by_seq.get(cps[:1])
            if region:
                name, category = region.lower(), "flags"
            elif len(cps) >= 3 and cps[-2] == ZWJ and cps[-1] in (0x2640, 0x2642) and first:
                # A gendered version of an emojilib emoji: "⛹️‍♂️" is a man playing basketball.
                key, entry = first
                name = f"{'woman' if cps[-1] == 0x2640 else 'man'} {unprefixed(key).replace('_', ' ')}"
                keywords, category = entry.get("keywords", []), entry["category"]
            elif len(cps) >= 3 and cps[0] == 0x1F9D1 and cps[1] == ZWJ and lib_by_seq.get((0x1F468,) + cps[1:]):
                # A person doing something emojilib has for a man: "🧑‍🚀" is an astronaut.
                key, entry = lib_by_seq[(0x1F468,) + cps[1:]]
                name = unprefixed(key).replace("_", " ")
                keywords, category = entry.get("keywords", []), entry["category"]
            elif len(cps) > 1 and first:
                category = first[1]["category"]
            else:
                # A neutral emoji emojilib only has gendered versions of: "🧙" from "🧙‍♂️".
                family = next((entry for seq, (_, entry) in lib_by_seq.items() if seq[0] == cps[0] and len(seq) > 1), None)
                if family:
                    keywords, category = family.get("keywords", []), family["category"]
            category = category or category_by_name(name)
            position = len(order) + cps[0] / 1e6
        if category not in CATEGORIES:
            category = "symbols"
        rows.append((CATEGORIES.index(category), position, emoji, name, " ".join(keywords), 1 if toneable(cps) else 0))

    rows.sort(key=lambda r: (r[0], r[1]))
    data = {"categories": CATEGORIES, "emojis": [[r[2], r[3], r[4], r[0], r[5]] for r in rows]}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"wrote {len(rows)} emojis ({sum(r[5] for r in rows)} take skin tones) to {os.path.relpath(OUT)}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
