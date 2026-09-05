# CLAUDE.md — Bhoomimitra Frontend

You are building the entire frontend for **Bhoomimitra**, a land acquisition
management system for Smart India Hackathon 2026, problem statement 26016
(Ministry of Rural Development, Department of Land Resources).

Read this whole file before writing code. Everything below is decided. Where
something is genuinely open, it says so explicitly — ask me rather than guessing.

---

## 1. What this system is

India's Right to Fair Compensation and Transparency in Land Acquisition,
Rehabilitation and Resettlement Act, 2013 (RFCTLARR) governs how the government
acquires private land for public projects. The process is long, legally
prescribed, and currently tracked across disconnected registers and spreadsheets.
Families lose track of their own case. Officers cannot see where anything stands.

Bhoomimitra makes one acquisition **case** visible from first notification to
final possession, for every role that touches it — the officer running it and
the family living on the land.

**The nine legal stages, in order.** These are the spine of the entire product.
Never invent, rename, reorder or shorten them:

1. `preliminary_notification`
2. `social_impact_assessment`
3. `verification`
4. `objection_period`
5. `declaration`
6. `award`
7. `rnr` (rehabilitation and resettlement)
8. `possession`
9. `monitoring`

**Roles.** Working list — the source of truth is `GET /meta/enums`, so read that
on day one and match it exactly rather than trusting this list:
`landowner`, `affected_citizen`, `field_officer`, `district_officer`,
`state_admin`, `ministry_admin`.

Two roles must visibly see two different applications. A landowner sees their own
case and nothing else. A district officer sees every case in their district plus
administrative controls. This difference is a demo requirement, not a nice-to-have.

---

## 2. Non-negotiable rules

These are the ones that cause real damage when broken. Follow them without
exception.

1. **No component calls `fetch` directly.** The path is always
   page → `useApi` hook → `api/` module → `client.js`. When the backend changes
   a shape, exactly one file changes.
2. **No status, stage or role string is ever typed by hand in a component.**
   They come from `useEnums()`, which reads `GET /meta/enums`. A hardcoded
   `"pending"` that should have been `"Pending"` is a bug nobody finds until the
   demo is running.
3. **All formatting lives in `lib/format.js`.** Dates, rupees, hectares, survey
   numbers. The app must not show three date formats on three screens.
4. **No colour is ever written inline or picked per-screen.** Every colour is a
   CSS custom property from `styles/tokens.css`. If you need a colour that isn't
   there, stop and tell me — don't invent one.
5. **No spacing value outside the scale** (4, 8, 12, 16, 24, 32, 48, 64px).
6. **Compensation and R&R are always two separate things.** Never one merged
   "payment" column, never one combined status. A person with no land title can
   still be owed resettlement. This distinction is what a judge from this
   ministry will look for first.
7. **Every screen handles loading, error and empty.** Build those three
   components before the first page so it stops being something anyone has to
   remember.
8. **No component library** (no MUI, Chakra, Ant, shadcn). Small hand-built
   components in `components/ui/`. No form library either — controlled inputs
   plus `lib/validate.js`.
9. **Section 4 is a hard requirement, not styling advice.** This product must not
   look machine-generated. Before you call any screen finished, re-read section
   4.1 and check your work against it line by line.

---

## 3. Design system

The visual reference is a warm, muted, editorial-institutional landing page.
The feeling: **a government platform designed by someone with taste** — serious
and trustworthy, but soft and human rather than cold and bureaucratic. Earthy
dusty palette. Serif display typography. Photography deliberately faded rather
than vivid. Nothing bright, nothing saturated, nothing shouting.

### 3.1 `src/styles/tokens.css` — write this file first, before any screen

