# CLAUDE.md — Brain Lag

A tiny n-back math game: a new problem appears at the top, you answer the one from N steps ago. Full plan and milestone list: `PLAN.md`. Read it before starting work, and keep it updated when a decision changes.

## Stack
- Plain HTML + CSS + JS. **No framework, no build step, no npm dependencies, no backend.**
- Files: `index.html`, `style.css`, `game.js`, `/fonts`, plus `styleboard.html` for components.
- Hosted on Vercel as static files. Every milestone ends deployed.
- Local preview: `node tools/serve.mjs` → http://localhost:5173 (also in `.claude/launch.json`). `styleboard.html` is local-only (excluded from deploys via `.vercelignore`).
- `?debug` = fixed seed + hidden answers visible. Use it to check game logic.

## How to work here
- **One milestone at a time** (see `PLAN.md`). Small change → look at it → next change. No "make it look like the reference" in one shot.
- **Build components on `styleboard.html` first**, then use them in the game. Never invent a new style inside the game screen.
- **Don't add features that aren't in `PLAN.md`.** If something seems missing, ask instead of adding.
- Look at the result at phone width (375×812) and on desktop before calling anything done.
- Keep `game.js` readable: plain functions, no classes or abstractions "for later".

## Design rules (non-negotiable)

**Every visible element does something.** No fake readouts, decorative buttons, or controls that only look like controls. If it has no job, delete it.

### Color — use the tokens in `style.css`, never raw hex elsewhere
| Token | Hex | Rule |
|---|---|---|
| `--desk` | `#E3E9EF` | page background behind the window |
| `--shell` | `#F4F7FA` | window body |
| `--key` | `#FFFFFF` | keypad buttons |
| `--primary` | `#34BEED` | title bar, primary action, progress fill. Text on it: `--on-primary` `#0B3A4F` |
| `--silver` | `#A9B4BF` | secondary buttons |
| `--screen` | `#DCEBF5` | problem screen. Text: `--screen-ink` `#16313F` |
| `--cover` | `#B9CEDC` | covered rows. Text: `--cover-ink` `#3E5A6B` |
| `--correct` | `#7FF0CF` | correct feedback **fill only**, text `--on-correct` `#0B3A2E` |
| `--wrong` | `#FF8A8A` | wrong feedback **fill only**, text `--on-wrong` `#4A0E12` |
| `--outline` | `#1A1A1A` | all borders and hard shadows |

- Mint and red are never text colors. Right/wrong also differ by ✓ / `it's 7` and motion, not color alone.
- Always light theme. No dark mode.

### Shape
- 2px `--outline` border on windows, screens, keys, rows.
- Hard offset shadows only: window `3px 3px 0`, keys `2px 2px 0`, color `--outline`. **No blur, no glow, no gradients, no transparency effects.**
- Radius: window 6px, keys/rows 4px, number tags are pills. Nothing else rounded.
- Pressed key: `translate(2px, 2px)`, shadow 0.

### Type
- UI labels: M PLUS Rounded 1c (500, 800).
- Screen text (problems, status line): DotGothic16.
- Timer: DSEG7 Classic.
- All fonts self-hosted in `/fonts`. Never Inter, Roboto, or system-font stacks as the visible style.
- Numbers use tabular figures so they don't jiggle.

### Motion
- Motion explains what happened: the stack slides down and the old row gets covered; correct = small bounce; wrong = 4px shake.
- 150–300ms, ease-out. Nothing loops idly. Nothing animates on page load except the window appearing.
- `prefers-reduced-motion`: keep color changes, remove movement.

### Words
- Screen text: short, uppercase, machine-like: `MEMORIZE`, `RECALL #7`, `NO INPUT`, `NEW BEST`.
- Buttons: 1–2 words (`Retry`, `Pass`, `Again`, `Levels`).
- No emoji. No "Great job!", "Awesome!", exclamation marks, or filler copy.

### Claims
- The intro copy in `PLAN.md` §1b is the only place the game explains its purpose. Reuse its wording.
- **No health, IQ, or "brain boost" claims** beyond it. Never write "get smarter", "boost your brain", "clinically proven", etc. It's a focus workout, and the game says so honestly.

### Banned (slop list)
Purple-blue gradients · glassmorphism · drop shadows with blur · emoji as icons · generic rounded "cards" floating on white · Inter · confetti · placeholder lorem text · icons from mixed sets · disabled buttons with no explanation · anything that copies a real console's logo, characters, or brand marks.

## Game rules (keep in sync with PLAN.md)
- Levels 1–4 back. 20 answers per round. First N problems are memorize-only.
- Single-digit `+`/`−`, answers 0–9, spread evenly, no repeats back to back, no `+0`/`−0`.
- Wrong or Pass: show the right answer, count a miss, continue.
- After problem 20: no new problems, `NO INPUT · RECALL N LEFT` until done.
- Tab hidden: pause timer and cover the stack. Quit mid-round: confirm.
- 250ms grace window to change an answer before it locks.
- Best score per level in `localStorage`, every read/write wrapped in try/catch.

## Phone rules
- Never use `<input>` for answers (no OS keyboard). Keypad only.
- Use `100dvh`, respect safe areas, `touch-action: manipulation` on buttons.
- Keys at least 52px tall. Keypad within thumb reach at the bottom.
- Desktop: digits answer, Enter/Space = Next, P = Pass, Esc = Quit.

## Definition of done (per change)
- Matches the rules above.
- Checked at 375px wide and on desktop.
- No console errors.
- Deployed URL updated.
