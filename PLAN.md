# Brain Lag — plan

A tiny working-memory math game. A new problem appears at the top; you answer the one from **N steps ago**. The problems in between are covered.

Goal: simple, fast to ship, and *not slop* — every pixel has a job, and it feels good to press.

> Status (Nov 17): v1 rebuilt from scratch to this plan. Milestones 1–6 done; milestone 7 is missing the 1200×630 link-preview image and a real-phone test. v1.1 (daily challenge) not started.

---

## 1. The game

| Rule | Decision |
|---|---|
| Levels | 1-Back, 2-Back, 3-Back, 4-Back |
| Round | 20 answers. First N problems are memorize-only (`MEMORIZE` → `Next`). |
| Problems | Single-digit `+` and `−`, every answer 0–9. One keypress = one answer. |
| Problem generator | Answers spread evenly over 0–9, no back-to-back repeats, no `x − 0` / `x + 0`. |
| Wrong / Pass | Reveal the correct answer, count a miss, keep going. |
| End of round | After problem 20 no new problems appear; top row reads `NO INPUT · RECALL 3 LEFT` until the stack is empty. |
| Score | Correct / 20 + total time. Best per level saved in `localStorage`. |
| Tab hidden | Pause the timer **and cover the stack** (otherwise pausing is a cheat). |
| Quit mid-round | Confirm first. |

**Defaults to confirm** (I picked these; say if you disagree):
- Name: **Brain Lag**, title bar `BRAIN_LAG.EXE`
- All levels unlocked from the start
- Sound: short bleeps, **off by default**, toggle in the window
- Mis-taps: big keys + a **250ms grace window** to change your answer before it locks
- Daily challenge: **v1.1**, not v1

---

## 1b. Why play — the intro

The game must explain *why* before *how*, or it reads as a pointless toy.

**Framing:** today's "information addiction" is constant switching — feeds, alerts, tabs. Attention gets trained to jump every few seconds. This game trains the opposite: holding something steady in mind while new things keep arriving.

**What it exercises:** working memory — the mental notepad (≈4 items for most people). Mostly the prefrontal cortex working with the parietal cortex. Three skills at once: *holding* answers you can't see, *updating* (drop the oldest, add the newest), and *ignoring* the problem right in front of you.