```css
:root {
  /* ---- Brand ---- */
  --brand:            #9E7F87;  /* dusty mauve-rosewood: header, footer, primary actions */
  --brand-hover:      #8B6C74;
  --brand-soft:       #EBD9D9;  /* pale blush: secondary buttons, selected rows */
  --brand-tint:       #F3E8E8;  /* faintest wash: hover rows, active nav */

  /* ---- Surfaces ---- */
  --bg:               #F6EEE7;  /* warm cream ivory — the page, NOT white */
  --surface:          #FDF9F5;  /* cards, tables, panels — a lifted warm off-white */
  --surface-alt:      #EDE3D8;  /* pale sand: table headers, inset panels */
  --border:           #E0D3C8;  /* warm hairline */
  --border-strong:    #C9B8AB;

  /* ---- Text ---- */
  --text:             #2B2523;  /* warm near-black — never pure black */
  --text-muted:       #6E6560;  /* warm grey */
  --text-faint:       #96897F;
  --text-on-brand:    #FFF8F5;

  /* ---- Status (muted and earthy — they must sit in the same register) ---- */
  --ok:               #4F6B52;  /* completed, paid, approved */
  --ok-bg:            #E4EBE2;
  --warn:             #A97C33;  /* due soon, awaiting, in progress */
  --warn-bg:          #F5EAD5;
  --danger:           #9C4A3C;  /* overdue, rejected, blocked */
  --danger-bg:        #F3DFDA;
  --info:             #55697A;  /* informational, neutral state */
  --info-bg:          #E2E8EC;
  --idle:             #8A8078;  /* not started, not applicable */
  --idle-bg:          #EDE7E1;

  /* ---- Type ---- */
  --font-display: "Source Serif 4", Georgia, "Times New Roman", serif;
  --font-ui:      "Inter", -apple-system, "Segoe UI", system-ui, sans-serif;
  --font-mono:    "JetBrains Mono", ui-monospace, "SF Mono", monospace;

  /* ---- Spacing scale — never use a value outside this ---- */
  --s1: 4px;  --s2: 8px;  --s3: 12px; --s4: 16px;
  --s5: 24px; --s6: 32px; --s7: 48px; --s8: 64px;

  /* ---- Radius & elevation ---- */
  --r-sm: 4px; --r-md: 6px; --r-lg: 10px;
  --shadow: 0 1px 2px rgba(43,37,35,0.06), 0 1px 8px rgba(43,37,35,0.04);
}
```

Load `Source Serif 4` (weights 400, 600, 700) and `Inter` (400, 500, 600) from
Google Fonts in `index.html`. Always give a real fallback stack.

### 3.2 The two-register rule

The landing page and the application are the same brand in two different
registers. Getting this split right is the single most important design
decision in the build.

| | Public pages (Landing, Notices, Login) | Application (everything behind auth) |
|---|---|---|
| Display type | `--font-display` serif, large — 40–44px headings, tight leading (1.15) | `--font-display` serif for page titles only, 22–26px |
| Body & data type | serif, 14–15px, generous line-height | `--font-ui` (Inter), 13–14px — **all tables, forms, labels, numbers** |
| Density | very generous — 80–96px section padding | efficient — 16–24px, tables read at a glance |
| Photography | full-bleed, washed | none, except the login panel |
| Background | `--bg` cream | `--bg` cream page, `--surface` cards |
| Contrast | soft and low | higher — this is a working tool |

**Why:** the landing page has to feel like a considered institution. The
dashboard has to let a district officer find an overdue case in two seconds.
Dense data set in a serif at 13px is unreadable; a marketing page set in Inter
looks like every other hackathon project.

### 3.3 Colour rules

- **The brand mauve never indicates status.** It is reserved for chrome and
  actions — sidebar, header, primary buttons, links, selected tab. A mauve
  element always means "this is navigation or a thing you can click", never
  "this is a state". The status palette above is the only thing that carries
  state meaning. This matters because `--brand` and `--danger` are close in
  value, and a mauve badge would read as an alert.
- **One accent, used sparingly.** If everything is coloured, nothing reads as
  clickable.
- **Status is always colour plus a word.** `StatusBadge` renders a coloured dot
  or tinted pill *and* the label text. Never colour alone — some judges will be
  colour blind and some rooms have terrible projectors.
- **No pure white and no pure black anywhere.** Every neutral is warmed toward
  red/brown.

### 3.4 Component styling

