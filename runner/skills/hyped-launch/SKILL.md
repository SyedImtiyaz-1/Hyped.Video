---
name: hyped-launch
description: Use when the job prompt names /hyped-launch (or $hyped-launch) - a launch announcement, teaser or quick tour that introduces a whole product to people who have never seen it. Holds the recipes for Hyped's Launch Day, Teaser and 3 Features in 30 templates, and is the default for the video type "launch" when there's no template. Builds on the core skill `hyped`.
---

# Hyped: launch

Read [../hyped/SKILL.md](../hyped/SKILL.md) first, then the format guide for the job's format
(`../hyped/formats/<format>.md`: landscape, vertical, square or portrait). This skill adds what a launch video needs. The job
prompt still wins over both.

## What a launch video does

A stranger who has never heard of the product watches once and can say what it does, who it's for and where to get
it, and wants to try it. The video introduces the whole product: the one result it gives, two or three proofs that
it's real and working, then the way in. It's confident and specific. It celebrates the product; it doesn't argue.

| Scenario | The viewer | Opens on | Ends on |
|---|---|---|---|
| **hyped-launch** (this) | has never seen the product | its best result, in the real UI | where to get it |
| hyped-update | often already knows the product | what changed, or what people say | how to try the change |
| hyped-ads | is scrolling and not looking for it | a pain | a reason to click now |
| hyped-explain | wants to learn to use it | the goal | the finished task |
| hyped-dev | is a developer | a command | the install line |

A launch shows highlights, not every step (that's a walkthrough), and leads with the product, not the pain (that's an
ad). For a CLI or library, the real UI is the terminal: type the real command, show the real output.

## Before you plan

Read [look.md](look.md) before the first scene: the stage, type, motion and depth every launch video aims for.

Add these to `brag-plan.md`, under the core plan's angle:

- **The one result**: the single frame that proves the product works (the finished report, the paid invoice, the
  green deploy). It opens the video.
- **The highlights**, in order: the brief's "Must show" items in the customer's order; then the features the site
  leads with. Prefer what you can show working in the real UI over what is only described in a marketing section.
- **The proof**: one real number, result or memorable detail, copied from the site or repo, with its URL or file. If
  there is none, a real detail ("Free for one workspace", "Runs offline", "MIT licensed"). Never a made-up figure.
- **The way in**: the brief's call to action if it gives one; else the site's main button words and the bare domain
  (`Start free · tillbird.app`); for a CLI, the install command.

## Story shapes by length

Use these when the job names no template. With a template, its recipe wins. Seconds on the final timeline; with a
voiceover the voice is the clock, so keep the order and proportions and let the lines set exact times.

| Length | Scenes | Beats |
|---|---|---|
| 15 s | 4 | Hook 0-3 · Reveal 3-5.5 · One flow (entry → action → result) 5.5-12 · CTA 12-15 |
| 20 s | 5 | Hook 0-3 · Reveal 3-6 · Highlight 1 6-10.5 · Highlight 2 10.5-15.5 · CTA 15.5-20 |
| 30 s | 6 | Hook 0-3 · Reveal 3-7 · Highlight 1 7-13 · Highlight 2 13-19 · Highlight 3 19-25 · CTA 25-30 |
| 60 s | 9-11 | Hook 0-4 · Problem 4-10 · Reveal 10-16 · Highlights 1-3, 10 s each, 16-46 · Proof 46-54 · CTA 54-60 |
| 90 s | 13-16 | Hook 0-5 · Problem 5-13 · Reveal 13-20 · 4-5 highlights 20-72 · Proof 72-82 · CTA 82-90 |

What each beat shows:

- **Hook**: the one result in the real UI, filling the frame, with the hook line. Something moves from frame 1.
- **Problem** (45 s and longer): one sharp line in the site's own words, over the "before" in the product's own UI
  (the empty state, the long manual list). Never stock imagery or a made-up competitor screen.
- **Reveal**: the name and logo land in the product's UI (the wordmark settles, then shrinks into the app's header),
  with one sentence saying what it is. Not a logo on an empty background.
- **Highlight**: one feature per scene, working: a cursor click or typing, then the result appearing, with a short
  label. In 60-90 s videos a highlight takes 2-3 scenes: the action, the result, a detail.
- **Proof**: the real number, result or detail, big, on the real element it comes from (a count-up stops at exactly
  the site's figure, written the site's way: "12,000+").
- **CTA**: logo, name, and the URL or command large; settled by the beat's start and held at least 2.5 s.

