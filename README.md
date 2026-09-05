# Bhoomimitra — Frontend

Land acquisition case management for Smart India Hackathon 2026, problem
statement 26016 (Ministry of Rural Development, Department of Land Resources).

React 18 + Vite + plain CSS. No component library, no CSS framework, no form
library. `CLAUDE.md` is the design and architecture brief and is binding —
read it before changing anything visual.

## Running the whole stack

Three things have to be up: the database, the API, and this.

**1. Backend and database** (from `../sih26016-backend`):

```bash
docker compose up -d
docker compose exec api python -m app.ai_layer.seed
curl -X POST localhost:8000/admin/run-rules \
  -H "Authorization: Bearer $TOKEN"
```

API on <http://localhost:8000>, interactive docs at `/docs`.
Postgres on host port **5433**, loopback only.

> **Reseed on the day.** The seed builds every date relative to *now*, while
> the alert rules evaluate against today. A database seeded days earlier ages
> past the stalled thresholds and the dashboard fills with red — 11 alerts
> becomes 16 after one day. `seed` then `run-rules` takes about three seconds
> and restores exactly 11.

**2. Frontend** (from here):

```bash
npm install
cp .env.example .env     # VITE_API_URL=http://localhost:8000
npm run dev
```

<http://localhost:5173>

```bash
npm run build    # production bundle into dist/
npm run lint     # eslint, currently clean
```

## Signing in

Every demo account uses the password the database was seeded with —
`demo1234` unless `SEED_PASSWORD` was set. The sign-in screen lists
them and fills the form when you pick one.

| Username | Role | Sees |
|---|---|---|
| `admin` | State Administrator | Every district, plus the district filter |
| `dc.bengaluru` | District Collector | Bengaluru Rural only |
| `dc.tumakuru` | District Collector | Tumakuru only |
| `slao.bengaluru` | Special Land Acquisition Officer | Can move cases and record compensation, **not** R&R |
| `rnr.bengaluru` | R&R Officer | Can record resettlement, **not** compensation |
| `field.bengaluru` | Field Officer | Read plus documents and households |
| `landowner` | Landowner | One case — their own — and nothing else |

The role split is real, not cosmetic: a landowner gets two navigation items
instead of five, no dashboard, no map, and no audit trail. Signing in as
`dc.bengaluru` and then as `landowner` is the fastest way to show it.

## How the code is arranged

```
src/
├── api/          one module per backend router; the only place fetch is called
├── auth/         AuthContext, RequireRole, and the role→permission map
├── hooks/        useApi (loading/error/data), useEnums (/meta/enums, cached)
├── components/   states/ ui/ layout/ public/ case/ map/ dashboard/
├── pages/        one file per route
├── lib/          format.js (dates, rupees, hectares), labels.js, validate.js
└── styles/       tokens.css (the palette), base.css
```

Four rules that matter more than the rest:

1. **No component calls `fetch`.** Page → `useApi` → `api/` module →
   `client.js`. A contract change touches one file.
2. **No status, stage or role string is typed in a component.** They come
   from `/meta/enums` via `useEnums()`; `lib/labels.js` turns a value into
   display text and falls back to a humanised form for anything new.
3. **All formatting is in `lib/format.js`.** Money arrives as integers in
   whole rupees and renders with Indian grouping (₹12,34,567).
4. **Compensation and R&R never merge.** Two columns, two dialogs, two role
   guards. A household with no land title has no compensation record and a
   live resettlement entitlement — that row is the point of the product.

## Photographs

`public/photos/` — see the README in that folder. Filenames are fixed, so
replacing an image needs no code change. Send them at full contrast; the app
applies the wash itself.

## Registering

Accounts are not self-serve. `/signup` asks for an invitation code first,
shows which role and district it grants, and only then takes a password. The
role comes from the invitation server-side, so nothing the form sends can
change it.

An administrator mints codes at `POST /admin/invite-codes`. **The response is
the only time a code is readable** — it is stored as a bcrypt hash, so a lost
code is revoked and reissued rather than looked up.

## Known gaps

- Case editing (`PATCH /cases/{id}`) exists on the API but has no screen; the
  case header is read-only in the interface.
- `design/` holds only landing-page frames. Every other screen was built from
  CLAUDE.md §3 and §4, not matched to a Figma export.
- Four palette tokens are darker than CLAUDE.md §3.1 specifies, for contrast.
  See `design/README.md`.
- Phone layout is verified for overflow and tap-target size at 390px, but has
  not been used on a real handset.