- **No shadows beyond `--shadow`.** No gradients, no glassmorphism, no glow.
- **Buttons:** ~10px/22px padding, `--r-md` radius, no uppercase, no icons
  inside, no shadow. Primary is filled `--brand` with `--text-on-brand`.
  Secondary is filled `--brand-soft` or `--surface-alt` with `--text`. Never
  outlined or ghost. On the landing page keep them deliberately modest next to
  the large headlines.
- **Tables:** `--surface` background, `--surface-alt` header row, `--border`
  hairlines, row hover `--brand-tint`. Numbers right-aligned and tabular
  (`font-variant-numeric: tabular-nums`). Rows are clickable with a visible
  focus ring.
- **Cards and panels:** `--surface`, 1px `--border`, `--r-lg`, no shadow unless
  floating.
- **Photography treatment:** every photo gets a cream wash — either a
  `#F6EEE7` overlay at 28% opacity or `filter: saturate(0.7) brightness(1.06)`.
  Greens must go muted. Photos are never punchy.
- **Icons:** thin line icons only (`lucide-react`). Never inside buttons or
  headings. 16–18px, `--text-muted`.

### 3.5 The Figma file is the reference — check it before every screen

Exported Figma frames live in `design/` at the repo root as PNGs, named after the
screen they show:

```
design/
├── README.md              # what each frame is, and anything the export cannot show
├── landing.png
├── login.png
├── dashboard.png
├── case-list.png
├── case-detail.png
├── map-view.png
└── components.png         # buttons, badges, inputs, table rows, in every state
```

**Before building any screen, read its frame in `design/` and describe back to me
what you see** — layout, spacing, hierarchy, what is emphasised. If your reading
and the image disagree, we catch it before the code exists rather than after.

Where the Figma and this file conflict: **the tokens in 3.1 win for colour, type
and spacing values** (they are written down and consistent), and **Figma wins for
layout, composition and hierarchy** (a person made those decisions on a canvas).
If a conflict is more than cosmetic, stop and ask rather than picking one.

If a screen has no frame in `design/`, say so and build it from section 3 and
section 4 — do not invent a layout and present it as matching the design.

### 3.6 Accessibility, non-optional

Every input has a real `<label>`. Focus is always visible — a 2px `--brand`
outline with 2px offset. Body text hits 4.5:1 against its background; check
`--text-muted` on `--bg` and darken it if it fails. The field officer view must
work on a phone.

---

## 4. Making it look like people made it

The likeliest failure of this build is a frontend that is competent, tidy, and
instantly recognisable as machine-generated. Judges sit through a dozen of those
in a day and stop looking closely at any of them.

The reason AI-built interfaces look the way they do is that they land on the
*average* of every website — the safest choice at every decision. Design that
reads as human-made is the opposite: a specific set of choices, including a few
that an average would never produce. Everything in this section is about making
specific choices instead of safe ones.

Treat this section as binding. It is easier to follow at the start than to
retrofit on day five.

### 4.1 Never ship these

Each of these is a giveaway. There are no exceptions on this list.

- **The three-card feature grid.** Three equal boxes in a row, each with an icon
  on top, a short heading, and two lines of grey body copy. Nothing says
  generated louder.
- **Centred everything.** Centre a headline when the composition calls for it,
  not by default. Left-aligned text on a photograph, as in the reference hero,
  is a decision; centred is a fallback.
- **Uniform radius, uniform shadow.** Every card the same corner, every surface
  floating on the same soft shadow. Most elements should have neither.
- **`transform: scale()` on hover.** Nothing lifts, grows, or bounces. Hover
  changes background or border colour by one step. That is the whole vocabulary.
- **Gradients.** No gradient backgrounds, no gradient text, no gradient buttons.
  Especially not purple-to-blue.
- **Emoji used as icons.** Thin line icons or nothing.
- **Eyebrow labels.** The small uppercase tracked-out word above every section
  heading. Use at most once in the entire product, if at all.
- **Scroll-triggered fade-up on every section.** Either no scroll animation, or
  one, in one place, for a reason.
