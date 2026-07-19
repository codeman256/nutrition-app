# VitaPlan — Roadmap & Known Issues

How to use this file: tell Claude (or open a PR) referencing an item's ID.
**Bug reports belong in [GitHub Issues](https://github.com/codeman256/nutrition-app/issues)**
— Claude can read them from there; this file is for the curated roadmap.

## Correctness

- [ ] **C1 — Folate/niacin form conversions.** DRI folate values are in DFE
  and supplemental folic acid counts 1.7× (niacin has a similar NE story).
  Labels are currently imported 1:1, which understates folic-acid intake vs
  the UL. Generalize the per-form factor mechanism (`iuFactors`) to cover
  DFE/NE.
- [ ] **C2 — DSLD multi-serving labels.** Import uses the first quantity row
  per ingredient; labels with multiple serving-size columns may mis-import.

## Robustness

- [ ] **R1 — LNHPD sync as a background job.** Today it's one long HTTP
  request with a toast; behind a reverse proxy it can time out client-side.
  Move to start-job + polled progress endpoint, and nudge for a monthly
  re-sync (Health Canada updates daily).
- [ ] **R2 — Docker HEALTHCHECK** for unraid's health indicator.
- [ ] **R3 — arm64 image** (add `linux/arm64` to the buildx platforms) for
  Pi/ARM homelabs.
- [ ] **R4 — Login rate limiting** on the auth endpoints.
- [ ] **R5 — Backup story.** Document SQLite file backup; optionally
  Litestream for continuous replication.

## Features

- [ ] **F1 — Show % Daily Value** alongside % target (labels print DV, so
  users can sanity-check imports).
- [ ] **F2 — Stock tracking** using `servingsPerContainer`: days-remaining
  and low-stock warnings (Groly-inspired).
- [ ] **F3 — Printable week view** of the regimen.
- [ ] **F4 — Optional AI label reading.** A Claude API vision path (bring
  your own key) as a higher-accuracy alternative to local OCR; feeds the
  same review form.
- [ ] **F5 — OCR preprocessing.** Grayscale/threshold before tesseract to
  lift accuracy of the local path.
- [ ] **F6 — Adherence tracking / check-off** (phase-2 idea; would make the
  dashboard reflect what you actually took, not just the plan).

## Quality

- [ ] **Q1 — Playwright e2e suite** in CI (signup → add product → regimen →
  dashboard totals).
- [ ] **Q2 — Automated axe/Lighthouse accessibility pass** in CI (WCAG 2.2
  AA is targeted but not machine-checked yet).

## Done

- [x] unraid appdata permissions: entrypoint chowns `/data` and drops to
  PUID/PGID (defaults 99:100, nobody:users) — fixed after first unraid
  deployment hit `SQLITE_CANTOPEN`.
- [x] Auth secret auto-generates into `/data/.auth-secret` when the env var
  is blank.
- [x] Plain-HTTP LAN login (secure cookies now opt-in via
  `USE_SECURE_COOKIES`).
- [x] LNHPD brand search across company name + ingredient dedupe.
