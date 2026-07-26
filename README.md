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
Persistence and file storage live in `DATA_DIR` (default `.data/`; on Render, the
persistent disk mounted at `/var/data` — see `render.yaml`). Database records move
to Render Postgres in Phase 2; uploaded documents stay on the disk.

### Run

```bash
npm install
npm test        # rules engine vs fixture verdicts
npm run dev     # http://localhost:3000
```

In the chat, click **“Prova con il campione demo (17 09 03*)”** to reproduce the
mock-up conversation, or drag one of the PDFs from `seed/reports/pdf/` into the chat.

### Deploy on Render

The repo ships a [Render Blueprint](https://render.com/docs/infrastructure-as-code)
(`render.yaml`) that deploys the app as a single Node web service:

1. Push this repository to GitHub (or fork it).
2. In the [Render dashboard](https://dashboard.render.com), choose
   **New → Blueprint** and select the repository. Render reads `render.yaml`
   and provisions the `valli-spa-ai` web service (Starter plan, Node 22).
3. Approve the plan — the first deploy runs `npm ci && npm run build` and then
   `npm run start` (Next.js binds to Render's `PORT` automatically).

Notes:

- **Persistence:** uploaded documents and the JSON store live in `DATA_DIR`,
  a 5 GB persistent disk mounted at `/var/data`, so they survive deploys.
  Disks require a paid instance type; to trial on the **free** tier, delete
  the `disk` block and the `DATA_DIR` env var from `render.yaml` (data then
  resets on every deploy).
- **Auto-deploy** is enabled: every push to the connected branch redeploys.
- **Phase 1.1:** when real Claude extraction lands, uncomment the
  `ANTHROPIC_API_KEY` entry in `render.yaml` and set the key in the Render
  dashboard (it is marked `sync: false`, so the value never lives in the repo).