- **Pill badges** reading "New", "Beta", "AI-Powered", "Coming soon".
- **Icons inside buttons.** Already banned in section 3.4; it belongs here too.
- **Marketing verbs.** Never write "streamline", "seamless", "empower",
  "revolutionise", "transform your workflow", "powerful", "cutting-edge",
  "one-stop solution", "get started today". If a sentence would fit on any
  product's homepage, it is wrong for this one.
- **Placeholder content.** No "Case 1", "Project A", "John Doe", "Lorem ipsum",
  "₹1,00,000". See 4.3 — this is the big one.
- **Identical vertical padding on every section.** See 4.2.

### 4.2 Do these instead

**Vary the rhythm between sections.** A page where every band has the same 96px
of padding reads as generated. Give the hero room, let the section under it
breathe wider still, then run the photo strip tight against its neighbours with
almost no padding at all. The reference does exactly this — the strip sits
flush, and it is the most human moment on the page.

**Break the grid once per page, deliberately.** One element that refuses to sit
in the container: the photo strip bleeding off both edges and cutting an image
mid-figure; a heading that hangs a few pixels into the left margin; a panel that
overlaps the boundary between two sections. Once per page. Twice reads as
careless, never reads as machine-made.

**Align optically, not mathematically.** A large serif capital needs to sit
2–3px left of the body text beneath it to *look* aligned. Quotation marks hang
outside the measure. Numbers in a table align on their digits, not their box.
This is the single most reliable tell of a person having looked at the screen.

**Choose type sizes, don't generate them.** Not every size comes from doubling
16. If the hero headline balances the photograph at 41px, use 41px. Odd numbers
are evidence of judgement.

**Let density differ inside one screen.** On the dashboard, give the five KPI
tiles generous air and set the alerts table directly beneath them tight and
scannable. Uniform density across a whole screen means nobody decided what
mattered.

**Prefer asymmetry where it does work.** A 62/38 split between case detail and
its sidebar reads better than 50/50 and looks considered. Content offset from
centre beats content centred.

**Spend effects where they mean something.** Almost nothing gets a shadow. The
one modal and the one map popup do, because they genuinely float. When only two
things in the product are elevated, elevation carries meaning.

**Mark state with the smallest mark that works.** An overdue row gets a 3px
`--danger` left border and its date in `--danger`, not a full pink background.
Restraint reads as confidence.

**Let one or two details be idiosyncratic.** A hairline rule under a section
heading that stops at 64px instead of running the full width. A table caption in
italic serif while everything around it is Inter. The parcel area set in a
heavier weight than its unit label. Small, specific, and impossible to generate
by averaging.

### 4.3 Content is the strongest signal — stronger than layout

A generic dashboard with real content reads as a real product. A beautiful
dashboard with `Case 1 / Project A / ₹1,00,000` reads as a mockup, immediately,
to everyone in the room.

Use realistic Indian administrative data everywhere, including in every stub:

- **Districts and villages:** Nashik, Guntur, Dharwad, Bhilwara, Purba Bardhaman;
  villages like Ozar, Chinnavadlapudi, Annigeri.
- **Projects with real shape:** "Nashik–Sinnar Four-Laning, Package 3",
  "Polavaram Left Main Canal, Reach IV" — not "Highway Project".
- **Survey numbers in the real format:** `127/2A`, `88/1B`, `304`.
- **Rupee amounts that are not round:** ₹4,82,600 and ₹11,37,450, never
  ₹5,00,000. Awkward figures look computed; round ones look typed.
- **Areas in hectares to two decimals:** 0.83 ha, 2.14 ha.
- **Long officer titles that will break your layout:** "Special Land Acquisition
  Officer, Irrigation Division II". If a title fits comfortably everywhere, it
  is too short to be real. Test with the longest one you can find.
- **Names of real length,** including long South Indian names and names with
  initials — `M. Venkata Subbaiah`, `Kavitha Ramachandran`.

Ask the AI Layer team for their seed data on day one and build against it. A
layout built around short invented values falls apart the moment real data
arrives, and it always arrives too late to fix properly.

