# Seed data (simulated) — Phase 1 MVP

Simulated dataset to develop and demo the MVP end-to-end: plant configuration, versioned
limit tables, producers, users, and four simulated lab reports with **expected verification
outcomes** (they double as acceptance-test fixtures for the rules engine).

> ⚠️ **DISCLAIMER — SIMULATED DATA.**
> All limit values in `limit-tables/` are development placeholders assembled from public
> sources and the owner-provided context documents. They are **not** a legal reference and
> **must be validated line-by-line by the plant's environmental engineer** (and replaced by
> the plant's authorization limits where applicable) before any production use. Every table
> carries `"status": "SIMULATED_DA_VALIDARE"` — the application must display a warning
> banner on any verification run against a table in this status.

## Layout

| Path | Content |
|---|---|
| `organization.json` | Demo organization + users/roles |
| `plant.json` | Plant, treatment lines, authorization stub, line↔limit-table bindings |
| `producers.json` | Sample waste producers (customers) |
| `analytes.json` | Canonical analyte registry (key, label, default unit/basis) — the join key between report parameters and limit entries |
| `limit-tables/*.json` | Versioned limit tables (totals col. A/B, landfill eluate inerti/non-pericolosi, POP layer) |
| `reports/*.json` | Simulated lab reports as **extraction output** (what the pipeline produces from a PDF) + `expected` block with the verdicts the rules engine must reproduce |
| `reports/pdf/*.pdf` | Two of the reports rendered as realistic PDFs — input fixtures for the extraction pipeline itself |
| `tools/generate_report_pdfs.py` | Regenerates the PDFs from scratch |

## Report scenarios

| ID | EER | Scenario | What it tests |
|---|---|---|---|
| **R1** | 17 09 03* | The UI mock-up case: soil from borehole B4, checked against Tabella 5 col. A for the Soil Washing line | Exact reproduction of the mock-up verdict: 23 parameters → **18 conformi / 2 non conformi (Mercurio, Zinco) / 3 non determinati**. ND causes: LOQ above limit (Cromo VI, PCB, Amianto) |
| **R2** | 17 05 04 | The fac-simile from `docs/context/`: clean excavation soil, tal quale + POPs + eluate UNI EN 12457-2 | Full pass against inert-landfill eluate criteria; lab-claimed limits present in the PDF but ignored; below-LOQ where LOQ = limit (Cianuri); pH range limit; parameter without a limit (Conducibilità → non applicabile) |
| **R3** | 17 05 04 | Soil from industrial-site remediation: passes Tabella 5 col. B but PFOA 4,2 mg/kg | **POP blocking layer**: conformity to the line table does NOT make the waste acceptable — Reg. (EU) 2019/1021 All. IV exceedance forces destructive treatment (no recovery, no landfill) |
| **R4** | 19 12 12 | Sorting residues, eluate fails inerti (DOC, solfati, Ni, Zn, F) but passes non-pericolosi | **Destination routing**: reject one destination, suggest the next admissible one (discarica non pericolosi) |

## Conventions

- `result_raw` preserves the string as printed on the report (decimal comma, `< LOQ` notation); `value`/`operator` are the parsed form. The rules engine consumes the parsed form; the raw form is what extraction must produce.
- `basis` is `"total"` (tal quale, mg/kg s.s.) or `"eluate"` (UNI EN 12457-2, mg/l). A limit entry only applies to a parameter with the same basis.
- Esito values: `conforme`, `non_conforme`, `non_determinato` (missing mandatory parameter, or LOQ > limit), `non_applicabile` (no limit entry for the analyte in the selected table).
- All dates ISO-8601; all numeric limit values use dot decimals in JSON (rendering re-localizes).