No scene longer than 8 s. In 60-90 s videos, vary scene lengths (3-7 s), group highlights into chapters with one
lift in the middle, and don't give every scene the same layout and transition.

## Hooks

| Formula | Example (fictional product) | Use when |
|---|---|---|
| Result first | Tillbird's invoice flips to "Paid"; line: "Invoiced Monday. Paid Wednesday." | The product makes a visible outcome |
| Input → output | "Paste a link. Get a deck." while the cursor pastes into Slidewick's field and slides fan out | One small input gives a big output |
| Their own headline | Mossbook's hero line, "A week of bakes, planned.", over its planner filling in | The site's headline names a concrete thing (most don't: check) |
| The question it answers | "Who still owes you?" over Tillbird's dashboard filtering to overdue | Users ask that question every day |
| The audience, named | "For bakers who hate spreadsheets." over Mossbook's ingredient grid | A niche product: the audience is the hook |
| The one surprising truth | "Undo anything. Even last year." over Notewren's history panel scrolling back | It has one unusual capability the site states |
| A count in the UI | Glintdesk's queue ticking down to "0 open" | The real UI shows a satisfying number changing |

Never open on the logo, on "Introducing…", on a question with no visual answer, or on a line that fits any product.

## Calls to action

| Pattern | Example | Use when |
|---|---|---|
| Site button + domain | `Start free · tillbird.app` | The default |
| Command | `npx slidewick init` | A CLI or library |
| Waitlist | `Join the waitlist · mossbook.co` | The site collects sign-ups before launch |
| Date | `Launching Nov 12 · mossbook.co` | The date is in the brief or on the site, never otherwise |
| Launch venue | `Live on Product Hunt today · tillbird.app` | Only when the brief says so |

Write the URL the way people type it: lower case, no `https://`, no trailing slash.

## Copy

- **Length**: hook and headlines at most 6 words with music only, at most 5 with a voiceover. Feature labels at most 4
  words: the feature's own name or a verb phrase ("Split any invoice"). One line where possible, never more than two.
- **Voice**: present tense, active, concrete nouns, the product's own words. Plain statements or "you"; no "we're".
- **Banned** (beyond the core list): "Introducing", "Meet your new favorite", "the future of", "say goodbye to",
  "all-in-one", "next-level", "powerful" with no object, "effortless", "like never before", "it's finally here",
  "we're thrilled", "built for the modern…", "…, reimagined", "and so much more".
- **Music only**: the on-screen text tells the story. Each scene has one line, readable in its time (0.3 s a word plus
  0.5 s, settled), and the video makes sense with the sound off.
- **With a voiceover**: the voice tells the story. On screen go short labels that agree with the line (its own words,
  or a shorter label for the same idea), the feature's name, the URL. Never the spoken line in big type.

## Recipes

| The job prompt says | Read |
|---|---|
| Template "Launch Day" | [recipes/launch-day.md](recipes/launch-day.md) |
| Template "Teaser" | [recipes/teaser.md](recipes/teaser.md) |
| Template "3 Features in 30" | [recipes/three-features.md](recipes/three-features.md) |
| No template, 30 s or shorter | [recipes/three-features.md](recipes/three-features.md) for the per-beat craft, timed by the story shape above (numerals optional) |
| No template, 45 s or longer | [recipes/launch-day.md](recipes/launch-day.md) |

Use the teaser recipe only with the Teaser template: it hides what the product does on purpose, and every other
launch video must explain it.

## Common failures

| Failure | Fix |
|---|---|
| Hook card, then a logo card, then the app small in a frame: the product isn't really seen until second 5 | The first frame is the product's result filling the frame; the logo lands in the Reveal |
| A 6-word line in a 2.2 s scene | Count it: 0.3 s a word plus 0.5 s, from when the whole line is in |
| Highlights shown as landing-page sections describing a feature | Show the app doing it; use a page section only when there's no app, through the camera on its real elements |
| Every scene a heading over a panel, every transition a dip to black | Vary the layout (full-bleed UI, split, close crop) and the transition; change on beats |
| An end card with three lines of offer copy | Logo, name, one line, URL. Nothing else competes with the URL |
| A proof number that's rounded up, extrapolated or "about" | Copy it exactly; a number from a live page is shown as it was captured |
| 90 s as 18 equal 5-second scenes, each "01 / heading" over a terminal | Chapters, varied lengths, a mid-video lift, labels only where they help |
| The product's existing launch video re-cut | Never. A short clip in a device frame at most |
| Teaser-style mystery in an untemplated launch | Explain the product; mystery belongs to the Teaser template only |