**Copy has a voice.** The reference headline — "From Land to Lives" — is a human
line: it is about people, it is slightly unusual, and no other product could use
it. Write to that standard. Where the product speaks to families rather than
officers, say plainly what happens next and when, because that is the actual
problem being solved.

### 4.4 Domain specificity beats visual polish

The strongest defence against looking generic is that this product could not be
anything else. A generated dashboard is domain-agnostic — swap the labels and it
sells software, tracks tickets, or manages inventory equally well.

So lean hard into what only this system has: the nine-stage statutory timeline
with real dates and the officer who advanced each stage; the compensation and
R&R split shown as two separate tracks with different completion states; the
title-holder distinction on the affected-persons list; parcels on the map
coloured by acquisition status with survey numbers in the popup; the missing
documents panel that knows which documents this stage legally requires.

Build those five things properly and the product cannot be mistaken for a
template, whatever the styling.

### 4.5 The review loop

You cannot see what you built. I can. So after each screen:

1. You tell me the screen is ready and what you were unsure about.
2. I look at it in the browser and against the Figma frame, and send you a
   screenshot with notes.
3. You fix only what I flagged.

Do not move to the next screen before that loop closes on the current one.
Ten screens each one round of review away from right is a worse position on day
five than five screens actually finished.

---

## 5. Folder layout

React 18 + Vite + plain CSS (CSS custom properties, no Tailwind, no CSS-in-JS).
React Router for routing. `react-leaflet` for maps. `recharts` only if a chart
is genuinely needed on the dashboard.

```
frontend/
├── index.html
├── package.json
├── vite.config.js
├── .env.example                 # VITE_API_URL only
└── src/
    ├── main.jsx
    ├── App.jsx                  # routes + auth provider
    │
    ├── styles/
    │   ├── tokens.css           # section 3.1 — written FIRST
    │   └── base.css             # reset, typography defaults, focus ring
    │
    ├── api/                     # mirrors backend routers 1:1
    │   ├── client.js            # base url, token header, error unwrap
    │   ├── auth.js
    │   ├── cases.js
    │   ├── parcels.js
    │   ├── persons.js           # incl. compensation + rnr
    │   ├── documents.js
    │   ├── objections.js
    │   ├── dashboard.js
    │   └── meta.js
    │
    ├── auth/
    │   ├── AuthContext.jsx      # current user, token, login, logout
    │   └── RequireRole.jsx      # route guard by role
    │
    ├── hooks/
    │   ├── useApi.js            # loading / error / data, in one place
    │   └── useEnums.js          # /meta/enums fetched once and cached
    │
    ├── components/
    │   ├── states/              # Loading, ErrorState, Empty — build FIRST
    │   ├── ui/                  # Button, Input, Select, Badge, Modal, DataTable
    │   ├── layout/              # AppShell, Sidebar, TopBar, PageHeader
    │   ├── public/              # PublicHeader, PublicFooter, Hero, PhotoStrip
    │   ├── case/                # StageTimeline, StatusBadge, CaseTable
    │   ├── map/                 # ParcelMap, ParcelPopup, MapLegend
    │   └── dashboard/           # KpiTile, AlertList, StageChart
    │
    ├── pages/
    │   ├── Landing.jsx
    │   ├── Notices.jsx
    │   ├── Login.jsx
    │   ├── Dashboard.jsx
    │   ├── CaseList.jsx
    │   ├── CaseDetail.jsx
    │   ├── CaseCreate.jsx
    │   ├── MapView.jsx
    │   ├── ParcelDetail.jsx
    │   └── NotAuthorised.jsx
    │
    └── lib/
        ├── format.js            # dates, rupees, hectares — one place, always
        └── validate.js          # small form validation helpers
```

`api/` mirrors the backend's routers one file at a time on purpose: a contract
mismatch then shows up as an obvious difference between two files instead of
being buried inside a component.

---

## 6. The API contract

Base URL from `import.meta.env.VITE_API_URL`. Auth is a bearer token in the
`Authorization` header, stored by `AuthContext`.

**Every list endpoint returns this envelope:**
```json
{ "items": [], "total": 0, "page": 1, "page_size": 20 }
```

