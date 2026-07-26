# WasteManagement — "Anna" AI Assistant for Waste Acceptance

Web platform for an Italian waste-treatment plant operator (reference design: **Valli S.p.A. — "Chat con Anna"**).

The plant receives waste-analysis reports (*rapporti di prova*) from customers and must decide:

1. whether the waste can be **accepted** at the plant,
2. which **treatment line** it should go to (e.g. Soil Washing),
3. whether the output can reach **End of Waste (EoW)** status or which disposal/recovery destination applies,

based on the analytical results compared against the applicable regulatory limit tables (D.Lgs. 152/2006, D.Lgs. 121/2020, DPR 120/2017, plant-specific authorization limits, …).

📄 **Start here: [docs/PROPOSAL.md](docs/PROPOSAL.md)** — full product & technical proposal, architecture, data model, and phased delivery plan.

## Status

**Phase 1 MVP implemented** — Next.js app mirroring the "Chat con Anna" mock-up:

- Chat with Anna: upload a lab report (button or **drag & drop**), get the structured
  esito di conformità (inquadramento / stat chips / parameter table / conclusione).
- Deterministic **rules engine** (`src/lib/rules-engine.ts`) over the versioned limit
  tables in `seed/limit-tables/` — unit-tested against the R1–R4 fixtures (`npm test`).
- Right panel: PDF viewer (page/zoom controls), **Dati estratti** (editable via
  *Modifica*, re-verifies on save), **Confronto** (switch limit table via *Cambia*,
  switch plant line), conversation attachments.
- Autocomplete prompt suggestions, quick actions, demo fixture (the mock-up's
  17 09 03* case reproduced exactly: 18 conformi / 2 non conformi / 3 non determinati).
- Secondary sections: I miei documenti, Analisi e confronti, Impianti e linee,
  Normativa e procedure, Storico richieste.

Extraction is **simulated** in this build (uploads map to seed fixtures by filename;
unknown files fall back to R1) — the Claude API extraction call lands in Phase 1.1.
Persistence is a JSON file store in `.data/` (Postgres on Render per the proposal).

### Run

```bash
npm install
npm test        # rules engine vs fixture verdicts
npm run dev     # http://localhost:3000
```

In the chat, click **“Prova con il campione demo (17 09 03*)”** to reproduce the
mock-up conversation, or drag one of the PDFs from `seed/reports/pdf/` into the chat.