**Honesty:** you get better at the game; whether that transfers to general intelligence is disputed (big claims from a 2008 study mostly didn't hold up in later reviews; Lumosity was fined by the FTC in 2016 for overclaiming). Position it as **a two-minute focus workout, not a brain upgrade.**

**Where it shows up:**
- **First launch:** three short skippable screens inside the window, before the tutorial. Always reachable later via `?`.
  1. **Your attention is trained to jump.** Feeds, alerts and tabs teach you to switch every few seconds. This game does the opposite.
  2. **It works your working memory.** The mental notepad behind your forehead. It holds about four things. Here you'll hold answers you can't see, swap one out each turn, and ignore the problem right in front of you.
  3. **No miracle claims.** You'll get better at this game. Whether that carries over to everything else, scientists still argue. Think of it as two minutes of single focus. → `Start`
- **Results:** one tie-back line, e.g. `HELD 2 ITEMS · 1:32 WITHOUT SWITCHING`.
- **Tone:** intro is sentence case in the rounded UI font (it's explanation); the uppercase machine voice stays on the game screen.

---

## 2. Look — "2000s console" shell

The *structure* follows the reference window (title bar, screen, transport-style buttons, hard outlines). The *colors and type* come from 2000s handheld/console era: white plastic, sky blue, silver, pale backlit screens.

### Palette (A's shell + D's mint)

| Token | Hex | Use |
|---|---|---|
| `--desk` | `#E3E9EF` | Page behind the window |
| `--shell` | `#F4F7FA` | Window body |
| `--key` | `#FFFFFF` | Keypad buttons |
| `--primary` | `#34BEED` | Title bar, primary actions, progress fill |
| `--on-primary` | `#0B3A4F` | Text on primary |
| `--silver` | `#A9B4BF` | Secondary buttons (Pass/eject, Retry) |
| `--screen` | `#DCEBF5` | Problem screen |
| `--screen-ink` | `#16313F` | Text on screen, number tags |
| `--cover` | `#B9CEDC` | Covered (hidden) rows |
| `--cover-ink` | `#3E5A6B` | Text on covered rows |
| `--correct` | `#7FF0CF` | Correct flash (fill only) |
| `--on-correct` | `#0B3A2E` | Text on mint |
| `--wrong` | `#FF8A8A` | Wrong flash (fill only) |
| `--on-wrong` | `#4A0E12` | Text on wrong |
| `--outline` | `#1A1A1A` | Every outline and hard shadow |

Mint and red are **fills with dark text on top**, never text colors (contrast on the pale screen is too low).
The game is always light — it's a device, not a document. No dark mode in v1.

### Type
- **UI labels:** M PLUS Rounded 1c (500 / 800) — the friendly rounded 2000s console feel.
- **Screen (problems, status line):** DotGothic16 — pixel/LCD feel, still readable at phone size.
- **Timer:** DSEG7 Classic (seven-segment).
- Fonts are **self-hosted** in `/fonts` (no flash of the wrong font, works offline).

### Shape and motion
- 2px `--outline` borders on everything; hard offset shadows (`3px 3px 0` window, `2px 2px 0` keys), no blur.
- Radius: window 6px, keys 4px, number tags are pills.
- Key press: shift 2px down-right, shadow collapses to 0.
- **New problem:** stack slides down one row; the row leaving the top view gets covered with a quick shutter. *This animation is the tutorial — it must read clearly.*
- **Correct:** answer row fills mint, ✓, tiny bounce, soft chime.
- **Wrong:** row fills red, shows `it's 7`, window shakes 4px, low bleep.
- `prefers-reduced-motion`: keep color changes, drop movement.

### Screen layout (game)

```
┌ BRAIN_LAG.EXE ───────────── [♪][?][×] ┐   title bar (sound, help, quit)
│ ┌ screen ──────────────────────────┐  │
│ │ 2-BACK · RECALL #7      ⏱ 01:20  │  │   status line + timer
│ │ (21)          9 − 7 = ?          │  │   newest — memorize
│ │ (20) ▮▮▮▮ REMEMBER ▮▮▮▮          │  │   covered
│ │ (19)          ? ? ? = [_]        │  │   answer this
│ └──────────────────────────────────┘  │
│ [███████████░░░░░░░░░]  7/20          │   progress bar
│ [1][2][3]                             │
│ [4][5][6]          keypad             │
│ [7][8][9]                             │
│ [⟲ Retry][0][⏏ Pass]                  │
└───────────────────────────────────────┘
```

No decorative controls. Every button does something; anything else is cut.

### Other screens
- **Menu:** the same window as a "track list" — one row per level with best score. Click to play.
- **Results:** screen shows `17/20` and time, `NEW BEST` badge when earned, `Again` / `Levels`.
- **Tutorial:** first launch runs a guided 1-Back with arrows on the stack ("remember this" → "it's covered now" → "answer it"). Afterwards it lives behind `?`.

### Voice
Short, machine-like, uppercase on the screen only: `MEMORIZE`, `RECALL #7`, `NO INPUT`, `BUFFER EMPTY`, `NEW BEST`. No "Great job!", no emoji.

---

## 3. Tech

- Plain HTML + CSS + JS. No framework, no build step, no backend, no login.
- Files: `index.html`, `style.css`, `game.js`, `/fonts`, `/sfx` (or ZzFX in code — no audio files).
- `?debug` in the URL: fixed random seed + shows hidden answers. Used to check the "which problem am I answering" logic.
- Seeded random generator from day one (needed for debug now, daily challenge later).
- Hosting: Vercel, static. GitHub repo connected for auto-deploy on push.
- Link preview: `<title>`, description, and a 1200×630 preview image.

---

## 4. Milestones

Each one ends deployed and checked on a phone.

1. **Ship a placeholder.** `git init`, GitHub repo, Vercel live URL. *(Needs your accounts.)*
2. **Style board.** One page (`/styleboard.html`) showing every component alone: window, title bar, key (rest/pressed/disabled), screen rows (current/covered/answer/correct/wrong), progress bar, tag. Compare against the reference; fix here.
3. **Restyle the game** using the styleboard pieces. Add the stack-slide and cover animation.
4. **Round edges:** end-of-round `NO INPUT` stretch, pause on tab hide, quit confirm, mis-tap grace window, better problem generator.
5. **Intro + tutorial:** the three "why" screens (section 1b), then a guided first 1-Back. Results tie-back line.
6. **Feel:** sounds (off by default), bounce/shake polish, fonts self-hosted.
7. **Share polish:** link preview image, favicon, final phone test.
8. *(v1.1)* Daily challenge + copyable result line: `BRAIN_LAG 2-BACK ▮▮▮▮▮▮▯▮▮▮ 18/20 1:32`.

### Done means
- A first-time player understands *why* (intro) and *how* (tutorial) without reading anything else.
- Playable one-handed on a phone; no OS keyboard ever pops up.
- Every visible control does something.
- Works with keyboard only on desktop (digits, Enter/Space, P, Esc).

---

## 5. Out of scope (v1)

Timed/fast modes, multiplication, two-digit answers, level unlocking, leaderboards, accounts, analytics.

## 6. References

- **Structure:** the provided retro media-player illustration.
- **Era/colors:** 2000s white-plastic consoles and handhelds (evoke, don't copy — no logos, characters, or brand marks).
- **Game UX:** Monkeytype (keyboard-first, instant restart), Human Benchmark (self-explaining tests), Brain Workshop (n-back difficulty).
- **Feel:** "Juice it or lose it" (Jonasson & Purho).
- **Sound:** ZzFX / jsfxr.