**Every error returns this shape:**
```json
{ "detail": { "code": "case_not_found", "message": "..." } }
```
`client.js` unwraps that into a normal `Error` with `.code` and `.message`, so
the whole app writes one error handler instead of nine.

Money arrives as **integers in whole rupees** — never floats. `format.js`
renders them with the Indian digit grouping (₹12,34,567). Timestamps are UTC ISO
strings; dates without times where the domain has no time.

### Endpoints

```
POST   /auth/login                     → token + user role
GET    /auth/me                        → current user; called on load
GET    /meta/enums                     → stages, statuses, roles, doc types
GET    /health

GET    /cases                          ?district&project&stage&status&q&page&page_size
POST   /cases                          → starts at preliminary_notification
GET    /cases/{id}                     → case, parcels, people, counts (one call)
PATCH  /cases/{id}                     → edit fields, NOT the stage
POST   /cases/{id}/advance             → next legal stage; validates transition
GET    /cases/{id}/history             → stage transitions in order → timeline
GET    /cases/{id}/audit               → who changed what, when

GET    /parcels                        ?bbox&status&district&q  → GeoJSON
GET    /parcels/{id}
GET    /cases/{id}/parcels
POST   /cases/{id}/parcels

GET    /cases/{id}/persons             → affected people, title-holder flag,
                                         compensation + rnr records inline
POST   /cases/{id}/persons
PATCH  /compensation/{id}
PATCH  /rnr/{id}                       → deliberately separate from compensation

GET    /cases/{id}/documents
POST   /cases/{id}/documents           → multipart
GET    /documents/{id}/download
GET    /cases/{id}/documents/missing   → what this stage requires but lacks

GET    /cases/{id}/objections
POST   /cases/{id}/objections          → citizen role
PATCH  /objections/{id}                → officer response and outcome

GET    /dashboard/kpis                 ?district&project
GET    /dashboard/alerts               ?severity
GET    /dashboard/stage-distribution
```

**The five KPIs** on the dashboard, fixed: area notified vs. acquired,
compensation awarded vs. paid, affected families count, R&R completion status,
possession metrics.

If the backend has not shipped an endpoint yet, build against its published stub
response. Never invent a shape — if the stub is missing, tell me and stop rather
than guessing a schema we'll have to unpick later.

---

## 7. What to build

Shared pieces first, then screens. Nothing tagged `next` starts while anything
`core` is unfinished.

### Shared — before any page

| | |
|---|---|
| `core` `states/*` | Loading, ErrorState, Empty. Three small components every page then uses for free. |
| `core` `AppShell` | Sidebar, top bar, current user and role, logout. Every app page renders inside it. |
| `core` `DataTable` | Sortable columns, right-aligned tabular numbers, clickable rows, empty slot. Built once, used on five screens. |
| `core` `StatusBadge` | Tinted pill, colour **plus** word. |
| `core` `ui/` basics | Button, Input, Select, Modal. Small and consistent beats a library this week. |

### Public pages

| | |
|---|---|
| `core` `Landing` | Mauve header bar with the BHOOMIMITRA wordmark in heavy serif caps. Full-bleed washed hero photo (highway through farmland), left-aligned serif headline on it, Login + Signup buttons. Cream section below, centred serif headline, Notices + Case Studies buttons. Horizontal photo strip bleeding off both edges. Mauve footer with tagline, thin social icons, and three link columns. |
| `core` `Notices` | Public notice board — published notifications by district and project. This is not decoration: publishing notifications publicly is a statutory requirement under the Act, and it demos well. |
| `core` `Login` | Error on failure, loading while checking, then route by role. |

### Application pages

