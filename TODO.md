# VitaPlan — Roadmap & Known Issues

How to use this file: tell Claude (or open a PR) referencing an item's ID.
**Bug reports belong in [GitHub Issues](https://github.com/codeman256/nutrition-app/issues)**
— Claude can read them from there; this file is for the curated roadmap.
`[ ]` todo · `[y]` requested next · `[~]` in progress · `[x]` done.

## Bugs (from real use, 2026-07-19)

- [ ] **B1 — Weight entry in ft/lbs is unusable.** Typing "1" immediately
  becomes "1.10" and won't accept more digits (round-trip kg↔lbs conversion
  fires on every keystroke). Metric entry is fine. Keep imperial fields as
  their own state; only convert on blur/submit.
- [ ] **B2 — Date-of-birth picker is confusing.** Native date input hides the
  day grid until you click the month/year header. Replace with an explicit
  day/month/year control (or a clearer custom picker).
- [ ] **B3 — Trusted origin required to sign up.** Had to add
  `http://10.3.2.10:3011` (and later the proxy domain) or account creation
  failed. Auto-trust the request's own origin so a single-origin deployment
  needs no config; keep the env var for extra origins but surface it in the
  **normal** unraid template settings, not Advanced.
- [ ] **B4 — Barcode scan gives no confirmation.** Hard to capture; when it
  does, show the detected number in a field so the user can confirm it's
  right before/while looking up.
- [ ] **B5 — Regimen weekday toggles look unselected.** All 7 days are ON by
  default when a product is enabled, but the styling made the user think they
  were off and they deselected. Make "all days" state obvious (e.g. an
  "Every day" chip / clearer active styling / helper text).

## Correctness (+ on-site education the user asked for)

- [ ] **C1 — Vitamin A forms (RAE).** Beta-carotene supplement factor was
  wrong (0.15; should be **0.5** mcg RAE per mcg β-carotene, and **0.3** IU→
  RAE). Centrum lists "Vitamin A (acetate) 300 mcg RAE" + "Beta-Carotene
  900 mcg" — both are vitamin A but the β-carotene 900 mcg = 450 mcg RAE.
  Add a **form** picker for vitamin A rows and convert mass by form.
- [ ] **C2 — DSLD multi-serving labels.** Import uses the first quantity row
  per ingredient; multi-serving-column labels may mis-import.
- [ ] **C3 — Folate DFE / folic acid.** RDA is in DFE (folic acid ×1.7), UL
  is in folic-acid mcg (×1.0). We compare to the UL 1:1 (safety-correct);
  document this and add a tip rather than double-count.
- [ ] **C4 — Unit & acronym education.** On-site tips/definitions: mcg vs mg,
  IU, RAE, DFE, RDA, AI, UL, DV — hover definitions for acronyms, and inline
  help on the product form for tricky rows (vitamin A, D, E, folate).

## Dashboard

- [x] **D1 — Units unclear.** Unit column now sits *after* the columns it
  describes, acting as a divider: everything left of it is in that unit,
  everything right is a percentage. Plus a "Show units" toggle — as on the
  label (default), everything in mcg, everything in mg, or IU where it
  applies (vitamins A/D/E only). Conversions are unit-tested.
- [x] **D2 — Move "What if I add…" to the bottom** of the page.
- [x] **D3 — Acronym tooltips** (RDA/AI/UL/DV) on the column headers.
- [x] **D4 — Source citations for status.** "300% over limit on B3 — says
  who?" Each nutrient name links to its NIH fact sheet.
- [x] **D5 — Show % Daily Value** column alongside % target (was F1).
- [ ] **D6 — Density at scale.** Fine at 6 products; plan for a compact mode
  as the grid grows.

## Products

- [ ] **P1 — Pill/bottle colour options** per product (a few preset colours
  as an alternative to the 💊 default / uploaded photo).
- [ ] **P2 — Barcode → no nutrients (Centrum via OFF).** Open Food Facts
  returned the product but no amounts; NPN import worked. When a UPC hit has
  zero usable ingredients, tell the user and nudge toward NPN/label/manual.
- [~] **F5 — OCR preprocessing** (grayscale/threshold before tesseract).
- [ ] **F4 — Optional AI label reading** (Claude API, bring-your-own-key).
- [ ] **F2 — Stock tracking** (days-remaining/low-stock from servings/container).
- [ ] **F6 — Adherence check-off.**

## Admin & data

- [x] **A1 — First user is admin.** Admin-only `/admin` page: in-browser
  **backup** (download the SQLite DB) and **restore** (upload) — handy for
  copying the local dev DB onto the unraid instance.
- [x] **A2 — Admin controls LNHPD sync schedule** (never / weekly / monthly /
  quarterly) plus a manual re-sync button. `instrumentation.ts` checks the
  schedule after boot and every 6h.
- [x] **R1 — LNHPD sync as a background job** with a polled progress endpoint —
  POST starts it and returns immediately; GET reports live row count.
- [x] **R5 — Backup story** — README "Backup & restore" section + the A1
  in-browser flow.

## Ops & quality

- [x] **R2 — Docker HEALTHCHECK** for unraid's health indicator (hits
  `/api/health`, which pings the DB).
- [ ] **R3 — arm64 image** (`linux/arm64` in buildx).
- [ ] **R4 — Login rate limiting.**
- [x] **F3 — Printable week view** of the regimen (`/regimen/print`, print CSS
  hides the app chrome).
- [x] **Q1 — Playwright e2e suite** in CI (smoke: health probe, auth redirect,
  sign-up → consent → profile). Runs against `next dev` on a throwaway DB.
- [ ] **Q2 — Automated axe/Lighthouse a11y pass** in CI.

## Done

- [x] unraid appdata permissions (entrypoint chowns `/data`, drops to
  PUID/PGID 99:100, UMASK) — fixed the first-deploy `SQLITE_CANTOPEN`.
- [x] Auth secret auto-generates into `/data/.auth-secret` when blank.
- [x] Plain-HTTP LAN login (secure cookies opt-in via `USE_SECURE_COOKIES`).
- [x] LNHPD brand search across company name + ingredient dedupe.
