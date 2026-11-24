# Demo videos: the prompts

15 November 2026. Taibanaz for Syed. Syed, 8 Nov: "We don't have a video for demo, need to generate with a better
prompt." These are those prompts: one per template, made with Hyped itself (as Cardboard's samples are made with
Cardboard), for the template cards, the Made with Hyped gallery and the golden set.

## Before generating

- **After the deploy.** Hyped films the product's live site. Until `main` is deployed, hyped.video shows the old
  site, so videos of Hyped made now would show the old pages.
- **Engine.** Studio (Claude) for the gallery, if it's switched on; otherwise Standard.
- **Products we may show.** Hyped (hyped.video) and the owner's AutoApply (autoapply.in), as `web/lib/showcase.ts`
  already does. MemoAgent only if Syed agrees. No one else's product, people or brand.
- **Real claims only.** Every line on screen comes from the product's own site or repo: no invented numbers,
  customers or quotes.

## The bar: Cardboard's samples (Taibanaz, 15 Nov: "bs cardboard jaise chahiye sb")

The level to reach is Cardboard's "Made with Cardboard" gallery: every sample looks made by a good studio, and the
gallery covers many kinds of video. What that means here, in our own work (our products, our footage, no TV clips,
celebrities or other people's shows, nothing copied from their videos):

- **A cinematic look:** depth (a background, the product, type in front), a camera that pushes into the one thing
  that matters, smooth eases, real light and shadow on the UI rather than a flat screenshot.
- **Big, confident type:** a few words at a time, large, in the product's own fonts and colours; type that moves with
  the beat.
- **Pace:** a hook in the first second, cuts on the beat, nothing still for long, an ending that resolves.
- **Variety, as their gallery has:** product showcases and launch films (Launch Day, 3 Features), a teaser, an
  explainer (Walkthrough), a founder demo, ads (Problem → Solution, Before / After), and talking-head reels (the six
  reel styles), so the gallery shows every kind of video Hyped makes.

## What every prompt adds (paste into Notes)

This is the "better prompt": the fixes for what the 5 Nov measurements found (too quiet, dips to black, 2–3 s
freezes, whole pages shown small).

> Make it look like a studio made it: depth, a camera that pushes into the UI, big confident type a few words at a
> time, smooth motion on the beat. Open on the product's best result in the first second; no logo intro. Show the real UI, zoomed into the one
> element that matters in each shot, never a whole page small: text on screen at least 32 px, the product at least 40%
> of the frame. Keep something moving: no hold longer than 1.5 s and no fade to black between scenes; cut on the
> beat. Captions in 2–4 word groups in the lower band, clear of the UI. Voice clear with the music well under it; end
> on a 2-second card with the name and address, and fade the music out over the last 1.5 s. Use only claims from the
> site.

## The 12

Each prompt fills the New video steps: source, template, format, length, voice, music, tone, then the brief (what's
launching, who it's for, up to three highlights, the ending) and the notes. The template's own beats stay as they are.

### 1. Launch Day: AutoApply

- **Source:** https://autoapply.in · **Template:** Launch Day · 60 s · landscape · voice Maya · music upbeat · tone polished
- **Launching:** AutoApply, from its home page's own headline
- **Audience:** people looking for a job
- **Highlights:** the three strongest features on autoapply.in, in its own words
- **Ending:** "Start at autoapply.in"
- **Notes:** the common notes. Open on a match result in the real UI, not the landing page's hero.

### 2. 3 Features in 30: Hyped

- **Source:** https://hyped.video · **Template:** 3 Features in 30 · 30 s · square · voice Jess · music upbeat
- **Launching:** Hyped: launch videos from your website or repo
- **Audience:** founders and makers launching a product
- **Highlights:** paste a link and get a launch video; edit it in plain English with Ask AI; turn your own clip into a captioned reel
- **Ending:** "Make yours at hyped.video"
- **Notes:** the common notes. One feature per beat, each on the real screen that does it.

### 3. Teaser: Hyped

- **Source:** https://hyped.video · **Template:** Teaser · 15 s · vertical · no voice · music composed · tone cinematic
- **Launching:** Hyped
- **Audience:** makers on X and Instagram
- **Highlights:** the prompt box; a finished video playing; the editor's timeline
- **Ending:** "hyped.video"
- **Notes:** the common notes. Three quick glimpses, then the tagline in big type; no voice, so the type carries it.

### 4. Feature Drop: Hyped's editor

- **Source:** https://hyped.video · **Template:** Feature Drop · 20 s · landscape · no voice · music upbeat · tone polished
- **Launching:** the new editor: timeline, Ask AI and captions in one dark workspace
- **Audience:** people who already make videos with Hyped
- **Highlights:** drag pieces on the timeline; ask for a change in plain English; pick a caption style
- **Ending:** "Open your project at hyped.video"
- **Notes:** the common notes. Before: the old video page. After: the editor. Needs the deploy.

### 5. Walkthrough: Hyped

- **Source:** https://hyped.video · **Template:** Walkthrough · 90 s · landscape · voice Cole · music composed · tone polished
- **Launching:** how to make a launch video with Hyped
- **Audience:** a first-time user
- **Highlights:** paste your site and pick a template; watch the first cut; change it with Ask AI and export
- **Ending:** "Try it free at hyped.video"
- **Notes:** the common notes. Calm pace; every step stays on screen long enough to read; zoom into each click.

### 6. Problem → Solution: Hyped

- **Source:** https://hyped.video · **Template:** Problem → Solution · 30 s · vertical · voice Leo · music upbeat
- **Launching:** Hyped
- **Audience:** a founder the night before launch day with no video
- **Highlights:** a launch video from a link; changes asked for in plain English; the MP4, a poster and the share copy to post
- **Ending:** "Paste your link at hyped.video"
- **Notes:** the common notes. Pain in the first second: an empty video timeline and a launch date.

### 7. Before / After: Hyped reels

- **Source:** https://hyped.video · **Template:** Before / After · 20 s · vertical · no voice · music upbeat
- **Launching:** reels from your own clip
- **Audience:** creators who record themselves talking
- **Highlights:** captions word by word; pauses cut; B-roll and music added
- **Ending:** "hyped.video"
- **Notes:** the common notes. Before: a plain talking clip. After: the same clip as a Hyped reel. Needs our own clip (see Reels).

### 8. Founder Demo: AutoApply

- **Source:** https://autoapply.in · **Template:** Founder Demo · 60 s · landscape · voice Cole · no music · tone deadpan
- **Launching:** AutoApply, shown by its maker
- **Audience:** job seekers
- **Highlights:** the main flow on autoapply.in, step by step
- **Ending:** "autoapply.in"
- **Notes:** the common notes. Plain and honest, like a founder showing their screen; no hype words.

### 9. Social Proof: wait for real quotes

- **Template:** Social Proof · 30 s · square · voice Maya · music upbeat
- **Hold until** the beta (16–27 Nov) gives real quotes from makers who agreed to be shown. This template must not
  use made-up quotes or logos.

### 10. README Loop: Hyped's repo

- **Source:** the Hyped GitHub repo, once it's public (the plan's Show HN leads with it) · **Template:** README Loop · 15 s · landscape · no voice · no music
- **Launching:** Hyped, for the repo's README
- **Highlights:** a link pasted in; the video it makes
- **Notes:** the common notes, without the music line. A seamless loop: the last frame eases back to the first.

### 11–12. App Store Preview and Play Store Promo: need an app

- Both need a mobile app on the stores. Hyped has none. Syed: does AutoApply (or MemoAgent) have one we may show?
  If not, these two wait.

## Reels (the six reel styles)

Each needs a real clip, edited by Hyped's reels. One clip can make all six styles. Syed's full stack generates them;
each becomes a `SHOWCASE` line with `template: "reel-<style>"`.

### What to record

On a phone, in portrait, 1080p or better. Face a window for light, a quiet room, the phone at eye level and steady
(a stack of books will do). Whoever is filmed agrees to the clip being shown on hyped.video.

| # | Shot | Length | For |
|---|---|---|---|
| 1 | Someone at a desk, talking to the camera: why they built their product, in their own words | 45–60 s | Talking-head reel, captions |
| 2 | The same person telling one short story: a launch that went wrong or right | 30–45 s | Vlog style, cuts and B-roll |
| 3 | Hands on a laptop: pasting a link into Hyped, scrolling the editor | 10–15 s | B-roll |
| 4 | The room and the desk: a slow pan, a coffee cup, the screen from behind | 3 × 5 s | B-roll |
| 5 | A walk-and-talk outside: one tip for makers | 20–30 s | Clipping style, big captions |

Natural speech is better than a script; pauses and filler words are what Hyped's cuts remove. No music playing in the
room, no TV or other screens with someone else's content in shot.

## The gallery on hyped.video (Taibanaz, 16 Nov)

Only videos made with Hyped, as Cardboard's gallery holds only videos made with Cardboard: never Cardboard's videos,
nor videos from other tools under "Made with Hyped". Three kinds, so it looks as varied as theirs:

| Kind | How many | How |
|---|---|---|
| Product videos of Hyped and AutoApply | 4–6 | Remade with the prompts above; they replace today's nine, which go once the new ones are better |
| Reels with real people | 4–6 | The recordings above, edited by Hyped |
| Beta makers' products | 20 or more | From the beta (16–27 Nov), with each maker's permission: the launch plan's target of 30 gallery videos by 30 Nov |

First a test of both ways (Syed, 16 Nov: yes, by testing): prompts #1 and #2 above, and one reel from recording 1.
Compared side by side with Cardboard's gallery, they decide how the rest are made.

## What goes where

Each finished video gets a `SHOWCASE` line in `web/lib/showcase.ts` with its template's id, so it shows on that
template's card and, unless it's marked otherwise, in the Made with Hyped gallery.
