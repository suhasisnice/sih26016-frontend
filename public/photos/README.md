# Photographs

Drop your images in this folder using **exactly these filenames**. The app
references them by name, so replacing a file is all that is needed — no code
change, and the dev server picks it up on refresh.

`strip-1` to `strip-6` are low-quality crops lifted out of the Figma
screenshot. `strip-7` to `strip-11` are blank placeholders that say so on
their face. All of them are meant to be overwritten.

The strip is a continuous marquee: the eleven tiles are rendered twice and the
track drifts by exactly half its width, so the loop is seamless. Eleven is not
a fixed number — add `strip-12.jpg` and change the `length` in
`src/components/public/PhotoStrip.jsx` and the loop still closes, because the
spacing is a per-tile margin rather than a flex gap.

| Filename | Where it appears | Orientation | Good size |
|---|---|---|---|
| `hero.jpg` | Landing page hero, full-bleed behind the headline | Landscape, wide | 2000×900 or larger |
| `login.jpg` | Left panel of the sign-in screen | Portrait or square | 1200×1400 |
| `strip-1.jpg` … `strip-11.jpg` | The photo strip above the footer | **Portrait** | 800×1040 each |

`.jpg` is what the code expects. If yours are `.png`, either rename them or
tell me and I will change the references.

## What the photographs should be

Infrastructure and the land it is built on, as it actually looks in India:
highways through farmland, irrigation canals and dams, railway alignment
works, metro viaducts, flyover construction, fields before acquisition.
People at work in them is good. Stock-photo gloss is not.

## They are washed by the app, not by you

Do **not** pre-fade or desaturate them. `public.css` applies the treatment —
`saturate(0.62) brightness(1.09)` on the hero plus a cream overlay, and
`saturate(0.66) brightness(1.06)` on the strip — so greens go muted and the
near-black serif headline sits on top legibly.

Send the originals at full contrast. If a photograph is already faded before
the filter runs, it comes out grey and lifeless.

## The hero has text over it

The headline sits on the **left third** of `hero.jpg`, in near-black serif.
Pick an image whose left side is relatively open — sky, field, road surface —
rather than one with the busiest detail there. The reference image works
because the farmland on the left is quiet and the highway carries the right.
