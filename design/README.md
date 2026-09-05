# Design reference

Exported Figma frames. Claude Code reads these — keep them current.

## How to export from Figma

1. Select the frame on the canvas (click its name in the layers panel so the
   whole frame is selected, not a child).
2. Export panel, bottom right → **+** → **PNG**, scale **2x**.
3. Export, and save into this folder using the filename in the table below.

Re-export whenever the design changes. A stale frame here is worse than no
frame, because it will be followed.

## Frames

| File | Frame in Figma | Notes |
|---|---|---|
| `landing.png` | Landing / Desktop | The whole page, top to bottom |
| `landing-hero.png` | Landing / Desktop | Header + hero at detail — read type sizes off this one |
| `landing-lower.png` | Landing / Desktop | Cream band, photo strip, footer at detail |

**Not yet exported.** These screens have no frame and were built from
CLAUDE.md §3 and §4 and the landing page's own vocabulary, not matched to a
design. Export them and this note goes away:
`login`, `dashboard`, `case-list`, `case-detail`, `map-view`, `components`.

## What the export cannot show

Write anything here that a flat PNG loses — hover and focus states, what is
scrollable, what collapses on mobile, which elements are clickable, animation
if any. Claude Code cannot infer these from an image, so anything not written
down here will be guessed.

- Long officer titles must wrap, not truncate with an ellipsis.
- The photo strip on the landing page scrolls horizontally and is meant to be
  cut off at both edges.
- The hero photograph is washed hard enough that near-black serif sits on it
  legibly; the headline is never reversed out in white.
- The footer wordmark is sentence case (`Bhoomimitra`), the header wordmark is
  caps (`BHOOMIMITRA`). That difference is deliberate.
- Hover on a button darkens its fill one step. Nothing scales, lifts or glows.

## Where the build departs from these frames

Four colours are darker than CLAUDE.md 3.1 specifies, because the values
there did not meet the 4.5:1 contrast that 3.6 calls non-optional. Same hues,
measured, and documented in `src/styles/tokens.css`:

| Token | Spec | Built | Was | Now |
|---|---|---|---|---|
| `--brand` | `#9E7F87` | `#866B72` | 3.42:1 | 4.59:1 |
| `--warn` | `#A97C33` | `#886429` | 3.14:1 | 4.51:1 |
| `--idle` | `#8A8078` | `#6F6761` | 3.15:1 | 4.52:1 |
| `--text-faint` | `#96897F` | `#766B63` | fails | 4.52:1 |

`--brand` is the visible one: the header, footer and sidebar are a step
deeper than the frame. If you re-export, expect that difference and keep it
— reverting reintroduces unreadable text on every primary button.