| | |
|---|---|
| `core` `Dashboard` | Five KPI tiles, alerts panel with clickable rows. The first thing judges see. |
| `core` `CaseList` | Filters for district, stage, status; search; overdue rows visibly marked; pagination. |
| `core` `CaseDetail` | The biggest screen. Header, stage timeline, parcels, people, documents, objections, audit. |
| `core` `StageTimeline` | The nine legal stages showing where this case stands, with dates and who advanced it. **The centrepiece component — treat it as the product, not a detail.** |
| `core` `MapView` | Parcels coloured by status, click for detail, bbox refetch on pan. |
| `core` `CaseCreate` | Validated form, clear per-field errors, confirmation on success. |
| `core` Advance stage | Modal on CaseDetail with a confirm step. Small, and it makes the timeline come alive. |
| `next` `ParcelDetail` | Survey number, owner, area, linked case. |
| `next` Objection form | Filing view for the citizen role — makes the role split visible in the demo. |
| `next` `NotAuthorised` | For a role reaching a page it cannot open. |
| `bonus` Print view | Print stylesheet on CaseDetail. Cheap, and reads as very government. |

### Two things that must be visible on screen

- **Compensation and R&R are separate columns** wherever people are listed.
  Never merged.
- **Affected families are not only landowners.** Where you list people, make the
  title-holder distinction visible rather than calling everyone an owner.

---

## 8. Build order

Work in this order. Do not start a phase while the previous one's gate is unmet.

**Phase 0 — skeleton and palette.**
Vite project runs. Folder structure created empty. `tokens.css` and `base.css`
written. `client.js` shell reading the base URL from env. Routing shell with
placeholder pages.
*Gate:* it runs, and the palette is settled so no colour gets invented later.

**Phase 1 — contract and shared pieces.**
Every `api/` module written to match the backend's published shapes exactly.
The three state components and `useApi`. `useEnums`. AppShell, DataTable,
StatusBadge, ui basics. Login working against the backend's stub.
*Gate:* a page can call the API and correctly render loading, error and empty
without any real data existing.

**Phase 2 — every screen exists, on stub data.**
All core pages render against stubs. Landing page built properly. Stage timeline
built — give it real attention. Map renders stub GeoJSON. Navigation works end
to end.
*Gate:* you can click the entire demo path and it looks convincing, even though
every value is invented.

**Phase 3 — real data on the spine.**
Case list and detail switched to live endpoints. Map switched to real parcels
with bbox refetch. Filters and search working against the real API. Layouts
checked against real seed data — long village names and long officer titles will
break something.
*Gate:* one genuine case is visible on screen and on the map, nothing faked.

**Phase 4 — the rest of the surface.**
Documents list and upload with progress and real errors. Objections list, filing
form, response view. Compensation and R&R as separate columns. Create case and
advance stage, both with validation and confirmation. Audit trail view.
*Gate:* a case can be walked from notification to possession entirely through
the interface.

**Phase 5 — dashboard, roles, polish.**
Dashboard on real KPIs and real alerts, alerts clickable through to cases. Every
role logged into and checked — they must genuinely differ. Mobile pass on the
field officer view. Empty and error states reviewed on every screen, not just
the busy ones. Keyboard focus visible, labels on every field.
*Gate:* nothing on screen is invented, and two different roles visibly see two
different applications.

**Phase 6 — freeze.**
No new screens, no new components, nothing "quick". Fix only what breaks during
a rehearsal.

**If time runs short:** finish Landing, Dashboard, CaseList, CaseDetail with its
timeline, and MapView completely — including their loading, empty and error
states — and drop everything else. Five screens that work properly on realistic
data demo far better than ten that are each nearly there.

---

## 9. How to work with me

- **Work one screen or one component at a time.** Finish it, tell me what you
  built and what you assumed, then stop. Do not build three pages in one go.
- **Open the Figma frame in `design/` first** and tell me what you see before you
  write the screen. Then build, then wait for the review loop in 4.5 to close.
- **Say when you are guessing.** If a response shape, an enum value or a role
  permission isn't specified above, ask — don't invent it and move on. An
  invented shape costs an hour to unpick on day four.
- **Flag contract mismatches loudly.** If the backend returns something that
  doesn't match section 6, stop and tell me rather than patching around it in
  the component.
- **Never fake data inside a component to make a screen look finished.**
  Stub data lives in the `api/` module behind a flag, so there is exactly one
  place to remove it.
- **Prefer boring.** No clever abstractions, no premature generalisation.
  Six people are reading this code under time pressure.
